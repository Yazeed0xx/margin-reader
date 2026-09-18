import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  // Knex must own SQLite's FK-safe table rebuild when rolling back.
  static disableTransactions = true
  protected tableName = 'articles'
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('removed_at').nullable()
      table.text('removal_reason').nullable()
    })
  }
  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('removed_at', 'removal_reason')
    })
  }
}
