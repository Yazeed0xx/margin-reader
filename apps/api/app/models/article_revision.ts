import { belongsTo, hasMany } from '@adonisjs/lucid/orm'

import { ArticleRevisionSchema } from '#database/schema'
import Article from '#models/article'
import ArticleReference from '#models/article_reference'

import type { ArticleContent } from '#validators/article'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class ArticleRevision extends ArticleRevisionSchema {
  get content(): ArticleContent {
    return JSON.parse(this.contentJson) as ArticleContent
  }

  @belongsTo(() => Article)
  declare article: BelongsTo<typeof Article>

  @hasMany(() => ArticleReference)
  declare references: HasMany<typeof ArticleReference>
}
