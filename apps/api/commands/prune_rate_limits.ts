import { BaseCommand } from '@adonisjs/core/ace'

import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class PruneRateLimits extends BaseCommand {
  static commandName = 'limiter:prune'
  static description = 'Delete rate-limit entries that expired more than one hour ago'
  static options: CommandOptions = { startApp: true }
  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const count = await db
      .from('rate_limits')
      .where('expire', '<', Date.now() - 3600000)
      .where('expire', '>', 0)
      .delete()
    this.logger.success(`Pruned ${count} expired rate-limit entries`)
  }
}
