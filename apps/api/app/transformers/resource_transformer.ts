import { BaseTransformer } from '@adonisjs/core/transformers'

import type Resource from '#models/resource'

export default class ResourceTransformer extends BaseTransformer<Resource> {
  toPreview() {
    const resource = this.resource
    const displayPolicy =
      resource.displayPolicy === 'full_content' && !resource.permittedContentText
        ? 'metadata'
        : resource.displayPolicy
    return {
      ...this.pick(resource, [
        'id',
        'url',
        'kind',
        'processingStatus',
        'title',
        'creator',
        'siteName',
        'description',
        'language',
        'thumbnailUrl',
        'fetchedAt',
        'expiresAt',
        'failureCode',
      ]),
      displayPolicy,
      rightsEvidence: displayPolicy !== 'metadata' ? resource.rightsEvidence : null,
      playback:
        displayPolicy === 'embed' &&
        resource.provider === 'youtube' &&
        resource.providerId &&
        /^[\w-]{11}$/.test(resource.providerId)
          ? {
              provider: 'youtube' as const,
              videoId: resource.providerId,
              embedUrl: `https://www.youtube-nocookie.com/embed/${resource.providerId}?playsinline=1&autoplay=0`,
              requiresUserAction: true,
              availability: 'unverified' as const,
            }
          : null,
    }
  }
  toContent() {
    return {
      id: this.resource.id,
      contentText: this.resource.permittedContentText,
      displayPolicy: this.toPreview().displayPolicy,
      rightsEvidence: this.resource.permittedContentText ? this.resource.rightsEvidence : null,
    }
  }
  toObject() {
    return { ...this.toPreview(), contentText: this.resource.permittedContentText }
  }
}
