import { BaseTransformer } from '@adonisjs/core/transformers'

import type ArticleReference from '#models/article_reference'

export default class ArticleReferenceTransformer extends BaseTransformer<ArticleReference> {
  toObject() {
    return this.pick(this.resource, [
      'referenceKey',
      'blockId',
      'resourceId',
      'commentary',
      'selectedQuote',
      'videoStartSeconds',
    ])
  }
}
