import app from '@adonisjs/core/services/app'
import config from '@adonisjs/core/services/config'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { QueueManager, Worker } from '@adonisjs/queue'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import queueConfig from '#config/queue'
import ResourceFetchException from '#exceptions/resource_fetch_exception'
import ProcessResource from '#jobs/process_resource'
import Resource from '#models/resource'
import User from '#models/user'
import ResourceIngestionService from '#services/resource_ingestion_service'
import ResourceProcessingService from '#services/resource_processing_service'
import SafeResourceHttpService from '#services/safe_resource_http_service'
import ResourceTransformer from '#transformers/resource_transformer'

import type { ResourceHttpResponse } from '#services/safe_resource_http_service'

const account = (email = 'sources@example.com') => User.create({ email, password: 'password123' })
const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

function fakeHttp(reply: Partial<ResourceHttpResponse> | Error, seen: string[] = []) {
  app.container.swap(
    SafeResourceHttpService,
    () =>
      ({
        async get(url: string) {
          seen.push(url)
          if (reply instanceof Error) {
            throw reply
          }
          return {
            url: 'https://example.com/essay',
            status: 200,
            contentType: 'text/html',
            body: '',
            ...reply,
          }
        },
      }) as SafeResourceHttpService,
  )
}

test.group('Resource processing', (group) => {
  group.each.setup(() => {
    QueueManager.fake()
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => {
    QueueManager.restore()
    app.container.restore(SafeResourceHttpService)
    config.set('resources.approvedSources', [])
  })

  test('ingests once, queues a video, protects private access, and returns each timestamp', async ({
    client,
    assert,
  }) => {
    const user = await account()
    const other = await account('other-sources@example.com')
    const guest = await client.post('/api/v1/account/resources').json({ url: videoUrl })
    guest.assertStatus(401)
    const first = await client
      .visit('profile.resources.store')
      .loginAs(user)
      .json({ url: 'https://youtu.be/dQw4w9WgXcQ?t=272' })
    first.assertStatus(202)
    first.assertBodyContains({
      suggestedStartSeconds: 272,
      data: { processingStatus: 'pending', playback: null },
    })
    const id = first.body().data.id
    const denied = await client.get(`/api/v1/account/resources/${id}`).loginAs(other)
    denied.assertStatus(404)
    const second = await client
      .visit('profile.resources.store')
      .loginAs(user)
      .json({ url: videoUrl })
    assert.equal(second.body().data.id, id)
    assert.isNull(second.body().suggestedStartSeconds)
    const rows = await Resource.all()
    assert.lengthOf(rows, 1)
    const access = await db.from('resource_accesses').count('* as total').first()
    assert.equal(Number(access.total), 1)
    const read = await client.get(`/api/v1/account/resources/${id}`).loginAs(user)
    read.assertStatus(200)
    read.assertHeader('cache-control', 'private, no-store')
    const invalid = await client
      .visit('profile.resources.store')
      .loginAs(user)
      .json({ url: 'http://127.0.0.1' })
    invalid.assertStatus(422)
  })

  test('fetches only official oEmbed and supplies an approved non-autoplay player', async ({
    assert,
  }) => {
    const seen: string[] = []
    fakeHttp(
      {
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'A thoughtful video',
          author_name: 'Author',
          html: '<script>bad()</script>',
        }),
      },
      seen,
    )
    const resource = await Resource.create({ url: videoUrl })
    await resource.refresh()
    const processing = await app.container.make(ResourceProcessingService)
    await processing.process(resource.id, 1)
    await resource.refresh()
    assert.equal(resource.processingStatus, 'ready')
    assert.equal(resource.title, 'A thoughtful video')
    assert.equal(resource.providerId, 'dQw4w9WgXcQ')
    assert.include(seen[0], 'https://www.youtube.com/oembed?')
    const output = new ResourceTransformer(resource).toObject()
    assert.equal(
      output.playback?.embedUrl,
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&autoplay=0',
    )
    assert.isNull(output.contentText)
    assert.notInclude(JSON.stringify(output), '<script>')
    await processing.process(resource.id, 1)
    assert.lengthOf(seen, 1)
  })

  test('defaults research HTML to metadata and extracts text only with current permission', async ({
    assert,
  }) => {
    const paragraph =
      'This is an extended thoughtful essay about research, reading, and understanding ideas. '.repeat(
        30,
      )
    fakeHttp({
      body: `<html lang="ar"><head><title>بحث</title><meta name="citation_doi" content="10.1/demo"><meta name="description" content="Preview"></head><body><article><h1>بحث</h1><p>${paragraph}</p><script>alert('bad')</script></article></body></html>`,
    })
    const resource = await Resource.create({ url: 'https://example.com/essay' })
    const processing = await app.container.make(ResourceProcessingService)
    await processing.process(resource.id, 1)
    await resource.refresh()
    assert.equal(resource.kind, 'research')
    assert.equal(resource.processingStatus, 'limited')
    assert.equal(resource.displayPolicy, 'metadata')
    assert.isNull(resource.contentText)
    config.set('resources.approvedSources', [
      { origin: 'https://example.com', evidence: 'Written permission #123' },
    ])
    await resource.merge({ processingStatus: 'pending', processingGeneration: 2 }).save()
    await processing.process(resource.id, 2)
    await resource.refresh()
    assert.equal(resource.displayPolicy, 'full_content')
    assert.include(resource.contentText!, 'thoughtful essay')
    assert.notInclude(resource.contentText!, "alert('bad')")
    assert.equal(
      new ResourceTransformer(resource).toObject().rightsEvidence,
      'Written permission #123',
    )
    config.set('resources.approvedSources', [])
    assert.isNull(new ResourceTransformer(resource).toObject().contentText)
  })

  test('uses final origin for permission and honors restricted previews and PDF fallbacks', async ({
    assert,
  }) => {
    config.set('resources.approvedSources', [
      { origin: 'https://example.com', evidence: 'Permission' },
    ])
    const resource = await Resource.create({ url: 'https://example.com/source' })
    fakeHttp({
      url: 'https://another.example/essay',
      body: '<html><head><title>Elsewhere</title></head><body><article>Text</article></body></html>',
    })
    await (await app.container.make(ResourceProcessingService)).process(resource.id, 1)
    await resource.refresh()
    assert.equal(resource.displayPolicy, 'metadata')
    await resource.merge({ processingStatus: 'pending', processingGeneration: 2 }).save()
    fakeHttp({
      body: '<html><head><meta name="robots" content="nosnippet"><meta name="description" content="secret"></head></html>',
    })
    await (await app.container.make(ResourceProcessingService)).process(resource.id, 2)
    await resource.refresh()
    assert.isNull(resource.description)
    assert.equal(resource.failureCode, 'preview_restricted')
    await resource.merge({ processingStatus: 'pending', processingGeneration: 3 }).save()
    fakeHttp({ contentType: 'application/pdf', body: '' })
    await (await app.container.make(ResourceProcessingService)).process(resource.id, 3)
    await resource.refresh()
    assert.equal(resource.kind, 'pdf')
    assert.equal(resource.failureCode, 'pdf_preview_only')
  })

  test('caches results, refreshes expired ones, and rejects stale job writes', async ({
    assert,
  }) => {
    const user = await account()
    const service = await app.container.make(ResourceIngestionService)
    const resource = await Resource.create({
      url: videoUrl,
      processingStatus: 'ready',
      expiresAt: DateTime.utc().plus({ hours: 1 }),
    })
    await resource.refresh()
    const cached = await service.ingest(user.id, videoUrl)
    assert.equal(cached.resource.processingStatus, 'ready')
    await resource.merge({ expiresAt: DateTime.utc().minus({ minutes: 1 }) }).save()
    await service.refresh(resource)
    assert.equal(resource.processingStatus, 'pending')
    assert.equal(resource.processingGeneration, 2)
    const seen: string[] = []
    fakeHttp({}, seen)
    const processing = await app.container.make(ResourceProcessingService)
    await processing.process(resource.id, 1)
    await processing.fail(resource.id, 1)
    assert.isEmpty(seen)
    await resource.refresh()
    assert.equal(resource.processingStatus, 'pending')
  })

  test('distinguishes permanent failure from retryable failure and final retry exhaustion', async ({
    assert,
  }) => {
    const resource = await Resource.create({ url: videoUrl })
    fakeHttp({ status: 404 })
    await (await app.container.make(ResourceProcessingService)).process(resource.id, 1)
    await resource.refresh()
    assert.equal(resource.processingStatus, 'failed')
    assert.equal(resource.failureCode, 'not_found')
    await resource.merge({ processingStatus: 'pending', processingGeneration: 2 }).save()
    fakeHttp(new ResourceFetchException('timeout', true))
    const processing = await app.container.make(ResourceProcessingService)
    await assert.rejects(() => processing.process(resource.id, 2))
    await resource.refresh()
    assert.equal(resource.processingStatus, 'pending')
    await processing.fail(resource.id, 2, 'timeout')
    await resource.refresh()
    assert.equal(resource.processingStatus, 'failed')
    assert.equal(resource.failureCode, 'timeout')
    assert.isAbove(resource.expiresAt!.toMillis(), Date.now())
  })
})

test.group('Durable resource dispatch', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('database queue deduplicates concurrent ingestion and recovery repairs an orphan', async ({
    assert,
  }) => {
    const user = await account()
    const service = await app.container.make(ResourceIngestionService)
    const results = await Promise.all([
      service.ingest(user.id, videoUrl),
      service.ingest(user.id, 'https://youtu.be/dQw4w9WgXcQ?t=30'),
    ])
    assert.equal(results[0].resource.id, results[1].resource.id)
    let jobs = await db.from('queue_jobs').select('*')
    assert.lengthOf(jobs, 1)
    assert.include(JSON.parse(jobs[0].data).name, 'ProcessResource')
    await db.from('queue_jobs').delete()
    const resource = results[0].resource
    await Resource.query()
      .where('id', resource.id)
      .update({ updatedAt: DateTime.utc().minus({ minutes: 5 }).toSQL() })
    await service.recover()
    jobs = await db.from('queue_jobs').select('*')
    assert.lengthOf(jobs, 1)
    await service.dispatch(resource)
    assert.lengthOf(await db.from('queue_jobs').select('*'), 1)
    assert.equal(ProcessResource.options.maxRetries, 3)
  })
})

test('real database worker processes metadata and exhausts transient retries', async ({
  assert,
  cleanup,
}) => {
  await testUtils.db().truncate()
  cleanup(() => app.container.restore(SafeResourceHttpService))
  const driver = queueConfig.adapters.database
  const database = typeof driver === 'function' ? driver : await driver.resolver(app)
  const worker = new Worker({
    ...queueConfig,
    adapters: { database },
    autoLoadJobs: false,
    jobFactory: (jobClass) => app.container.make(jobClass),
  })
  cleanup(() => worker.stop())
  await worker.init()
  await QueueManager.loadJobs()
  const user = await account()
  fakeHttp({
    contentType: 'application/json',
    body: JSON.stringify({ title: 'From worker', author_name: 'Author' }),
  })
  const service = await app.container.make(ResourceIngestionService)
  const { resource } = await service.ingest(user.id, videoUrl)
  assert.equal((await worker.processCycle(['default']))?.type, 'started')
  assert.equal((await worker.processCycle(['default']))?.type, 'completed')
  await resource.refresh()
  assert.equal(resource.title, 'From worker')
  assert.equal(resource.processingStatus, 'ready')
  assert.isEmpty(await db.from('queue_jobs').select('*'))

  fakeHttp(new ResourceFetchException('timeout', true))
  await resource.merge({ expiresAt: DateTime.utc().minus({ days: 1 }) }).save()
  await service.refresh(resource)
  for (let attempt = 0; attempt < 4; attempt++) {
    // Move delayed work forward without sleeping; keep the real retry/worker path.
    await db
      .from('queue_jobs')
      .where('status', 'delayed')
      .update({ execute_at: Date.now() - 1000 })
    assert.equal((await worker.processCycle(['default']))?.type, 'started')
    assert.equal((await worker.processCycle(['default']))?.type, 'completed')
    await resource.refresh()
    assert.equal(resource.processingStatus, attempt < 3 ? 'pending' : 'failed')
  }
  assert.equal(resource.failureCode, 'timeout')
})
