import { BaseTransformer } from '@adonisjs/core/transformers'

import type ArticleReport from '#models/article_report'
export default class ArticleReportTransformer extends BaseTransformer<ArticleReport> {
  toObject() {
    return this.pick(this.resource, ['id', 'articleId', 'reason', 'status', 'createdAt'])
  }
}
