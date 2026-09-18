import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  // SQLite cannot disable FK enforcement inside an outer transaction. Let
  // Knex own each table-rebuild transaction so it preserves cascading children.
  static disableTransactions = true

  protected tableName = 'articles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('lock_version').notNullable().defaultTo(0).checkBetween([0, 2147483647])
      table.integer('draft_revision_id').unsigned().nullable()
      table.integer('published_revision_id').unsigned().nullable()
      table.timestamp('published_at').nullable()
      table
        .foreign(['id', 'draft_revision_id'], 'articles_draft_revision_foreign')
        .references(['article_id', 'id'])
        .inTable('article_revisions')
      table
        .foreign(['id', 'published_revision_id'], 'articles_published_revision_foreign')
        .references(['article_id', 'id'])
        .inTable('article_revisions')
      table.index(['published_at', 'id'])
    })
    // Adopt existing Phase 1 revisions as private drafts; never publish them.
    this.defer(async (db) => {
      const articles = await db.from('articles').select('id')
      for (const article of articles) {
        const revision = await db
          .from('article_revisions')
          .where('article_id', article.id)
          .orderBy('revision_number', 'desc')
          .first()
        if (revision) {
          await db
            .from('articles')
            .where('id', article.id)
            .update({ draft_revision_id: revision.id })
        }
      }
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['id', 'draft_revision_id'], 'articles_draft_revision_foreign')
      table.dropForeign(['id', 'published_revision_id'], 'articles_published_revision_foreign')
      table.dropIndex(['published_at', 'id'])
      table.dropColumns(
        'lock_version',
        'draft_revision_id',
        'published_revision_id',
        'published_at',
      )
    })
  }
}
