import { mkdtemp, rm, stat, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { test } from '@japa/runner'
import Database from 'better-sqlite3'

import Article from '#models/article'
import ArticleReport from '#models/article_report'
import User from '#models/user'
import ArticlePublishingService from '#services/article_publishing_service'
import DatabaseBackupService from '#services/database_backup_service'
import ModerationService from '#services/moderation_service'

const input = {
  title: 'A reported essay',
  language: 'en' as const,
  content: {
    version: 1 as const,
    blocks: [{ id: 'intro', type: 'paragraph' as const, text: 'Published text' }],
  },
}

test.group('Beta protections', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear(['memory'])
    return () => limiter.clear(['memory'])
  })
  test('reports are private, authenticated, validated, and idempotent', async ({
    client,
    assert,
  }) => {
    const author = await User.create({
      email: 'author@beta.test',
      password: 'password123',
    })
    const reader = await User.create({
      email: 'reader@beta.test',
      password: 'password123',
    })
    const publishing = await app.container.make(ArticlePublishingService)
    const draft = await publishing.create(author.id, input)
    const path = `/api/v1/account/articles/${draft.id}/reports`
    ;(await client.post(path).json({ reason: 'spam' })).assertStatus(401)
    ;(await client.post(path).loginAs(reader).json({ reason: 'spam' })).assertStatus(404)
    await publishing.publish(draft.id, author.id, 0)
    ;(await client.post(path).loginAs(reader).json({ reason: 'invalid' })).assertStatus(422)
    for (let i = 0; i < 2; i++) {
      const response = await client.post(path).loginAs(reader).json({
        reason: 'spam',
        details: 'Private report',
        reporterId: author.id,
        status: 'removed',
      })
      response.assertStatus(200)
      response.assertHeader('cache-control', 'private, no-store')
      assert.notInclude(JSON.stringify(response.body()), 'Private report')
    }
    const reports = await ArticleReport.all()
    assert.lengthOf(reports, 1)
    assert.equal(reports[0].reporterId, reader.id)
    assert.equal(reports[0].status, 'pending')
  })
  test('removal hides publication and blocks republishing, while dismissal preserves publication', async ({
    client,
    assert,
  }) => {
    const author = await User.create({
      email: 'author@beta.test',
      password: 'password123',
    })
    const publishing = await app.container.make(ArticlePublishingService)
    const moderation = await app.container.make(ModerationService)
    const draft = await publishing.create(author.id, input)
    const article = await publishing.publish(draft.id, author.id, 0)
    const report = await ArticleReport.create({
      articleId: article.id,
      reporterId: author.id,
      revisionId: article.publishedRevisionId!,
      reason: 'copyright',
      status: 'pending',
    })
    await moderation.resolve(
      report.id,
      'removed',
      'operator@example.test',
      'Removal following review',
    )
    ;(await client.get(`/api/v1/articles/${article.id}`)).assertStatus(404)
    ;(await client.get('/api/v1/articles')).assertBodyContains({ data: [] })
    ;(
      await client.get(`/api/v1/account/articles/${article.id}`).loginAs(author)
    ).assertBodyContains({
      data: { removalReason: 'Removal following review' },
    })
    const removed = await Article.findOrFail(article.id)
    ;(
      await client
        .post(`/api/v1/account/articles/${article.id}/publish`)
        .loginAs(author)
        .json({ expectedVersion: article.lockVersion })
    ).assertStatus(409)
    ;(
      await client
        .post(`/api/v1/account/articles/${article.id}/publish`)
        .loginAs(author)
        .json({ expectedVersion: removed.lockVersion })
    ).assertStatus(403)
    await assert.rejects(() => moderation.resolve(report.id, 'dismissed', 'operator', 'Duplicate'))
    const second = await publishing.create(author.id, input)
    const live = await publishing.publish(second.id, author.id, 0)
    const another = await ArticleReport.create({
      articleId: live.id,
      reporterId: author.id,
      revisionId: live.publishedRevisionId!,
      reason: 'other',
      status: 'pending',
    })
    await moderation.resolve(another.id, 'dismissed', 'operator', 'No violation')
    ;(await client.get(`/api/v1/articles/${live.id}`)).assertStatus(200)
  })
  test('auth rate limit returns 429 and retry headers', async ({ client }) => {
    // Reset only this limiter key, leaving the middleware active for every request.
    const store = limiter.use({ requests: 20, duration: '15 minutes' })
    await store.delete('auth:127.0.0.1')
    await store.delete('auth:::1')
    let limited = false
    for (let i = 0; i < 21; i++) {
      const response = await client
        .post('/api/v1/auth/login')
        .json({ email: 'missing@beta.test', password: 'wrong' })
      if (response.status() === 429) {
        response.assertHeader('retry-after')
        limited = true
        break
      }
    }
    if (!limited) {
      throw new Error('Authentication requests were not limited')
    }
  })
  test('health endpoints return minimal uncached readiness', async ({ client, assert }) => {
    const live = await client.get('/health/live')
    live.assertStatus(200)
    live.assertBody({ status: 'ok' })
    const ready = await client.get('/health/ready')
    ready.assertStatus(200)
    ready.assertHeader('cache-control', 'no-store')
    assert.deepEqual(Object.keys(ready.body()).sort(), ['healthy', 'status'])
  })
})

test('SQLite online backup restores committed data and refuses overwrite', async ({
  assert,
  cleanup,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'beta-backup-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  const source = join(directory, 'source.sqlite3')
  const backup = join(directory, 'backup.sqlite3')
  const restored = join(directory, 'restored.sqlite3')
  const database = new Database(source)
  cleanup(() => {
    database.close()
  })
  database.pragma('journal_mode = WAL')
  database.exec("CREATE TABLE evidence (value TEXT); INSERT INTO evidence VALUES ('retained')")
  const service = await app.container.make(DatabaseBackupService)
  await service.create(source, backup)
  assert.equal((await stat(backup)).mode & 0o777, 0o600)
  database.exec('DELETE FROM evidence')
  await copyFile(backup, restored)
  const copy = new Database(restored, { readonly: true })
  try {
    assert.deepEqual(copy.prepare('SELECT value FROM evidence').all(), [{ value: 'retained' }])
    assert.equal(copy.pragma('integrity_check', { simple: true }), 'ok')
  } finally {
    copy.close()
  }
  await assert.rejects(() => service.create(source, backup))
  await assert.rejects(() => service.create(source, source))
})

test('database-backed limiter shares counters between instances', async ({ assert, cleanup }) => {
  const first = limiter.use('database', { requests: 1, duration: '1 minute' })
  const second = limiter.use('database', { requests: 1, duration: '1 minute' })
  const key = `beta-durable-${crypto.randomUUID()}`
  cleanup(async () => {
    await first.delete(key)
  })
  await first.consume(key)
  await assert.rejects(() => second.consume(key))
})
