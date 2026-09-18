import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export default class FollowingService {
  async follow(followerId: number, writerId: number) {
    // Conflict handling belongs in the database, not a read-then-create check.
    await db
      .table('follows')
      .insert({ follower_id: followerId, writer_id: writerId, created_at: DateTime.utc().toSQL() })
      .onConflict(['follower_id', 'writer_id'])
      .ignore()
  }
}
