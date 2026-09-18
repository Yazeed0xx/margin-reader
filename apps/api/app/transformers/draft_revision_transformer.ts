import { BaseTransformer } from '@adonisjs/core/transformers'

import ArticleReferenceTransformer from '#transformers/article_reference_transformer'

import type ArticleRevision from '#models/article_revision'

export default class DraftRevisionTransformer extends BaseTransformer<ArticleRevision> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'revisionNumber', 'title', 'language']),
      direction: this.resource.language === 'ar' ? ('rtl' as const) : ('ltr' as const),
      content: this.resource.content,
      references: ArticleReferenceTransformer.transform(this.resource.references),
    }
  }
}
