import { Bouncer } from '@adonisjs/bouncer'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import Article from '#models/article'
import ArticleReference from '#models/article_reference'
import ArticleRevision from '#models/article_revision'
import Resource from '#models/resource'
import User from '#models/user'
import ArticlePolicy from '#policies/article_policy'
import ProfilePolicy from '#policies/profile_policy'

test.group('Publishing foundation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('updates only the signed-in account and keeps preferences private', async ({
    client,
    assert,
  }) => {
    const owner = await User.create({ email: 'owner@example.com', password: 'password123' })
    const other = await User.create({
      email: 'other@example.com',
      password: 'password123',
      fullName: 'Other',
    })

    const result = await client.patch('/api/v1/account/profile').loginAs(owner).json({
      fullName: ' كاتب عربي ',
      bio: 'Essays عن الأفكار',
      interfaceLanguage: 'ar',
      readingLanguage: 'both',
      id: other.id,
      email: 'injected@example.com',
      password: 'injected-password',
    })
    result.assertStatus(200)
    result.assertBodyContains({
      data: {
        id: owner.id,
        fullName: 'كاتب عربي',
        bio: 'Essays عن الأفكار',
        interfaceLanguage: 'ar',
        readingLanguage: 'both',
        email: 'owner@example.com',
      },
    })
    await other.refresh()
    assert.equal(other.fullName, 'Other')
    assert.equal((await User.verifyCredentials('owner@example.com', 'password123')).id, owner.id)

    const profile = await client.get('/api/v1/account/profile').loginAs(owner)
    profile.assertBodyContains({ data: { interfaceLanguage: 'ar', readingLanguage: 'both' } })
    assert.notProperty(profile.body().data, 'password')

    const publicProfile = await client.get(`/api/v1/writers/${owner.id}`)
    publicProfile.assertStatus(200)
    publicProfile.assertBody({
      data: { id: owner.id, fullName: 'كاتب عربي', bio: 'Essays عن الأفكار' },
    })
  })

  test('validates preferences and supports partial updates and clearing optional text', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      email: 'preferences@example.com',
      password: 'password123',
      fullName: 'Writer',
    })
    for (const payload of [
      { interfaceLanguage: 'fr' },
      { readingLanguage: 'de' },
      { readingLanguage: [] },
      { fullName: 'x'.repeat(121) },
      { bio: 'x'.repeat(2001) },
    ]) {
      const result = await client.patch('/api/v1/account/profile').loginAs(user).json(payload)
      assert.equal(result.status(), 422, JSON.stringify(payload))
      assert.property(result.body(), 'errors')
    }
    const ignored = await client
      .patch('/api/v1/account/profile')
      .loginAs(user)
      .json({ interfaceLanguage: null })
    ignored.assertStatus(200)
    ignored.assertBodyContains({ data: { interfaceLanguage: 'en' } })
    const updated = await client
      .patch('/api/v1/account/profile')
      .loginAs(user)
      .json({ readingLanguage: 'ar' })
    updated.assertStatus(200)
    updated.assertBodyContains({
      data: { fullName: 'Writer', interfaceLanguage: 'en', readingLanguage: 'ar' },
    })
    const blank = await client.patch('/api/v1/account/profile').loginAs(user).json({ bio: ' ' })
    blank.assertStatus(200)
    blank.assertBodyContains({ data: { bio: null } })
    const cleared = await client
      .patch('/api/v1/account/profile')
      .loginAs(user)
      .json({ fullName: null, bio: null })
    cleared.assertStatus(200)
    cleared.assertBodyContains({ data: { fullName: null, bio: null, readingLanguage: 'ar' } })
  })

  test('rejects guests and invalid or missing public profile identifiers', async ({ client }) => {
    const guest = await client.patch('/api/v1/account/profile').json({ fullName: 'Nobody' })
    guest.assertStatus(401)
    const invalid = await client.get('/api/v1/writers/not-an-id')
    invalid.assertStatus(422)
    const missing = await client.get('/api/v1/writers/2147483647')
    missing.assertStatus(404)
  })

  test('returns account defaults immediately after signup', async ({ client, assert }) => {
    const result = await client.post('/api/v1/auth/signup').json({
      fullName: 'Reader',
      email: 'defaults@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })
    result.assertStatus(200)
    result.assertBodyContains({
      data: { user: { bio: null, interfaceLanguage: 'en', readingLanguage: 'both' } },
    })
    assert.notProperty(result.body().data.user, 'password')
  })

  test('ownership policies reject other users and guests', async ({ assert }) => {
    const owner = await User.create({ email: 'policy-owner@example.com', password: 'password123' })
    const other = await User.create({ email: 'policy-other@example.com', password: 'password123' })
    const article = await Article.create({ authorId: owner.id })
    const ownerBouncer = new Bouncer(owner)
    const otherBouncer = new Bouncer(other)
    const guestBouncer = new Bouncer<User>(null)
    assert.isTrue(await ownerBouncer.with(ProfilePolicy).allows('update', owner))
    assert.isFalse(await otherBouncer.with(ProfilePolicy).allows('update', owner))
    assert.isFalse(await guestBouncer.with(ProfilePolicy).allows('update', owner))
    for (const action of ['update', 'delete'] as const) {
      assert.isTrue(await ownerBouncer.with(ArticlePolicy).allows(action, article))
      assert.isFalse(await otherBouncer.with(ArticlePolicy).allows(action, article))
      assert.isFalse(await guestBouncer.with(ArticlePolicy).allows(action, article))
    }
  })

  test('keeps reference context per revision while sharing the source', async ({ assert }) => {
    const user = await User.create({ email: 'references@example.com', password: 'password123' })
    const article = await Article.create({ authorId: user.id })
    const first = await article.related('revisions').create({
      revisionNumber: 1,
      title: 'مقال',
      language: 'ar',
      contentJson: '{"version":1,"blocks":[]}',
    })
    const second = await article.related('revisions').create({
      revisionNumber: 2,
      title: 'Essay',
      language: 'en',
      contentJson: '{"version":1,"blocks":[]}',
    })
    const resource = await Resource.create({
      url: 'https://www.youtube.com/watch?v=example',
      kind: 'video',
    })
    await resource.refresh()
    assert.equal(resource.displayPolicy, 'metadata')
    assert.equal(resource.processingStatus, 'pending')
    const reference = await first.related('references').create({
      resourceId: resource.id,
      blockId: 'paragraph-1',
      referenceKey: 'source-1',
      commentary: 'Original context',
      videoStartSeconds: 272,
    })
    await second.related('references').create({
      resourceId: resource.id,
      blockId: 'paragraph-1',
      referenceKey: 'source-1',
      commentary: 'Revised context',
      videoStartSeconds: 300,
    })
    await first.load('references', (query) => query.preload('resource'))
    assert.equal(first.references[0].commentary, 'Original context')
    assert.equal(first.references[0].resource.id, resource.id)
    await article.load('author')
    assert.equal(article.author.id, user.id)

    await assert.rejects(() =>
      ArticleRevision.create({
        articleId: article.id,
        revisionNumber: 1,
        title: 'Duplicate',
        language: 'en',
        contentJson: '{}',
      }),
    )
    await assert.rejects(() =>
      ArticleReference.create({
        articleRevisionId: first.id,
        resourceId: resource.id,
        blockId: 'paragraph-2',
        referenceKey: 'source-1',
      }),
    )
    await assert.rejects(() =>
      ArticleReference.create({
        articleRevisionId: first.id,
        resourceId: resource.id,
        blockId: 'paragraph-2',
        referenceKey: 'negative',
        videoStartSeconds: -1,
      }),
    )
    await assert.rejects(() => Resource.create({ url: resource.url }))
    await assert.rejects(() => resource.delete())
    await article.delete()
    assert.isNull(await ArticleRevision.find(first.id))
    assert.isNull(await ArticleReference.find(reference.id))
    assert.isNotNull(await Resource.find(resource.id))
  })
})
