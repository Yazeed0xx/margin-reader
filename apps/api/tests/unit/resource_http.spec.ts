import { EventEmitter } from 'node:events'
import http from 'node:http'
import { Readable } from 'node:stream'
import { mock } from 'node:test'

import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import SafeResourceHttpService from '#services/safe_resource_http_service'

// Stub the socket transport, preserving the production URL/redirect/body handling.
function transport(
  replies: { status?: number; headers?: Record<string, string>; body?: string }[],
  seen: URL[],
) {
  return mock.method(
    http,
    'get',
    (url: URL, options: http.RequestOptions, callback: (response: unknown) => void) => {
      seen.push(url)
      const reply = replies.shift()!
      const response = Readable.from([Buffer.from(reply.body ?? '')])
      Object.assign(response, {
        statusCode: reply.status ?? 200,
        headers: reply.headers ?? { 'content-type': 'text/html' },
      })
      queueMicrotask(() => callback(response))
      if (!options.lookup || options.family !== 4 || options.agent !== false) {
        throw new Error('DNS pinning missing')
      }
      return new EventEmitter()
    },
  )
}

test('fetcher validates redirects before requesting their destination', async ({
  assert,
  cleanup,
}) => {
  const seen: URL[] = []
  const stub = transport(
    [{ status: 302, headers: { location: 'http://169.254.169.254/latest' } }],
    seen,
  )
  cleanup(() => stub.mock.restore())
  const service = await app.container.make(SafeResourceHttpService)
  service.resolve = async () => ({ address: '93.184.216.34', family: 4 })
  await assert.rejects(
    () => service.get('http://example.com'),
    'This source could not be fetched safely.',
  )
  assert.lengthOf(seen, 1)
})

test('fetcher follows public relative redirects and bounds response bodies', async ({
  assert,
  cleanup,
}) => {
  const seen: URL[] = []
  const stub = transport(
    [
      { status: 302, headers: { location: '/article' } },
      { body: '<title>Article</title>' },
      { body: 'x'.repeat(1_500_001) },
    ],
    seen,
  )
  cleanup(() => stub.mock.restore())
  const service = await app.container.make(SafeResourceHttpService)
  service.resolve = async () => ({ address: '93.184.216.34', family: 4 })
  const result = await service.get('http://example.com')
  assert.equal(result.url, 'http://example.com/article')
  assert.equal(result.body, '<title>Article</title>')
  await assert.rejects(() => service.get('http://example.com/large'))
  assert.lengthOf(seen, 3)
})

test('fetcher stops redirect loops and skips downloading PDF bodies', async ({
  assert,
  cleanup,
}) => {
  const seen: URL[] = []
  const stub = transport(
    [
      ...Array.from({ length: 4 }, () => ({ status: 302, headers: { location: '/loop' } })),
      { headers: { 'content-type': 'application/pdf' }, body: 'not downloaded' },
    ],
    seen,
  )
  cleanup(() => stub.mock.restore())
  const service = await app.container.make(SafeResourceHttpService)
  service.resolve = async () => ({ address: '93.184.216.34', family: 4 })
  await assert.rejects(() => service.get('http://example.com/loop'))
  const pdf = await service.get('http://example.com/paper.pdf')
  assert.equal(pdf.body, '')
  assert.equal(pdf.contentType, 'application/pdf')
  assert.lengthOf(seen, 5)
})
