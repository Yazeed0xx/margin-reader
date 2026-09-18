import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'

import { inject } from '@adonisjs/core'

import ResourceFetchException from '#exceptions/resource_fetch_exception'
import ResourceUrlService from '#services/resource_url_service'

export interface ResourceHttpResponse {
  url: string
  status: number
  contentType: string
  body: string
}

@inject()
export default class SafeResourceHttpService {
  constructor(private urls: ResourceUrlService) {}

  async resolve(hostname: string) {
    const records = await lookup(hostname.replace(/^\[|\]$/g, ''), { all: true, verbatim: true })
    if (!records.length || records.some((record) => !this.urls.isPublicAddress(record.address))) {
      throw new ResourceFetchException('unsafe_address')
    }
    return records[0]
  }

  async get(input: string): Promise<ResourceHttpResponse> {
    const signal = AbortSignal.timeout(12000)
    let current = input
    try {
      for (let hop = 0; hop <= 3; hop++) {
        signal.throwIfAborted()
        const url = this.urls.validate(current)
        const address = await Promise.race([
          this.resolve(url.hostname),
          new Promise<never>((_, reject) =>
            signal.addEventListener(
              'abort',
              () => reject(new ResourceFetchException('timeout', true)),
              { once: true },
            ),
          ),
        ])
        signal.throwIfAborted()
        const result = await this.request(url, address, signal)
        if (result.location && [301, 302, 303, 307, 308].includes(result.status)) {
          current = new URL(result.location, url).href
          continue
        }
        return {
          url: url.href,
          status: result.status,
          contentType: result.contentType,
          body: result.body,
        }
      }
      throw new ResourceFetchException('redirect_limit')
    } catch (error) {
      if (error instanceof ResourceFetchException) {
        throw error
      }
      throw new ResourceFetchException(signal.aborted ? 'timeout' : 'network_error', true)
    }
  }

  private request(url: URL, address: { address: string; family: number }, signal: AbortSignal) {
    return new Promise<{ status: number; contentType: string; body: string; location?: string }>(
      (resolve, reject) => {
        const transport = url.protocol === 'https:' ? https : http
        const request = transport.get(
          url,
          {
            signal,
            agent: false,
            family: address.family,
            // Pin the validated DNS result while retaining the original Host and TLS server name.
            lookup: (_hostname, _options, callback) =>
              callback(null, address.address, address.family),
            headers: {
              'User-Agent': 'ArticleResourcePreview/1.0',
              Accept: 'text/html, application/json, application/pdf',
              'Accept-Encoding': 'identity',
            },
          },
          (response) => {
            const status = response.statusCode ?? 502
            const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
            const location = response.headers.location
            if (
              (location && [301, 302, 303, 307, 308].includes(status)) ||
              contentType.includes('application/pdf') ||
              status >= 400
            ) {
              response.destroy()
              resolve({ status, contentType, body: '', location })
              return
            }
            if (
              response.headers['content-encoding'] &&
              response.headers['content-encoding'] !== 'identity'
            ) {
              response.destroy()
              reject(new ResourceFetchException('unsupported_encoding'))
              return
            }
            let size = 0
            const chunks: Buffer[] = []
            response.on('data', (chunk: Buffer) => {
              size += chunk.length
              if (size > 1_500_000) {
                response.destroy(new ResourceFetchException('response_too_large'))
              } else {
                chunks.push(chunk)
              }
            })
            response.on('error', reject)
            response.on('end', () =>
              resolve({
                status,
                contentType,
                location,
                body: Buffer.concat(chunks).toString('utf8'),
              }),
            )
          },
        )
        request.on('error', reject)
      },
    )
  }
}
