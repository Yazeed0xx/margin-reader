import { belongsTo } from '@adonisjs/lucid/orm'

import { BookmarkSchema } from '#database/schema'
import Article from '#models/article'

import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Bookmark extends BookmarkSchema {
  @belongsTo(() => Article)
  declare article: BelongsTo<typeof Article>
}
