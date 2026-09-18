import { isIP } from 'node:net'

import ipaddr from 'ipaddr.js'

import ResourceFetchException from '#exceptions/resource_fetch_exception'

const youtubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
])

export default class ResourceUrlService {
  isPublicAddress(address: string) {
    try {
      // Mapped IPv4, transition networks, loopback, link-local and reserved ranges are excluded.
      return ipaddr.parse(address).range() === 'unicast'
    } catch {
      return false
    }
  }

  validate(input: string) {
    let url: URL
    try {
      url = new URL(input)
    } catch {
      throw new ResourceFetchException('invalid_url')
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (
      input.length > 2048 ||
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      hostname.endsWith('.') ||
      !hostname.includes('.') ||
      hostname === 'localhost' ||
      /\.(localhost|local|internal|test|invalid|onion)$/.test(hostname) ||
      (isIP(hostname) && !this.isPublicAddress(hostname))
    ) {
      throw new ResourceFetchException('unsafe_url')
    }
    return url
  }

  normalize(input: string) {
    const url = this.validate(input)
    let videoId: string | null = null
    let suggestedStartSeconds: number | null = null
    if (youtubeHosts.has(url.hostname)) {
      const parts = url.pathname.split('/').filter(Boolean)
      videoId =
        url.hostname === 'youtu.be'
          ? parts[0]
          : url.pathname === '/watch'
            ? url.searchParams.get('v')
            : ['embed', 'shorts', 'live'].includes(parts[0])
              ? parts[1]
              : null
      if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
        throw new ResourceFetchException('invalid_youtube_url')
      }
      const time =
        url.searchParams.get('t') ??
        url.searchParams.get('start') ??
        new URLSearchParams(url.hash.slice(1)).get('t')
      if (time) {
        const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time)
        const seconds = /^\d+$/.test(time)
          ? Number(time)
          : match
            ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
            : NaN
        if (Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 604800) {
          suggestedStartSeconds = seconds
        }
      }
      return { url: `https://www.youtube.com/watch?v=${videoId}`, videoId, suggestedStartSeconds }
    }
    url.hash = ''
    // Preserve functional queries (including signed URLs); strip only known tracking fields.
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key)) {
        url.searchParams.delete(key)
      }
    }
    return { url: url.href, videoId, suggestedStartSeconds }
  }
}
