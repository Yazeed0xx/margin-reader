import { belongsTo, scope } from '@adonisjs/lucid/orm'

import { ArticleReferenceSchema } from '#database/schema'
import ArticleRevision from '#models/article_revision'
import Resource from '#models/resource'

import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ArticleReference extends ArticleReferenceSchema {
  static publishedFor = scope((query, articleId: number, revisionId: number) => {
    query
      .select('article_references.*')
      .join('articles', 'articles.published_revision_id', 'article_references.article_revision_id')
      .where('articles.id', articleId)
      .where('article_references.article_revision_id', revisionId)
  })

  @belongsTo(() => ArticleRevision)
  declare articleRevision: BelongsTo<typeof ArticleRevision>

  @belongsTo(() => Resource)
  declare resource: BelongsTo<typeof Resource>
}
