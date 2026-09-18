import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_references'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('article_revision_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('article_revisions')
        .onDelete('CASCADE')
      table
        .integer('resource_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('resources')
        .onDelete('RESTRICT')
        .index()
      table.string('block_id', 100).notNullable()
      table.string('reference_key', 100).notNullable()
      table.text('commentary').nullable()
      table.text('selected_quote').nullable()
      table.integer('video_start_seconds').nullable().checkBetween([0, 2147483647])
      table.timestamp('created_at').notNullable()
      table.unique(['article_revision_id', 'reference_key'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
