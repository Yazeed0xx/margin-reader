import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import ReadingConflictException from '#exceptions/reading_conflict_exception'
import Article from '#models/article'
import Bookmark from '#models/bookmark'
import ReadingProgress from '#models/reading_progress'

import type { ProgressInput } from '#validators/reading'

export default class ReadingStateService {
  async bookmark(userId: number, articleId: number) {
    return db.transaction(async (trx) => {
      // The unique key makes repeated or concurrent PUT requests idempotent.
      await trx
        .table('bookmarks')
        .insert({ user_id: userId, article_id: articleId, created_at: DateTime.utc().toSQL() })
        .onConflict(['user_id', 'article_id'])
        .ignore()
      await Article.query({ client: trx })
        .where('id', articleId)
        .whereNotNull('publishedRevisionId')
        .firstOrFail()
      return Bookmark.query({ client: trx })
        .where('userId', userId)
        .where('articleId', articleId)
        .firstOrFail()
    })
  }

  async saveProgress(
    userId: number,
    articleId: number,
    input: ProgressInput | { expectedVersion: number },
  ) {
    return db.transaction(async (trx) => {
      // Acquire the SQLite write lock before reading the current publication/position.
      await trx
        .table('reading_progresses')
        .insert({ user_id: userId, article_id: articleId, created_at: DateTime.utc().toSQL() })
        .onConflict(['user_id', 'article_id'])
        .ignore()
      if ('revisionId' in input) {
        const article = await Article.query({ client: trx })
          .where('id', articleId)
          .whereNotNull('publishedRevisionId')
          .preload('publishedRevision')
          .firstOrFail()
        if (
          article.publishedRevisionId !== input.revisionId ||
          !article.publishedRevision.content.blocks.some((block) => block.id === input.blockId)
        ) {
          throw new ReadingConflictException()
        }
      }
      const changed = await ReadingProgress.query({ client: trx })
        .where('userId', userId)
        .where('articleId', articleId)
        .where('lockVersion', input.expectedVersion)
        .update({
          revisionId: 'revisionId' in input ? input.revisionId : null,
          blockId: 'blockId' in input ? input.blockId : null,
          blockProgress: 'blockProgress' in input ? input.blockProgress : 0,
          lockVersion: input.expectedVersion + 1,
          updatedAt: DateTime.utc().toSQL(),
        })
      if (Number(changed) !== 1) {
        throw new ReadingConflictException()
      }
      return ReadingProgress.query({ client: trx })
        .where('userId', userId)
        .where('articleId', articleId)
        .firstOrFail()
    })
  }
}
