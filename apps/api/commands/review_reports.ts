import { BaseCommand, flags } from '@adonisjs/core/ace'

import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ReviewReports extends BaseCommand {
  static commandName = 'moderation:reports'
  static description = 'List pending reports, or resolve one with an operator identity and reason'
  static options: CommandOptions = { startApp: true }
  @flags.number() declare id?: number
  @flags.string() declare decision?: string
  @flags.string() declare operator?: string
  @flags.string() declare note?: string
  async run() {
    const { default: ArticleReport } = await import('#models/article_report')
    if (this.id === undefined) {
      const reports = await ArticleReport.query()
        .where('status', 'pending')
        .orderBy('id', 'asc')
        .limit(50)
      this.logger.info(
        JSON.stringify(
          reports.map((r) => ({
            id: r.id,
            articleId: r.articleId,
            revisionId: r.revisionId,
            reason: r.reason,
            details: r.details,
          })),
          null,
          2,
        ),
      )
      return
    }
    if (
      !Number.isInteger(this.id) ||
      this.id < 1 ||
      !['removed', 'dismissed'].includes(this.decision ?? '') ||
      !this.operator?.trim() ||
      this.operator.length > 120 ||
      !this.note?.trim() ||
      this.note.length > 2000
    ) {
      this.logger.error(
        'Supply a positive --id, --decision removed|dismissed, --operator (1–120 chars), and --note (1–2000 chars)',
      )
      this.exitCode = 1
      return
    }
    const { default: ModerationService } = await import('#services/moderation_service')
    const service = await this.app.container.make(ModerationService)
    const report = await service.resolve(
      this.id,
      this.decision as 'removed' | 'dismissed',
      this.operator.trim(),
      this.note.trim(),
    )
    this.logger.success(`Report ${report.id}: ${report.status}`)
  }
}
