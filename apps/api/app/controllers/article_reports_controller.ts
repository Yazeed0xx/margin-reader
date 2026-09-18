import Article from '#models/article'
import ArticleReport from '#models/article_report'
import ArticleReportTransformer from '#transformers/article_report_transformer'
import { reportValidator } from '#validators/report'

import type { HttpContext } from '@adonisjs/core/http'

export default class ArticleReportsController {
  async store({ auth, request, response, serialize }: HttpContext) {
    const { params, reason, details } = await request.validateUsing(reportValidator)
    const article = await Article.query()
      .where('id', params.id)
      .whereNotNull('publishedRevisionId')
      .firstOrFail()
    // A database uniqueness constraint makes repeated submissions idempotent.
    const report = await ArticleReport.firstOrCreate(
      { reporterId: auth.getUserOrFail().id, articleId: article.id },
      {
        revisionId: article.publishedRevisionId!,
        reason,
        details: details ?? null,
        status: 'pending',
      },
    )
    response.header('Cache-Control', 'private, no-store')
    return serialize(ArticleReportTransformer.transform(report))
  }
}
