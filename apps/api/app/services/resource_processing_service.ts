import { inject } from '@adonisjs/core'
import config from '@adonisjs/core/services/config'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { DateTime } from 'luxon'

import ResourceFetchException from '#exceptions/resource_fetch_exception'
import Resource from '#models/resource'
import ResourceUrlService from '#services/resource_url_service'
import SafeResourceHttpService from '#services/safe_resource_http_service'

@inject()
export default class ResourceProcessingService {
  constructor(
    private http: SafeResourceHttpService,
    private urls: ResourceUrlService,
  ) {}

  async process(id: number, generation: number) {
    const resource = await Resource.find(id)
    if (
      !resource ||
      resource.processingGeneration !== generation ||
      resource.processingStatus !== 'pending'
    ) {
      return
    }
    try {
      const normalized = this.urls.normalize(resource.url)
      const values = normalized.videoId
        ? await this.youtube(normalized.videoId)
        : await this.page(resource.url)
      await Resource.query()
        .where('id', id)
        .where('processingGeneration', generation)
        .where('processingStatus', 'pending')
        .update({
          ...values,
          failureCode: values.failureCode ?? null,
          fetchedAt: DateTime.utc().toSQL(),
          expiresAt: DateTime.utc()
            .plus({ hours: config.get<number>('resources.cacheHours') })
            .toSQL(),
          updatedAt: DateTime.utc().toSQL(),
        })
    } catch (error) {
      if (!(error instanceof ResourceFetchException)) {
        throw error
      }
      if (error.retryable) {
        throw error
      }
      await this.fail(id, generation, error.reason)
    }
  }

  async fail(id: number, generation: number, reason = 'fetch_failed') {
    await Resource.query()
      .where('id', id)
      .where('processingGeneration', generation)
      .where('processingStatus', 'pending')
      .update({
        processingStatus: 'failed',
        displayPolicy: 'metadata',
        contentText: null,
        rightsEvidence: null,
        failureCode: reason,
        updatedAt: DateTime.utc().toSQL(),
        expiresAt: DateTime.utc()
          .plus({ minutes: config.get<number>('resources.failureCacheMinutes') })
          .toSQL(),
      })
  }

  private checkStatus(status: number) {
    if (status === 429 || status >= 500) {
      throw new ResourceFetchException('upstream_unavailable', true)
    }
    if (status < 200 || status >= 300) {
      throw new ResourceFetchException(status === 404 ? 'not_found' : 'access_restricted')
    }
  }

  private async youtube(videoId: string) {
    const canonical = `https://www.youtube.com/watch?v=${videoId}`
    const response = await this.http.get(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonical)}`,
    )
    this.checkStatus(response.status)
    let data: unknown
    try {
      data = JSON.parse(response.body)
    } catch {
      throw new ResourceFetchException('invalid_metadata')
    }
    if (
      !data ||
      typeof data !== 'object' ||
      !('title' in data) ||
      typeof data.title !== 'string' ||
      !('author_name' in data) ||
      typeof data.author_name !== 'string'
    ) {
      throw new ResourceFetchException('invalid_metadata')
    }
    // Ignore oEmbed's HTML entirely. The frontend receives a provider ID and our approved player URL.
    return {
      kind: 'video' as const,
      provider: 'youtube',
      providerId: videoId,
      processingStatus: 'ready' as const,
      displayPolicy: 'embed' as const,
      title: data.title.slice(0, 500),
      creator: data.author_name.slice(0, 255),
      siteName: 'YouTube',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      resolvedUrl: canonical,
      description: null,
      language: null,
      contentText: null,
      rightsEvidence: 'YouTube official embedded player',
      failureCode: null,
    }
  }

  private async page(input: string) {
    const response = await this.http.get(input)
    this.checkStatus(response.status)
    const base = {
      provider: null,
      providerId: null,
      thumbnailUrl: null,
      resolvedUrl: response.url,
      creator: null as string | null,
      siteName: new URL(response.url).hostname,
      title: null as string | null,
      description: null as string | null,
      language: null as string | null,
      contentText: null as string | null,
      rightsEvidence: null as string | null,
      kind: 'unknown' as Resource['kind'],
      processingStatus: 'limited' as Resource['processingStatus'],
      displayPolicy: 'metadata' as Resource['displayPolicy'],
      failureCode: 'unsupported_type' as string | null,
    }
    if (response.contentType.includes('application/pdf')) {
      return { ...base, kind: 'pdf' as const, failureCode: 'pdf_preview_only' }
    }
    if (
      !response.contentType.includes('text/html') &&
      !response.contentType.includes('application/xhtml+xml')
    ) {
      return base
    }
    const { document } = parseHTML(response.body)
    const meta = (key: string) =>
      document
        .querySelector(`meta[property="${key}"],meta[name="${key}"]`)
        ?.getAttribute('content')
        ?.trim() || null
    base.title =
      (meta('og:title') ?? document.querySelector('title')?.textContent ?? '')
        .trim()
        .slice(0, 500) || null
    base.description = (meta('og:description') ?? meta('description'))?.slice(0, 2000) ?? null
    base.creator = (meta('author') ?? meta('citation_author'))?.slice(0, 255) ?? null
    base.siteName = meta('og:site_name')?.slice(0, 255) ?? base.siteName
    base.language = document.documentElement.lang?.slice(0, 32) || null
    base.kind = meta('citation_doi') || meta('citation_journal_title') ? 'research' : 'article'
    base.failureCode = 'metadata_only'
    const permission = config
      .get<{ origin: string; evidence: string }[]>('resources.approvedSources', [])
      .find((source) => source.origin === new URL(response.url).origin && source.evidence.trim())
    // Honor restrictive preview hints even on an operator-approved origin.
    const robots = `${meta('robots') ?? ''} ${meta('googlebot') ?? ''}`
    if (/nosnippet|noindex|noarchive|max-snippet\s*:\s*0/i.test(robots)) {
      return { ...base, description: null, failureCode: 'preview_restricted' }
    }
    if (permission) {
      const article = new Readability(
        document as unknown as ConstructorParameters<typeof Readability>[0],
        { maxElemsToParse: 20000 },
      ).parse()
      if (article?.textContent?.trim()) {
        return {
          ...base,
          processingStatus: 'ready' as const,
          displayPolicy: 'full_content' as const,
          contentText: article.textContent.trim().slice(0, 200000),
          rightsEvidence: permission.evidence,
          failureCode: null,
        }
      }
      base.failureCode = 'extraction_unavailable'
    }
    return base
  }
}
