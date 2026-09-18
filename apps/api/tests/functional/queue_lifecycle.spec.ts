import { execFile } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

const execute = promisify(execFile)

test('code generation exits without connecting to the queue database or scheduling work', async ({
  assert,
  cleanup,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'publishing-codegen-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  const result = await execute(process.execPath, ['ace', 'codegen'], {
    cwd: app.makePath(),
    timeout: 10000,
    env: { ...process.env, DB_DATABASE: join(directory, 'unused.sqlite3') },
  })
  assert.include(result.stdout, 'Codegen files generated')
  assert.isEmpty(await readdir(directory))
})
