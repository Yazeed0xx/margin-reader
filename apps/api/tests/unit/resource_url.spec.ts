import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import ResourceUrlService from '#services/resource_url_service'
import SafeResourceHttpService from '#services/safe_resource_http_service'

test('normalizes YouTube URLs while keeping citation timestamps separate', async ({ assert }) => {
  const urls = await app.container.make(ResourceUrlService)
  for (const url of [
    'https://youtu.be/dQw4w9WgXcQ?t=4m32s',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=272',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ?start=272',
    'https://www.youtube.com/embed/dQw4w9WgXcQ#t=272',
  ]) {
    assert.deepEqual(urls.normalize(url), {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      suggestedStartSeconds: 272,
    })
  }
  assert.equal(
    urls.normalize('https://example.com/p?a=1&utm_source=x#part').url,
    'https://example.com/p?a=1',
  )
  assert.equal(
    urls.normalize('https://example.com/p?sig=x%20y').url,
    'https://example.com/p?sig=x%20y',
  )
  assert.isNull(urls.normalize('https://youtu.be/dQw4w9WgXcQ?t=999999999999').suggestedStartSeconds)
})

test('rejects unsafe URLs and deceptive YouTube providers', async ({ assert }) => {
  const urls = await app.container.make(ResourceUrlService)
  for (const input of [
    'file:///etc/passwd',
    'http://127.1',
    'http://2130706433',
    'http://[::1]',
    'https://user:pass@example.com',
    'http://169.254.169.254/latest',
    'http://10.0.0.1',
    'http://example.com:8080',
    'http://printer.local',
    'https://www.youtube.com/watch?v=bad',
  ]) {
    assert.throws(() => urls.normalize(input))
  }
  assert.isNull(urls.normalize('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ').videoId)
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ]) {
    assert.isFalse(urls.isPublicAddress(ip), ip)
  }
  assert.isTrue(urls.isPublicAddress('8.8.8.8'))
  assert.isTrue(urls.isPublicAddress('2606:4700:4700::1111'))
})

test('fetcher rejects private DNS results before opening a connection', async ({ assert }) => {
  const http = await app.container.make(SafeResourceHttpService)
  await assert.rejects(() => http.resolve('localhost'), 'This source could not be fetched safely.')
})
