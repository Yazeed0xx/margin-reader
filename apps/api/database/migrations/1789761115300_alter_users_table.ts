import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('bio').nullable()
      table.string('interface_language', 2).notNullable().defaultTo('en').checkIn(['ar', 'en'])
      table
        .string('reading_language', 4)
        .notNullable()
        .defaultTo('both')
        .checkIn(['ar', 'en', 'both'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('bio', 'interface_language', 'reading_language')
    })
  }
}
