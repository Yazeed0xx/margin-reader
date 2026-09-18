import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import Follow from '#models/follow'
import User from '#models/user'
import ArticlePublishingService from '#services/article_publishing_service'

import type { ArticleInput } from '#validators/article'

const account = (email: string, readingLanguage: 'ar' | 'en' | 'both' = 'both') =>
  User.create({ email, password: 'password123', fullName: 'Public Writer', readingLanguage })
const essay = (title: string, text: string, language: 'ar' | 'en' = 'en'): ArticleInput => ({
  title,
  language,
  content: { version: 1, blocks: [{ id: 'intro', type: 'paragraph', text }] },
})
async function publish(writer: User, input: ArticleInput) {
  const publishing = await app.container.make(ArticlePublishingService)
  const article = await publishing.create(writer.id, input)
  return publishing.publish(article.id, writer.id, 0)
}

test.group('Discovery', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('follows privately with idempotent writes, ownership, and no self-following', async ({
    client,
    assert,
  }) => {
    const reader = await account('reader@example.com')
    const writer = await account('writer@example.com')
    const other = await account('other@example.com')
    const path = `/api/v1/account/writers/${writer.id}/follow`
    ;(await client.put(path)).assertStatus(401)
    ;(await client.put(`/api/v1/account/writers/${reader.id}/follow`).loginAs(reader)).assertStatus(
      403,
    )
    for (let i = 0; i < 2; i++) {
      ;(await client.put(path).loginAs(reader).json({ followerId: other.id })).assertStatus(200)
    }
    assert.lengthOf(await Follow.all(), 1)
    ;(await client.get(path).loginAs(reader)).assertBodyContains({ data: { following: true } })
    ;(await client.get(path).loginAs(other)).assertBodyContains({ data: { following: false } })
    const list = await client.get('/api/v1/account/following').loginAs(reader)
    list.assertStatus(200)
    list.assertHeader('cache-control', 'private, no-store')
    list.assertBodyContains({ data: [{ writer: { id: writer.id, fullName: 'Public Writer' } }] })
    assert.notInclude(JSON.stringify(list.body()), 'writer@example.com')
    assert.notInclude(JSON.stringify(list.body()), 'readingLanguage')
    ;(await client.delete(path).loginAs(other)).assertStatus(204)
    assert.lengthOf(await Follow.all(), 1)
    for (let i = 0; i < 2; i++) {
      ;(await client.delete(path).loginAs(reader)).assertStatus(204)
    }
    assert.isEmpty(await Follow.all())
    await assert.rejects(() => Follow.create({ followerId: reader.id, writerId: reader.id }))
  })

  test('feed is chronological, followed-only, private, and honors preference with explicit override', async ({
    client,
    assert,
  }) => {
    const reader = await account('reader@example.com', 'ar')
    const writer = await account('writer@example.com')
    const stranger = await account('stranger@example.com')
    const english = await publish(writer, essay('English', 'Thoughts in English'))
    const arabic = await publish(writer, essay('أفكار', 'بحث عن القراءة', 'ar'))
    await publish(stranger, essay('Unfollowed', 'Not in this feed'))
    await (
      await app.container.make(ArticlePublishingService)
    ).create(writer.id, essay('Private draft', 'Hidden'))
    ;(await client.get('/api/v1/account/feed')).assertStatus(401)
    ;(await client.get('/api/v1/account/feed').loginAs(reader)).assertBodyContains({ data: [] })
    ;(await client.put(`/api/v1/account/writers/${writer.id}/follow`).loginAs(reader)).assertStatus(
      200,
    )
    const defaultFeed = await client.get('/api/v1/account/feed').loginAs(reader)
    assert.deepEqual(
      defaultFeed.body().data.map((row: { id: number }) => row.id),
      [arabic.id],
    )
    const both = await client
      .get('/api/v1/account/feed')
      .loginAs(reader)
      .qs({ language: 'both', perPage: 1 })
    assert.equal(both.body().data[0].id, arabic.id)
    assert.include(both.body().metadata.nextPageUrl, 'language=both')
    const second = await client
      .get('/api/v1/account/feed')
      .loginAs(reader)
      .qs({ language: 'both', perPage: 1, page: 2 })
    assert.equal(second.body().data[0].id, english.id)
    const searched = await client
      .get('/api/v1/account/feed')
      .loginAs(reader)
      .qs({ language: 'both', q: 'english' })
    assert.deepEqual(
      searched.body().data.map((row: { id: number }) => row.id),
      [english.id],
    )
    await (await app.container.make(ArticlePublishingService)).unpublish(arabic.id, writer.id, 1)
    ;(await client.get('/api/v1/account/feed').loginAs(reader)).assertBodyContains({ data: [] })
    ;(
      await client.delete(`/api/v1/account/writers/${writer.id}/follow`).loginAs(reader)
    ).assertStatus(204)
    ;(
      await client.get('/api/v1/account/feed').loginAs(reader).qs({ language: 'both' })
    ).assertBodyContains({ data: [] })
  })

  test('search matches published title/body with Unicode normalization and literal punctuation', async ({
    client,
    assert,
  }) => {
    const writer = await account('writer@example.com')
    const article = await publish(writer, {
      ...essay('ＣＡＦÉ notes', 'Plain prose'),
      content: {
        version: 1,
        blocks: [
          { id: 'list', type: 'bulletList', items: ['A 100%_literal marker', 'القراءة والتفكير'] },
          { id: 'code', type: 'code', text: "const idea = 'research';" },
        ],
      },
    })
    for (const q of ['café', '100%_literal', 'القراءة', "'research'"]) {
      const response = await client.get('/api/v1/articles').qs({ q })
      response.assertStatus(200)
      assert.deepEqual(
        response.body().data.map((row: { id: number }) => row.id),
        [article.id],
      )
      assert.notInclude(JSON.stringify(response.body().data), 'searchText')
      assert.notInclude(JSON.stringify(response.body().data), 'contentJson')
    }
    for (const q of [
      'blockProgress',
      'bulletList',
      "' OR 1=1 --",
      'writer@example.com',
      'unmatched',
    ]) {
      ;(await client.get('/api/v1/articles').qs({ q })).assertBodyContains({ data: [] })
    }
    ;(await client.get('/api/v1/articles').qs({ q: 'café', language: 'ar' })).assertBodyContains({
      data: [],
    })
  })

  test('draft changes cannot enter search until published and withdrawal removes results', async ({
    client,
    assert,
  }) => {
    const writer = await account('writer@example.com')
    const publishing = await app.container.make(ArticlePublishingService)
    const article = await publish(writer, essay('Public title', 'Original visible text'))
    await publishing.update(
      article.id,
      writer.id,
      1,
      essay('Secret draft title', 'Confidential wording', 'ar'),
    )
    ;(await client.get('/api/v1/articles').qs({ q: 'Confidential' })).assertBodyContains({
      data: [],
    })
    const old = await client.get('/api/v1/articles').qs({ q: 'visible', language: 'en' })
    assert.equal(old.body().data[0].id, article.id)
    await publishing.publish(article.id, writer.id, 2)
    ;(await client.get('/api/v1/articles').qs({ q: 'visible' })).assertBodyContains({ data: [] })
    const updated = await client
      .get('/api/v1/articles')
      .qs({ q: 'Confidential', language: 'ar', authorId: writer.id })
    assert.equal(updated.body().data[0].id, article.id)
    await publishing.unpublish(article.id, writer.id, 3)
    ;(await client.get('/api/v1/articles').qs({ q: 'Confidential' })).assertBodyContains({
      data: [],
    })
  })

  test('validates discovery inputs and filters following pagination by the authenticated reader', async ({
    client,
    assert,
  }) => {
    const reader = await account('reader@example.com')
    const writers = await Promise.all(['one', 'two'].map((name) => account(`${name}@example.com`)))
    for (const writer of writers) {
      ;(
        await client.put(`/api/v1/account/writers/${writer.id}/follow`).loginAs(reader)
      ).assertStatus(200)
    }
    const list = await client.get('/api/v1/account/following').loginAs(reader).qs({ perPage: 1 })
    assert.equal(list.body().data[0].writer.id, writers[1].id)
    assert.include(list.body().metadata.nextPageUrl, 'perPage=1')
    ;(await client.get('/api/v1/account/following').loginAs(writers[0])).assertBodyContains({
      data: [],
    })
    for (const query of [
      { q: 'x' },
      { q: 'x'.repeat(201) },
      { language: 'fr' },
      { perPage: 51 },
      { authorId: -1 },
    ]) {
      const queryString = new URLSearchParams(
        Object.entries(query).map<[string, string]>(([key, value]) => [key, String(value)]),
      ).toString()
      ;(await client.get(`/api/v1/articles?${queryString}`)).assertStatus(422)
      ;(await client.get(`/api/v1/account/feed?${queryString}`).loginAs(reader)).assertStatus(422)
    }
    ;(await client.put('/api/v1/account/writers/999999/follow').loginAs(reader)).assertStatus(404)
    ;(await client.put('/api/v1/account/writers/bad/follow').loginAs(reader)).assertStatus(422)
  })
})

test.group('Following concurrency', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  test('concurrent follows create one relationship and deleting a writer removes it', async ({
    client,
    assert,
  }) => {
    const reader = await account('reader@example.com')
    const writer = await account('writer@example.com')
    const path = `/api/v1/account/writers/${writer.id}/follow`
    const results = await Promise.all([
      client.put(path).loginAs(reader),
      client.put(path).loginAs(reader),
    ])
    results.forEach((response) => response.assertStatus(200))
    assert.lengthOf(await Follow.all(), 1)
    await writer.delete()
    assert.isEmpty(await Follow.all())
  })
})
