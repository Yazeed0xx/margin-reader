import app from '@adonisjs/core/services/app'
import config from '@adonisjs/core/services/config'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import Article from '#models/article'
import ArticleReference from '#models/article_reference'
import Bookmark from '#models/bookmark'
import ReadingProgress from '#models/reading_progress'
import Resource from '#models/resource'
import ResourceAccess from '#models/resource_access'
import User from '#models/user'
import ArticlePublishingService from '#services/article_publishing_service'

import type { ArticleInput } from '#validators/article'

const document = (): ArticleInput => ({
  title: 'An essay',
  language: 'en',
  content: {
    version: 1,
    blocks: [
      { id: 'intro', type: 'paragraph', text: 'Read this idea.' },
      { id: 'ending', type: 'paragraph', text: 'More thoughts.' },
    ],
  },
})
const account = (email = 'reading-writer@example.com') =>
  User.create({ email, password: 'password123' })
async function published(writer: User, input = document()) {
  const publishing = await app.container.make(ArticlePublishingService)
  const article = await publishing.create(writer.id, input)
  return publishing.publish(article.id, writer.id, 0)
}
async function source(user: User, url = 'https://example.com/research') {
  const resource = await Resource.create({
    url,
    processingStatus: 'ready',
    kind: 'article',
    displayPolicy: 'full_content',
    resolvedUrl: url,
    contentText: 'A useful source quote. More detailed source content.',
    rightsEvidence: 'Permission #1',
  })
  await ResourceAccess.create({ userId: user.id, resourceId: resource.id })
  config.set('resources.approvedSources', [
    { origin: 'https://example.com', evidence: 'Permission #1' },
  ])
  return resource
}

test.group('Reading APIs', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => config.set('resources.approvedSources', []))

  test('attaches references, publishes snapshots, and loads source preview separately from content', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const resource = await source(writer)
    const reference = {
      referenceKey: 'study',
      blockId: 'intro',
      resourceId: resource.id,
      selectedQuote: 'A useful source quote.',
      commentary: 'Why this matters',
    }
    const created = await client
      .visit('profile.articles.store')
      .loginAs(writer)
      .json({ ...document(), references: [reference] })
    created.assertStatus(201)
    const articleId = created.body().data.id
    const revisionId = created.body().data.draft!.id
    assert.equal(created.body().data.draft!.references[0].commentary, 'Why this matters')
    const path = `/api/v1/articles/${articleId}/sources/study`
    const privateSource = await client.get(path).qs({ revisionId })
    privateSource.assertStatus(404)
    const publish = await client
      .post(`/api/v1/account/articles/${articleId}/publish`)
      .loginAs(writer)
      .json({ expectedVersion: 0 })
    publish.assertStatus(200)
    const detail = await client.get(`/api/v1/articles/${articleId}`)
    detail.assertBodyContains({ data: { references: [reference] } })
    const preview = await client.get(path).qs({ revisionId })
    preview.assertStatus(200)
    assert.notInclude(JSON.stringify(preview.body()), 'More detailed source content.')
    const content = await client.get(`${path}/content`).qs({ revisionId })
    content.assertStatus(200)
    content.assertBodyContains({ data: { contentText: resource.contentText } })
    const inaccessibleId = await client.get(`/api/v1/account/resources/${resource.id}`)
    inaccessibleId.assertStatus(401)
    const edited = await client
      .put(`/api/v1/account/articles/${articleId}`)
      .loginAs(writer)
      .json({
        ...document(),
        references: [{ ...reference, commentary: 'New private note' }],
        expectedVersion: 1,
      })
    edited.assertStatus(200)
    const unchanged = await client.get(`/api/v1/articles/${articleId}`)
    unchanged.assertBodyContains({ data: { references: [reference] } })
    const wrongRevision = await client.get(path).qs({ revisionId: edited.body().data.draft!.id })
    wrongRevision.assertStatus(404)
    config.set('resources.approvedSources', [])
    const revoked = await client.get(`${path}/content`).qs({ revisionId })
    revoked.assertBodyContains({ data: { contentText: null, displayPolicy: 'metadata' } })
    const unpublish = await client
      .post(`/api/v1/account/articles/${articleId}/unpublish`)
      .loginAs(writer)
      .json({ expectedVersion: 2 })
    unpublish.assertStatus(200)
    const withdrawn = await client.get(path).qs({ revisionId })
    withdrawn.assertStatus(404)
  })

  test('rejects invalid source access, blocks, quotes, timestamps, duplicate keys and stale saves atomically', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const resource = await source(writer)
    const other = await account('other-reader@example.com')
    const hidden = await source(other, 'https://example.com/hidden')
    const article = await published(writer)
    const base = { referenceKey: 'one', blockId: 'intro', resourceId: resource.id }
    const invalid = [
      [{ ...base, blockId: 'missing' }],
      [{ ...base, resourceId: hidden.id }],
      [{ ...base, selectedQuote: 'This was never in the source' }],
      [{ ...base, videoStartSeconds: 3 }],
      [base, base],
    ]
    for (const references of invalid) {
      const response = await client
        .put(`/api/v1/account/articles/${article.id}`)
        .loginAs(writer)
        .json({ ...document(), references, expectedVersion: 1 })
      response.assertStatus(422)
    }
    await article.refresh()
    assert.equal(article.lockVersion, 1)
    assert.lengthOf(await article.related('revisions').query(), 1)
    const stale = await client
      .put(`/api/v1/account/articles/${article.id}`)
      .loginAs(writer)
      .json({ ...document(), references: [base], expectedVersion: 0 })
    stale.assertStatus(409)
    const denied = await client
      .put(`/api/v1/account/articles/${article.id}`)
      .loginAs(other)
      .json({ ...document(), references: [base], expectedVersion: 1 })
    denied.assertStatus(403)
  })

  test('keeps video timestamps per citation and removes references only from new revisions', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const resource = await Resource.create({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      kind: 'video',
      provider: 'youtube',
      providerId: 'dQw4w9WgXcQ',
    })
    await ResourceAccess.create({ userId: writer.id, resourceId: resource.id })
    const article = await published(writer, {
      ...document(),
      references: [
        { referenceKey: 'first', blockId: 'intro', resourceId: resource.id, videoStartSeconds: 30 },
        {
          referenceKey: 'second',
          blockId: 'ending',
          resourceId: resource.id,
          videoStartSeconds: 90,
        },
      ],
    })
    const saved = await client
      .put(`/api/v1/account/articles/${article.id}`)
      .loginAs(writer)
      .json({
        ...document(),
        content: { version: 1, blocks: [document().content.blocks[0]] },
        expectedVersion: 1,
      })
    saved.assertStatus(200)
    assert.lengthOf(saved.body().data.draft!.references, 1)
    assert.equal(saved.body().data.draft!.references[0].videoStartSeconds, 30)
    assert.lengthOf(
      await ArticleReference.query().where('articleRevisionId', article.publishedRevisionId!),
      2,
    )
    const removed = await client
      .put(`/api/v1/account/articles/${article.id}`)
      .loginAs(writer)
      .json({ ...document(), references: [], expectedVersion: 2 })
    removed.assertStatus(200)
    assert.isEmpty(removed.body().data.draft!.references)
    const republish = await client
      .post(`/api/v1/account/articles/${article.id}/publish`)
      .loginAs(writer)
      .json({ expectedVersion: 3 })
    republish.assertStatus(200)
    const old = await client
      .get(`/api/v1/articles/${article.id}/sources/first`)
      .qs({ revisionId: article.publishedRevisionId })
    old.assertStatus(404)
  })

  test('bookmarks are private, idempotent, paginated, and hide unpublished articles', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const reader = await account('reader@example.com')
    const article = await published(writer)
    const path = `/api/v1/account/articles/${article.id}/bookmark`
    const guest = await client.put(path)
    guest.assertStatus(401)
    for (let i = 0; i < 2; i++) {
      ;(await client.put(path).loginAs(reader)).assertStatus(200)
    }
    assert.lengthOf(await Bookmark.all(), 1)
    const list = await client.get('/api/v1/account/bookmarks').loginAs(reader).qs({ perPage: 1 })
    list.assertStatus(200)
    assert.lengthOf(list.body().data, 1)
    list.assertBodyContains({ data: [{ article: { author: { id: writer.id } } }] })
    assert.notInclude(JSON.stringify(list.body()), 'contentText')
    const others = await client.get('/api/v1/account/bookmarks').loginAs(writer)
    others.assertBodyContains({ data: [] })
    const state = await client.get(path).loginAs(writer)
    state.assertBodyContains({ data: { bookmarked: false } })
    await (await app.container.make(ArticlePublishingService)).unpublish(article.id, writer.id, 1)
    const hidden = await client.get('/api/v1/account/bookmarks').loginAs(reader)
    hidden.assertBodyContains({ data: [] })
    const rejected = await client.put(path).loginAs(reader)
    rejected.assertStatus(404)
    for (let i = 0; i < 2; i++) {
      ;(await client.delete(path).loginAs(reader)).assertStatus(204)
    }
    assert.isEmpty(await Bookmark.all())
  })

  test('saves private revision-aware positions, rejects stale writes, and retains version on reset', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const reader = await account('reader@example.com')
    const article = await published(writer)
    const path = `/api/v1/account/articles/${article.id}/progress`
    const missing = await client.get(path).loginAs(reader)
    missing.assertStatus(200)
    missing.assertBodyContains({ data: null, needsReanchor: false })
    const input = {
      expectedVersion: 0,
      revisionId: article.publishedRevisionId,
      blockId: 'intro',
      blockProgress: 0.4,
    }
    const saved = await client.put(path).loginAs(reader).json(input)
    saved.assertStatus(200)
    saved.assertBodyContains({ data: { lockVersion: 1, blockId: 'intro', blockProgress: 0.4 } })
    const stale = await client.put(path).loginAs(reader).json(input)
    stale.assertStatus(409)
    const another = await client.get(path).loginAs(writer)
    another.assertBodyContains({ data: null })
    const invalid = await client
      .put(path)
      .loginAs(reader)
      .json({ ...input, expectedVersion: 1, blockId: 'missing' })
    invalid.assertStatus(409)
    const reset = await client.delete(path).loginAs(reader).json({ expectedVersion: 1 })
    reset.assertStatus(200)
    reset.assertBodyContains({ data: { lockVersion: 2, revisionId: null, blockId: null } })
    const delayed = await client.put(path).loginAs(reader).json(input)
    delayed.assertStatus(409)
    assert.lengthOf(await ReadingProgress.all(), 1)
    const resume = await client
      .put(path)
      .loginAs(reader)
      .json({ ...input, expectedVersion: 2 })
    resume.assertStatus(200)
    const publishing = await app.container.make(ArticlePublishingService)
    await publishing.update(article.id, writer.id, 1, document())
    await publishing.publish(article.id, writer.id, 2)
    const changed = await client.get(path).loginAs(reader)
    changed.assertBodyContains({ needsReanchor: true, data: { lockVersion: 3 } })
    const oldRevision = await client
      .put(path)
      .loginAs(reader)
      .json({ ...input, expectedVersion: 3 })
    oldRevision.assertStatus(409)
    await publishing.unpublish(article.id, writer.id, 3)
    ;(await client.get(path).loginAs(reader)).assertStatus(404)
    const forgotten = await client.delete(path).loginAs(reader).json({ expectedVersion: 3 })
    forgotten.assertStatus(200)
    forgotten.assertBodyContains({ data: { blockId: null, lockVersion: 4 } })
  })

  test('validates reader inputs and prevents wrong-article revision positions', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const article = await published(writer)
    const other = await published(writer)
    const path = `/api/v1/account/articles/${article.id}/progress`
    const input = {
      expectedVersion: 0,
      revisionId: article.publishedRevisionId,
      blockId: 'intro',
      blockProgress: 0,
    }
    ;(await client.put(path).json(input)).assertStatus(401)
    for (const body of [
      { ...input, blockProgress: 1.1 },
      { ...input, expectedVersion: -1 },
      { ...input, blockId: '' },
    ]) {
      ;(await client.put(path).loginAs(writer).json(body)).assertStatus(422)
    }
    ;(
      await client
        .put(path)
        .loginAs(writer)
        .json({ ...input, revisionId: other.publishedRevisionId })
    ).assertStatus(409)
    assert.isEmpty(await ReadingProgress.all())
    ;(
      await client.get('/api/v1/account/bookmarks').loginAs(writer).qs({ perPage: 100 })
    ).assertStatus(422)
    ;(await client.get(`/api/v1/articles/${article.id}/sources/missing`)).assertStatus(422)
    await assert.rejects(() =>
      ReadingProgress.create({
        userId: writer.id,
        articleId: article.id,
        revisionId: other.publishedRevisionId,
        blockId: 'intro',
      }),
    )
  })
})

test.group('Reading concurrency', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  test('accepts one of two competing positions and deduplicates concurrent bookmarks', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const article = await published(writer)
    const path = `/api/v1/account/articles/${article.id}`
    const results = await Promise.all(
      [0.2, 0.8].map((blockProgress) =>
        client.put(`${path}/progress`).loginAs(writer).json({
          expectedVersion: 0,
          revisionId: article.publishedRevisionId,
          blockId: 'intro',
          blockProgress,
        }),
      ),
    )
    assert.deepEqual(results.map((result) => result.status()).sort(), [200, 409])
    const marks = await Promise.all([
      client.put(`${path}/bookmark`).loginAs(writer),
      client.put(`${path}/bookmark`).loginAs(writer),
    ])
    marks.forEach((response) => response.assertStatus(200))
    assert.lengthOf(await Bookmark.all(), 1)
    await (await Article.findOrFail(article.id)).delete()
    assert.isEmpty(await Bookmark.all())
    assert.isEmpty(await ReadingProgress.all())
  })
})
