import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import Article from '#models/article'
import ArticleReport from '#models/article_report'

export default class ModerationService {
  async resolve(
    reportId: number,
    decision: 'removed' | 'dismissed',
    operator: string,
    note: string,
  ) {
    return db.transaction(async (trx) => {
      const changed = await ArticleReport.query({ client: trx })
        .where('id', reportId)
        .where('status', 'pending')
        .update({
          status: decision,
          reviewedBy: operator,
          reviewNote: note,
          resolvedAt: DateTime.utc().toSQL(),
        })
      if (Number(changed) !== 1) {
        throw new Error('Report does not exist or has already been reviewed')
      }
      const report = await ArticleReport.query({ client: trx }).where('id', reportId).firstOrFail()
      if (decision === 'removed') {
        // Atomic invalidation makes concurrent stale publication requests fail.
        await Article.query({ client: trx })
          .where('id', report.articleId)
          .increment('lockVersion', 1)
        await Article.query({ client: trx }).where('id', report.articleId).update({
          publishedRevisionId: null,
          publishedAt: null,
          removedAt: DateTime.utc().toSQL(),
          removalReason: note,
        })
      }
      return report
    })
  }
}
