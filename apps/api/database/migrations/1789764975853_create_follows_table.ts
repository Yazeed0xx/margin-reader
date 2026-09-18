import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('follows', (table) => {
      table.increments('id')
      table
        .integer('follower_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('writer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.unique(['follower_id', 'writer_id'])
      table.index(['follower_id', 'created_at', 'id'])
      table.index(['writer_id'])
      table.check('?? <> ??', ['follower_id', 'writer_id'])
    })
  }
  async down() {
    this.schema.dropTable('follows')
  }
}
