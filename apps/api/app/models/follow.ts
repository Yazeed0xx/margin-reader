import { belongsTo } from '@adonisjs/lucid/orm'

import { FollowSchema } from '#database/schema'
import User from '#models/user'

import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Follow extends FollowSchema {
  @belongsTo(() => User, { foreignKey: 'writerId' })
  declare writer: BelongsTo<typeof User>
}
