import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const validatorPath = join(root, 'apps/api/app/validators/test.ts')
const original = readFileSync(validatorPath, 'utf8')
const anchor = '  age: vine.number().min(0).max(150),'
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

assert.ok(original.includes(anchor), 'validator anchor changed')
const mutated = original.replace(
  anchor,
  `${anchor}\n  nickname: vine.string().trim().minLength(1),`,
)
let mutationWritten = false

function restoreSource() {
  if (mutationWritten && readFileSync(validatorPath, 'utf8') === mutated) {
    writeFileSync(validatorPath, original)
    mutationWritten = false
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    restoreSource()
    process.kill(process.pid, signal)
  })
}

function run(command, args) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8' })
}

try {
  writeFileSync(validatorPath, mutated)
  mutationWritten = true

  const generate = run(pnpm, ['generate'])
  assert.equal(generate.status, 0, generate.stderr || generate.stdout)

  const check = run(pnpm, ['--filter', '@poc/api-client', 'typecheck'])
  const output = `${check.stdout}\n${check.stderr}`
  assert.notEqual(
    check.status,
    0,
    'old client call still compiled after a required field was added',
  )
  assert.match(output, /nickname/, output)
  console.log('contract propagation passed: adding required `nickname` breaks the old client call')
} finally {
  const current = readFileSync(validatorPath, 'utf8')
  assert.ok(
    current === mutated || current === original,
    'validator changed while contract verification was running; preserving the newer contents',
  )
  restoreSource()
  const restore = run(pnpm, ['generate'])
  assert.equal(restore.status, 0, restore.stderr || restore.stdout)
}
