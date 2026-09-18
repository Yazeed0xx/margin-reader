import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

const execute = promisify(execFile)

test('publication migrations preserve existing revisions and references through rollback and upgrade', async ({
  assert,
  cleanup,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'publishing-migrations-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  const database = join(directory, 'migration.sqlite3')
  const options = { cwd: app.makePath(), env: { ...process.env, DB_DATABASE: database } }
  const ace = (...args: string[]) =>
    execute(process.execPath, ['ace', ...args, '--no-schema-generate'], options)
  const inspect = (source: string) =>
    execute(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
    import Database from 'better-sqlite3';
    import assert from 'node:assert/strict';
    const db = new Database(process.argv[1]);
    try { ${source} } finally { db.close(); }
  `,
        database,
      ],
      options,
    )

  // Use the real migration runner: its transaction boundary is significant on SQLite.
  await ace('migration:run')
  await ace('migration:rollback', '--step=12')
  await inspect(`
    db.exec(\`
      INSERT INTO users (id,email,password,created_at) VALUES (1,'migration@example.com','test-only','2026-01-01');
      INSERT INTO articles (id,author_id,created_at) VALUES (1,1,'2026-01-01');
      INSERT INTO article_revisions (id,article_id,revision_number,title,language,content_json,created_at)
        VALUES (1,1,1,'Old draft','en','{}','2026-01-01'), (2,1,2,'Latest draft','en','{"version":1,"blocks":[{"id":"legacy","type":"paragraph","text":"Historical CONTENT"}]}','2026-01-01');
      INSERT INTO resources (id,url,created_at) VALUES (1,'https://example.com/source','2026-01-01');
      INSERT INTO article_references (article_revision_id,resource_id,block_id,reference_key,created_at)
        VALUES (2,1,'intro','source','2026-01-01');
    \`);
  `)
  await ace('migration:run')
  await inspect(`
    assert.deepEqual(db.prepare('SELECT draft_revision_id,published_revision_id,lock_version FROM articles').get(),
      { draft_revision_id: 2, published_revision_id: null, lock_version: 0 });
    assert.equal(db.prepare('SELECT count(*) AS total FROM article_references').get().total, 1);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.equal(db.prepare('SELECT search_text FROM article_revisions WHERE id = 2').get().search_text, 'latest draft historical content');
  `)
  await ace('migration:rollback', '--step=12')
  await inspect(`
    assert.equal(db.prepare('SELECT count(*) AS total FROM article_revisions').get().total, 2);
    assert.equal(db.prepare('SELECT count(*) AS total FROM article_references').get().total, 1);
    assert.equal(db.pragma('table_info(articles)').some(column => column.name === 'draft_revision_id'), false);
  `)
  await ace('migration:run')
  const final = await inspect(`
    assert.equal(db.prepare('SELECT draft_revision_id FROM articles').get().draft_revision_id, 2);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.equal(db.prepare('SELECT search_text FROM article_revisions WHERE id = 2').get().search_text, 'latest draft historical content');
    process.stdout.write('preserved');
  `)
  assert.equal(final.stdout, 'preserved')
})
