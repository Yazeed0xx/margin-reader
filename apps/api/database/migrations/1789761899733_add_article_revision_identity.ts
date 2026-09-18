import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'article_revisions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Supports same-article foreign keys for draft and published pointers.
      table.unique(['article_id', 'id'], { indexName: 'article_revisions_article_identity' })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['article_id', 'id'], 'article_revisions_article_identity')
    })
  }
}
