import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_revisions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('article_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('articles')
        .onDelete('CASCADE')
      table.integer('revision_number').notNullable().checkPositive()
      table.string('title', 240).notNullable()
      table.string('language', 2).notNullable().checkIn(['ar', 'en'])
      // Serialized editor document. Phase 2 defines and validates its block format.
      table.text('content_json').notNullable()
      table.timestamp('created_at').notNullable()
      table.unique(['article_id', 'revision_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
