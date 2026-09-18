import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_reports'
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('article_id')
        .unsigned()
        .notNullable()
        .references('articles.id')
        .onDelete('CASCADE')
      table
        .integer('reporter_id')
        .unsigned()
        .notNullable()
        .references('users.id')
        .onDelete('CASCADE')
      table
        .integer('revision_id')
        .unsigned()
        .notNullable()
        .references('article_revisions.id')
        .onDelete('CASCADE')
      table.enum('reason', ['spam', 'harassment', 'copyright', 'other']).notNullable()
      table.text('details').nullable()
      table.enum('status', ['pending', 'dismissed', 'removed']).notNullable().defaultTo('pending')
      table.string('reviewed_by', 120).nullable()
      table.text('review_note').nullable()
      table.timestamp('resolved_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['reporter_id', 'article_id'])
      table.index(['status', 'id'])
    })
  }
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
