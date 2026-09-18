import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import Article from '#models/article'
import ArticleReference from '#models/article_reference'
import ArticleRevision from '#models/article_revision'
import Resource from '#models/resource'
import User from '#models/user'

import type { ArticleInput } from '#validators/article'

const essay = (language: 'ar' | 'en' = 'ar'): ArticleInput => ({
  title: language === 'ar' ? 'مقال عن الأفكار' : 'An essay about ideas',
  language,
  content: {
    version: 1,
    blocks: [
      { id: 'intro', type: 'paragraph', text: 'فكرة عربية مع English text' },
      { id: 'quote-1', type: 'quote', text: 'An English quotation.', direction: 'ltr' },
    ],
  },
})

const account = (email = 'writer@example.com') =>
  User.create({ email, password: 'password123', fullName: 'Writer' })

test.group('Article publishing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a private bilingual draft and previews it without publishing', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const created = await client
      .visit('profile.articles.store')
      .loginAs(writer)
      .json({ ...essay(), ...{ authorId: 999, publishedRevisionId: 999 } })
    created.assertStatus(201)
    created.assertBodyContains({
      data: {
        lockVersion: 0,
        publishedRevisionId: null,
        draft: {
          revisionNumber: 1,
          title: essay().title,
          language: 'ar',
          direction: 'rtl',
          content: essay().content,
        },
      },
    })
    const id = created.body().data.id
    const article = await Article.findOrFail(id)
    assert.equal(article.authorId, writer.id)
    const preview = await client.get(`/api/v1/account/articles/${id}/preview`).loginAs(writer)
    preview.assertStatus(200)
    preview.assertHeader('cache-control', 'private, no-store')
    preview.assertBodyContains({ data: { publishedRevisionId: null, lockVersion: 0 } })
    const publicRead = await client.get(`/api/v1/articles/${id}`)
    publicRead.assertStatus(404)
    const publicList = await client.get('/api/v1/articles')
    publicList.assertBodyContains({ data: [] })
  })

  test('publishes a snapshot, keeps later edits private, republishes, and unpublishes', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const created = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    created.assertStatus(201)
    const id = created.body().data.id
    const published = await client
      .post(`/api/v1/account/articles/${id}/publish`)
      .loginAs(writer)
      .json({ expectedVersion: 0 })
    published.assertStatus(200)
    published.assertBodyContains({ data: { lockVersion: 1, hasUnpublishedChanges: false } })
    const originalRevisionId = published.body().data.publishedRevisionId
    const originalTime = published.body().data.publishedAt
    const publicRead = await client.get(`/api/v1/articles/${id}`)
    publicRead.assertStatus(200)
    publicRead.assertHeader('cache-control', 'no-store')
    publicRead.assertBodyContains({
      data: {
        revisionId: originalRevisionId,
        title: essay().title,
        content: essay().content,
        author: { id: writer.id, fullName: 'Writer', bio: null },
      },
    })
    assert.notProperty(publicRead.body().data, 'lockVersion')
    assert.notProperty(publicRead.body().data, 'draft')
    assert.notProperty(publicRead.body().data.author, 'email')

    const edited = await client
      .put(`/api/v1/account/articles/${id}`)
      .loginAs(writer)
      .json({ ...essay('en'), title: 'Private replacement', expectedVersion: 1 })
    edited.assertStatus(200)
    edited.assertBodyContains({
      data: {
        lockVersion: 2,
        hasUnpublishedChanges: true,
        draft: { revisionNumber: 2, title: 'Private replacement', direction: 'ltr' },
      },
    })
    const unchanged = await client.get(`/api/v1/articles/${id}`)
    unchanged.assertBodyContains({
      data: { title: essay().title, language: 'ar', revisionId: originalRevisionId },
    })
    assert.equal((await ArticleRevision.findOrFail(originalRevisionId!)).title, essay().title)

    const republished = await client
      .post(`/api/v1/account/articles/${id}/publish`)
      .loginAs(writer)
      .json({ expectedVersion: 2 })
    republished.assertStatus(200)
    republished.assertBodyContains({
      data: { lockVersion: 3, hasUnpublishedChanges: false, publishedAt: originalTime },
    })
    const replacement = await client.get(`/api/v1/articles/${id}`)
    replacement.assertBodyContains({ data: { title: 'Private replacement', language: 'en' } })
    const unpublished = await client
      .post(`/api/v1/account/articles/${id}/unpublish`)
      .loginAs(writer)
      .json({ expectedVersion: 3 })
    unpublished.assertStatus(200)
    unpublished.assertBodyContains({
      data: { lockVersion: 4, publishedRevisionId: null, publishedAt: null },
    })
    const hidden = await client.get(`/api/v1/articles/${id}`)
    hidden.assertStatus(404)
    const list = await client.get('/api/v1/articles')
    list.assertBodyContains({ data: [] })
    const preview = await client.get(`/api/v1/account/articles/${id}/preview`).loginAs(writer)
    preview.assertBodyContains({ data: { draft: { title: 'Private replacement' } } })
    const restored = await client
      .post(`/api/v1/account/articles/${id}/publish`)
      .loginAs(writer)
      .json({ expectedVersion: 4 })
    restored.assertStatus(200)
    assert.equal((await ArticleRevision.query().where('articleId', id)).length, 2)
  })

  test('rejects stale saves and publication commands without changing revisions', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const created = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    const id = created.body().data.id
    const saved = await client
      .put(`/api/v1/account/articles/${id}`)
      .loginAs(writer)
      .json({ ...essay(), title: 'Newest', expectedVersion: 0 })
    saved.assertStatus(200)
    const stale = await client
      .put(`/api/v1/account/articles/${id}`)
      .loginAs(writer)
      .json({ ...essay(), title: 'Stale', expectedVersion: 0 })
    stale.assertStatus(409)
    stale.assertBodyContains({ errors: [{ code: 'E_ARTICLE_CONFLICT' }] })
    for (const action of ['publish', 'unpublish']) {
      const result = await client
        .post(`/api/v1/account/articles/${id}/${action}`)
        .loginAs(writer)
        .json({ expectedVersion: 0 })
      result.assertStatus(409)
    }
    const article = await Article.findOrFail(id)
    assert.equal(article.lockVersion, 1)
    assert.isNull(article.publishedRevisionId)
    assert.equal((await ArticleRevision.query().where('articleId', id)).length, 2)
  })

  test('requires authentication and enforces ownership on all private operations', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const other = await account('other@example.com')
    const created = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    const id = created.body().data.id
    for (const suffix of ['', '/preview']) {
      const guest = await client.get(`/api/v1/account/articles/${id}${suffix}`)
      guest.assertStatus(401)
      const denied = await client.get(`/api/v1/account/articles/${id}${suffix}`).loginAs(other)
      denied.assertStatus(403)
    }
    const guestList = await client.visit('profile.articles.index')
    guestList.assertStatus(401)
    const guestCreate = await client.visit('profile.articles.store').json(essay())
    guestCreate.assertStatus(401)
    const guestSave = await client
      .put(`/api/v1/account/articles/${id}`)
      .json({ ...essay(), expectedVersion: 0 })
    guestSave.assertStatus(401)
    const deniedSave = await client
      .put(`/api/v1/account/articles/${id}`)
      .loginAs(other)
      .json({ ...essay(), expectedVersion: 0 })
    deniedSave.assertStatus(403)
    for (const action of ['publish', 'unpublish']) {
      const guest = await client
        .post(`/api/v1/account/articles/${id}/${action}`)
        .json({ expectedVersion: 0 })
      guest.assertStatus(401)
      const denied = await client
        .post(`/api/v1/account/articles/${id}/${action}`)
        .loginAs(other)
        .json({ expectedVersion: 0 })
      denied.assertStatus(403)
    }
    const otherList = await client.visit('profile.articles.index').loginAs(other)
    otherList.assertBodyContains({ data: [] })
    assert.equal((await Article.findOrFail(id)).lockVersion, 0)
  })

  test('validates document structure, unique IDs, language, limits, and version inputs', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const invalidDocuments = [
      { title: '' },
      { title: 'x'.repeat(241) },
      { language: 'fr' },
      { content: '<script>alert(1)</script>' },
      { content: { version: 2, blocks: [] } },
      { content: { version: 1, blocks: [{ id: 'x', type: 'html', text: '<iframe>' }] } },
      {
        content: { version: 1, blocks: [{ id: 'x', type: 'heading', level: 1, text: 'Heading' }] },
      },
      {
        content: {
          version: 1,
          blocks: [{ id: 'x', type: 'paragraph', text: 'text', direction: 'vertical' }],
        },
      },
      {
        content: {
          version: 1,
          blocks: [
            { id: 'x', type: 'paragraph', text: 'a' },
            { id: 'x', type: 'quote', text: 'b' },
          ],
        },
      },
      { content: { version: 1, blocks: [{ type: 'paragraph', text: 'Missing ID' }] } },
      { content: { version: 1, blocks: [{ id: 'bad id', type: 'paragraph', text: 'Bad ID' }] } },
      {
        content: { version: 1, blocks: [{ id: 'x', type: 'paragraph', text: 'x'.repeat(20001) }] },
      },
    ]
    for (const invalid of invalidDocuments) {
      const result = await client
        .post('/api/v1/account/articles')
        .loginAs(writer)
        .json({ ...essay(), ...invalid })
      assert.equal(result.status(), 422, JSON.stringify(invalid).slice(0, 200))
    }
    assert.lengthOf(await Article.all(), 0)
    const created = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    const id = created.body().data.id
    for (const expectedVersion of [undefined, -1, 0.5, 'abc']) {
      const result = await client
        .put(`/api/v1/account/articles/${id}`)
        .loginAs(writer)
        .json({ ...essay(), expectedVersion })
      result.assertStatus(422)
    }
  })

  test('supports every block type and keeps text as data', async ({ client }) => {
    const writer = await account()
    const input: ArticleInput = {
      ...essay('en'),
      content: {
        version: 1,
        blocks: [
          { id: 'heading', type: 'heading', level: 2, text: 'Heading' },
          {
            id: 'p',
            type: 'paragraph',
            text: '<script>not executable HTML</script>',
            direction: 'auto',
          },
          { id: 'q', type: 'quote', text: 'اقتباس', direction: 'rtl' },
          { id: 'code', type: 'code', text: '  const x = 1;\n' },
          { id: 'ul', type: 'bulletList', items: ['One', 'Two'] },
          { id: 'ol', type: 'orderedList', items: ['أول', 'ثان'] },
        ],
      },
    }
    const created = await client.visit('profile.articles.store').loginAs(writer).json(input)
    created.assertStatus(201)
    created.assertBodyContains({ data: { draft: { content: input.content } } })
  })

  test('rolls back publication of an empty draft', async ({ client, assert }) => {
    const writer = await account()
    const created = await client
      .visit('profile.articles.store')
      .loginAs(writer)
      .json({ ...essay(), content: { version: 1, blocks: [] } })
    created.assertStatus(201)
    const id = created.body().data.id
    const result = await client
      .post(`/api/v1/account/articles/${id}/publish`)
      .loginAs(writer)
      .json({ expectedVersion: 0 })
    result.assertStatus(422)
    const article = await Article.findOrFail(id)
    assert.equal(article.lockVersion, 0)
    assert.isNull(article.publishedRevisionId)
    assert.isNull(article.publishedAt)
  })

  test('paginates deterministically and filters by published language and author', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const second = await account('second@example.com')
    const ids: number[] = []
    for (const [index, language] of (['ar', 'ar', 'en'] as const).entries()) {
      const user = index === 2 ? second : writer
      const created = await client
        .visit('profile.articles.store')
        .loginAs(user)
        .json(essay(language))
      const id = created.body().data.id
      ids.push(id)
      const published = await client
        .post(`/api/v1/account/articles/${id}/publish`)
        .loginAs(user)
        .json({ expectedVersion: 0 })
      published.assertStatus(200)
    }
    // An English draft must not change the public language filter.
    const saved = await client
      .put(`/api/v1/account/articles/${ids[0]}`)
      .loginAs(writer)
      .json({ ...essay('en'), expectedVersion: 1 })
    saved.assertStatus(200)
    const page1 = await client.get('/api/v1/articles').qs({ language: 'ar', perPage: 1 })
    page1.assertStatus(200)
    assert.lengthOf(page1.body().data, 1)
    assert.notProperty(page1.body().data[0], 'content')
    assert.equal(page1.body().metadata.total, 2)
    assert.include(page1.body().metadata.nextPageUrl!, 'language=ar')
    const page2 = await client.get('/api/v1/articles').qs({ language: 'ar', perPage: 1, page: 2 })
    assert.lengthOf(page2.body().data, 1)
    assert.notEqual(page1.body().data[0].id, page2.body().data[0].id)
    assert.sameMembers([page1.body().data[0].id, page2.body().data[0].id], ids.slice(0, 2))
    const authorList = await client.get('/api/v1/articles').qs({ authorId: second.id })
    assert.deepEqual(
      authorList.body().data.map((article: { id: number }) => article.id),
      [ids[2]],
    )
    const ownList = await client.visit('profile.articles.index').loginAs(writer)
    assert.lengthOf(ownList.body().data, 2)
    assert.notProperty(ownList.body().data[0].draft!, 'content')
    for (const qs of [
      { page: 0 },
      { perPage: 51 },
      { page: 1.2 },
      { language: 'fr' },
      { authorId: 'bad' },
    ]) {
      const bad = await client.get(
        '/api/v1/articles?' +
          new URLSearchParams(
            Object.entries(qs)
              .filter((entry) => entry[1] !== undefined)
              .map(([key, value]) => [key, String(value)] as [string, string]),
          ),
      )
      bad.assertStatus(422)
    }
    const invalidId = await client.get('/api/v1/articles/nope')
    invalidId.assertStatus(422)
    const missing = await client.get('/api/v1/articles/2147483647')
    missing.assertStatus(404)
  })

  test('preserves revision references only for retained block IDs and enforces same-article pointers', async ({
    client,
    assert,
  }) => {
    const writer = await account()
    const created = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    const id = created.body().data.id
    const originalId = created.body().data.draft!.id
    const resource = await Resource.create({
      url: 'https://example.com/source',
      kind: 'video',
      provider: 'youtube',
    })
    await ArticleReference.create({
      articleRevisionId: originalId,
      resourceId: resource.id,
      referenceKey: 'ref-1',
      blockId: 'intro',
      commentary: 'Original note',
      videoStartSeconds: 30,
    })
    const saved = await client
      .put(`/api/v1/account/articles/${id}`)
      .loginAs(writer)
      .json({ ...essay(), expectedVersion: 0 })
    saved.assertStatus(200)
    const secondId = saved.body().data.draft!.id
    const copied = await ArticleReference.query().where('articleRevisionId', secondId).firstOrFail()
    assert.equal(copied.commentary, 'Original note')
    assert.equal(copied.videoStartSeconds, 30)
    const removed = await client
      .put(`/api/v1/account/articles/${id}`)
      .loginAs(writer)
      .json({
        ...essay(),
        content: { version: 1, blocks: [essay().content.blocks[1]] },
        expectedVersion: 1,
      })
    removed.assertStatus(200)
    assert.lengthOf(
      await ArticleReference.query().where('articleRevisionId', removed.body().data.draft!.id),
      0,
    )
    assert.lengthOf(await ArticleReference.query().where('articleRevisionId', originalId), 1)
    const other = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    await assert.rejects(() =>
      Article.query().where('id', id).update({ publishedRevisionId: other.body().data.draft!.id }),
    )
    await assert.rejects(() =>
      Article.query().where('id', id).update({ draftRevisionId: other.body().data.draft!.id }),
    )
    const published = await client
      .post(`/api/v1/account/articles/${id}/publish`)
      .loginAs(writer)
      .json({ expectedVersion: 2 })
    published.assertStatus(200)
    await (await Article.findOrFail(id)).delete()
    assert.lengthOf(await ArticleRevision.query().where('articleId', id), 0)
  })
})

test.group('Article concurrent writes', (group) => {
  // Real transactions: do not wrap competing requests in one global transaction.
  group.each.setup(() => testUtils.db().truncate())

  test('accepts one competing save and rejects the stale writer', async ({ client, assert }) => {
    const writer = await account('concurrent@example.com')
    const created = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    created.assertStatus(201)
    const id = created.body().data.id
    const results = await Promise.all([
      client
        .put(`/api/v1/account/articles/${id}`)
        .loginAs(writer)
        .json({ ...essay(), title: 'First contender', expectedVersion: 0 }),
      client
        .put(`/api/v1/account/articles/${id}`)
        .loginAs(writer)
        .json({ ...essay(), title: 'Second contender', expectedVersion: 0 }),
    ])
    assert.sameMembers(
      results.map((result) => result.status()),
      [200, 409],
    )
    const article = await Article.findOrFail(id)
    assert.equal(article.lockVersion, 1)
    assert.lengthOf(await ArticleRevision.query().where('articleId', id), 2)
    await article.load('draftRevision')
    assert.include(['First contender', 'Second contender'], article.draftRevision.title)
  })

  test('serializes a save racing publication without publishing an unseen draft', async ({
    client,
    assert,
  }) => {
    const writer = await account('publication-race@example.com')
    const created = await client.visit('profile.articles.store').loginAs(writer).json(essay())
    const id = created.body().data.id
    const results = await Promise.all([
      client
        .put(`/api/v1/account/articles/${id}`)
        .loginAs(writer)
        .json({ ...essay(), title: 'New private draft', expectedVersion: 0 }),
      client
        .post(`/api/v1/account/articles/${id}/publish`)
        .loginAs(writer)
        .json({ expectedVersion: 0 }),
    ])
    assert.sameMembers(
      results.map((result) => result.status()),
      [200, 409],
    )
    const article = await Article.findOrFail(id)
    assert.equal(article.lockVersion, 1)
    if (article.publishedRevisionId) {
      await article.load('publishedRevision')
      assert.equal(article.publishedRevision.title, essay().title)
    } else {
      await article.load('draftRevision')
      assert.equal(article.draftRevision.title, 'New private draft')
    }
  })
})
