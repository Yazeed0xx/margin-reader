import { BaseTransformer } from '@adonisjs/core/transformers'

import ArticleTransformer from '#transformers/article_transformer'

import type Bookmark from '#models/bookmark'

export default class BookmarkTransformer extends BaseTransformer<Bookmark> {
  toObject() {
    return {
      articleId: this.resource.articleId,
      createdAt: this.resource.createdAt,
      article: this.resource.article?.publishedRevision
        ? ArticleTransformer.transform(this.resource.article).useVariant('toSummary').depth(2)
        : null,
    }
  }
}
