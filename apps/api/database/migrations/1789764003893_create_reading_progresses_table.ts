import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('reading_progresses', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('article_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('articles')
        .onDelete('CASCADE')
      table.integer('revision_id').unsigned().nullable()
      table
        .foreign(['article_id', 'revision_id'])
        .references(['article_id', 'id'])
        .inTable('article_revisions')
        .onDelete('CASCADE')
      table.string('block_id', 100).nullable()
      table.float('block_progress').notNullable().defaultTo(0).checkBetween([0, 1])
      table.integer('lock_version').notNullable().defaultTo(0).checkBetween([0, 2147483647])
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['user_id', 'article_id'])
    })
  }
  async down() {
    this.schema.dropTable('reading_progresses')
  }
}
