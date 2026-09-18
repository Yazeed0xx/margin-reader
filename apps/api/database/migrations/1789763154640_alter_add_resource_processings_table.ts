import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  // SQLite table rebuilds must control their own FK/transaction boundary.
  static disableTransactions = true

  async up() {
    this.schema.alterTable('resources', (table) => {
      table.string('provider').nullable()
      table.string('provider_id').nullable()
      table.text('thumbnail_url').nullable()
      table.text('resolved_url').nullable()
      table.text('content_text').nullable()
      table.text('rights_evidence').nullable()
      table.string('failure_code').nullable()
      table.integer('processing_generation').notNullable().defaultTo(1)
      table.timestamp('expires_at').nullable()
      table.index(['processing_status', 'updated_at'])
    })
  }

  async down() {
    this.schema.alterTable('resources', (table) => {
      table.dropIndex(['processing_status', 'updated_at'])
      table.dropColumns(
        'provider',
        'provider_id',
        'thumbnail_url',
        'resolved_url',
        'content_text',
        'rights_evidence',
        'failure_code',
        'processing_generation',
        'expires_at',
      )
    })
  }
}
