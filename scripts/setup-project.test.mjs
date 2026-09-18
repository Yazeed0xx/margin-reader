import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const source = new URL('../', import.meta.url)
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'starter-setup-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const path of [
    'package.json',
    'scripts/setup-project.mjs',
    'apps/mobile/app.json',
    'apps/desktop/package.json',
    'apps/desktop/index.html',
    'apps/web/index.html',
    'apps/api/.env.example',
    'packages/shared/src/index.ts',
  ]) {
    await cp(new URL(path, source), join(root, path), { recursive: true })
  }
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  delete pkg.starterProject
  pkg.name = 'adonis-tuyau-multiclient-poc'
  await writeFile(join(root, 'package.json'), JSON.stringify(pkg))
  return {
    root,
    read: (path) => readFile(join(root, path), 'utf8'),
    run: (...args) =>
      spawnSync(process.execPath, [join(root, 'scripts/setup-project.mjs'), ...args], {
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'development' },
      }),
  }
}

test('configures a fresh project and preserves user edits and secrets on reruns', async (t) => {
  const f = await fixture(t)
  const result = f.run(
    '--name',
    'restaurant-app',
    '--display-name',
    'Food & <$&>',
    '--app-id',
    'com.acme.restaurant',
    '--configure-only',
  )
  assert.equal(result.status, 0, result.stderr)
  const pkg = JSON.parse(await f.read('package.json'))
  assert.equal(pkg.name, 'restaurant-app')
  const mobile = JSON.parse(await f.read('apps/mobile/app.json')).expo
  assert.equal(mobile.ios.bundleIdentifier, 'com.acme.restaurant')
  assert.equal(mobile.android.package, 'com.acme.restaurant')
  assert.equal(mobile.name, 'Food & <$&>')
  assert.match(await f.read('apps/web/index.html'), /<title>Food &amp; &lt;\$&amp;&gt;<\/title>/)
  assert.equal(JSON.parse(await f.read('apps/desktop/package.json')).name, '@poc/desktop')
  assert.match(await f.read('apps/api/.env'), /^APP_NAME=restaurant-app$/m)
  const customEnv = 'NODE_ENV=development\nAPP_KEY=existing-secret\nCUSTOM=keep-me\n'
  await writeFile(join(f.root, 'apps/api/.env'), customEnv)
  await writeFile(join(f.root, 'apps/web/index.html'), 'custom page')
  assert.equal(f.run('--configure-only').status, 0)
  assert.equal(await f.read('apps/api/.env'), customEnv)
  assert.equal(await f.read('apps/web/index.html'), 'custom page')
  assert.equal(f.run('--name', 'different-app', '--configure-only').status, 1)
  assert.equal(JSON.parse(await f.read('package.json')).name, 'restaurant-app')
})

test('invalid input fails before changing configuration', async (t) => {
  const f = await fixture(t)
  const before = await f.read('package.json')
  for (const args of [
    ['--name', '../bad'],
    ['--name', 'good-app', '--app-id', 'bad id'],
    ['--name', 'good-app', '--display-name', '\n'],
    ['--unknown'],
  ]) {
    assert.equal(f.run(...args, '--configure-only').status, 1)
    assert.equal(await f.read('package.json'), before)
  }
})

test('help does not modify the starter', async (t) => {
  const f = await fixture(t)
  const before = await f.read('package.json')
  assert.equal(f.run('--help').status, 0)
  assert.equal(await f.read('package.json'), before)
})
