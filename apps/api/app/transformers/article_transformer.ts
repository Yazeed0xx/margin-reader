import { BaseTransformer } from '@adonisjs/core/transformers'

import ArticleReferenceTransformer from '#transformers/article_reference_transformer'
import WriterTransformer from '#transformers/writer_transformer'

import type Article from '#models/article'

export default class ArticleTransformer extends BaseTransformer<Article> {
  toSummary() {
    const revision = this.resource.publishedRevision
    return {
      id: this.resource.id,
      publishedAt: this.resource.publishedAt,
      revisionId: revision.id,
      title: revision.title,
      language: revision.language,
      direction: revision.language === 'ar' ? ('rtl' as const) : ('ltr' as const),
      author: WriterTransformer.transform(this.resource.author),
    }
  }

  toObject() {
    return {
      ...this.toSummary(),
      content: this.resource.publishedRevision.content,
      references: ArticleReferenceTransformer.transform(this.resource.publishedRevision.references),
    }
  }
}
