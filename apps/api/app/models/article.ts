import { belongsTo, hasMany } from '@adonisjs/lucid/orm'

import { ArticleSchema } from '#database/schema'
import ArticleRevision from '#models/article_revision'
import User from '#models/user'

import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Article extends ArticleSchema {
  @belongsTo(() => User, { foreignKey: 'authorId' })
  declare author: BelongsTo<typeof User>

  @belongsTo(() => ArticleRevision, { foreignKey: 'draftRevisionId' })
  declare draftRevision: BelongsTo<typeof ArticleRevision>

  @belongsTo(() => ArticleRevision, { foreignKey: 'publishedRevisionId' })
  declare publishedRevision: BelongsTo<typeof ArticleRevision>

  @hasMany(() => ArticleRevision)
  declare revisions: HasMany<typeof ArticleRevision>
}
