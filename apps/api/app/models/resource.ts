import config from '@adonisjs/core/services/config'
import { hasMany } from '@adonisjs/lucid/orm'

import { ResourceSchema } from '#database/schema'
import ArticleReference from '#models/article_reference'
import ResourceAccess from '#models/resource_access'

import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class Resource extends ResourceSchema {
  get permittedContentText() {
    if (
      this.processingStatus !== 'ready' ||
      this.displayPolicy !== 'full_content' ||
      !this.resolvedUrl
    ) {
      return null
    }
    const origin = new URL(this.resolvedUrl).origin
    const approved = config
      .get<{ origin: string; evidence: string }[]>('resources.approvedSources', [])
      .some(
        (source) =>
          source.origin === origin &&
          !!source.evidence.trim() &&
          source.evidence === this.rightsEvidence,
      )
    return approved ? this.contentText : null
  }

  @hasMany(() => ResourceAccess)
  declare accesses: HasMany<typeof ResourceAccess>

  @hasMany(() => ArticleReference)
  declare references: HasMany<typeof ArticleReference>
}
