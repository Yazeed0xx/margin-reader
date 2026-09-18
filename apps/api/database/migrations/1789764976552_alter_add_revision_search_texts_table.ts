import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  // Let Knex own SQLite rebuild transactions during rollback, preserving references.
  static disableTransactions = true

  async up() {
    this.schema.alterTable('article_revisions', (table) => {
      table.text('search_text').notNullable().defaultTo('')
    })
    this.defer(async (db) => {
      let lastId = 0
      while (true) {
        const rows = await db
          .from('article_revisions')
          .select('id', 'title', 'content_json')
          .where('id', '>', lastId)
          .orderBy('id')
          .limit(250)
        if (!rows.length) {
          break
        }
        for (const row of rows) {
          // Historical document projection: no runtime model/service imports.
          const content = JSON.parse(row.content_json)
          const parts = [row.title]
          for (const block of content.blocks ?? []) {
            if (typeof block.text === 'string') {
              parts.push(block.text)
            }
            if (Array.isArray(block.items)) {
              parts.push(...block.items.filter((item: unknown) => typeof item === 'string'))
            }
          }
          const searchText = parts
            .join(' ')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
          await db.from('article_revisions').where('id', row.id).update({ search_text: searchText })
          lastId = row.id
        }
      }
    })
  }
  async down() {
    this.schema.alterTable('article_revisions', (table) => table.dropColumn('search_text'))
  }
}
