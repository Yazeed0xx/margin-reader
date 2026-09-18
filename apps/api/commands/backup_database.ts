import { BaseCommand, args } from '@adonisjs/core/ace'

import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class BackupDatabase extends BaseCommand {
  static commandName = 'database:backup'
  static description = 'Create and verify a private SQLite online backup at a new destination'
  static options: CommandOptions = { startApp: true }
  @args.string() declare destination: string
  async run() {
    const { default: config } = await import('@adonisjs/core/services/config')
    const { default: DatabaseBackupService } = await import('#services/database_backup_service')
    const source = config.get<string>('database.connections.sqlite.connection.filename')
    const service = await this.app.container.make(DatabaseBackupService)
    this.logger.success(`Verified backup: ${await service.create(source, this.destination)}`)
  }
}
