import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'resources'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.text('url').notNullable().unique()
      table
        .string('kind')
        .notNullable()
        .defaultTo('unknown')
        .checkIn(['unknown', 'article', 'research', 'video', 'pdf'])
      table
        .string('processing_status')
        .notNullable()
        .defaultTo('pending')
        .checkIn(['pending', 'ready', 'limited', 'failed'])
      // Fetch success never grants permission to reproduce the source.
      table
        .string('display_policy')
        .notNullable()
        .defaultTo('metadata')
        .checkIn(['metadata', 'embed', 'full_content'])
      table.string('title').nullable()
      table.string('creator').nullable()
      table.string('site_name').nullable()
      table.text('description').nullable()
      table.string('language').nullable()
      table.timestamp('fetched_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
