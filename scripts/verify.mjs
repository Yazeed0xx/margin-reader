import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = new URL('..', import.meta.url)
const apiRoot = new URL('../apps/api/', import.meta.url)
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

async function getApiUrl() {
  if (process.env.POC_API_URL) {
    return process.env.POC_API_URL
  }

  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, 'localhost', resolve)
  })
  const address = server.address()
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )

  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate a verification API port')
  }
  return `http://localhost:${address.port}`
}

const apiUrl = await getApiUrl()

function hasExited(server) {
  return server.exitCode !== null || server.signalCode !== null
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`)
  }
}

async function assertPortAvailable(url) {
  const { hostname, port } = new URL(url)
  const server = createServer()

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(Number(port || 80), hostname, resolve)
  }).catch((error) => {
    throw new Error(`Cannot start verification API at ${url}; the port is already in use`, {
      cause: error,
    })
  })

  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}

async function stopServer(server) {
  if (hasExited(server)) {
    return
  }

  let closed = false
  const exited = new Promise((resolve) =>
    server.once('close', () => {
      closed = true
      resolve()
    }),
  )
  const kill = (signal) => {
    try {
      if (process.platform === 'win32') {
        server.kill(signal)
      } else {
        process.kill(-server.pid, signal)
      }
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error
      }
    }
  }

  kill('SIGTERM')
  await Promise.race([exited, delay(5_000)])
  if (!closed && !hasExited(server)) {
    kill('SIGKILL')
    await exited
  }
}

async function waitForApi(server) {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    if (hasExited(server)) {
      throw new Error(
        `API server exited before becoming ready (code ${server.exitCode}, signal ${server.signalCode})`,
      )
    }

    try {
      const response = await fetch(`${apiUrl}/api/test?search=ready&limit=1`)
      if (response.ok) {
        return
      }
    } catch {
      // The server is still starting.
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for the API at ${apiUrl}`)
}

run(pnpm, ['lint'])
run(pnpm, ['test:lint'])
run(pnpm, ['format'])
run(pnpm, ['typecheck'])
run(pnpm, ['test'])
run(pnpm, ['build'])
run('node', ['scripts/verify-contract-change.mjs'])
const verificationDirectory = await mkdtemp(join(tmpdir(), 'poc-verify-'))
const verificationEnv = {
  ...process.env,
  APP_URL: apiUrl,
  DB_DATABASE: join(verificationDirectory, 'db.sqlite3'),
  HOST: new URL(apiUrl).hostname,
  POC_API_URL: apiUrl,
  PORT: new URL(apiUrl).port || '3333',
}
try {
  run(pnpm, ['--filter', '@poc/api', 'exec', 'node', 'ace', 'migration:run'], verificationEnv)
  await assertPortAvailable(apiUrl)

  const server = spawn(process.execPath, ['--env-file-if-exists=.env', 'build/bin/server.js'], {
    cwd: apiRoot,
    env: verificationEnv,
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: process.platform !== 'win32',
  })

  try {
    await waitForApi(server)
    run('node', ['scripts/runtime-smoke.mjs'], verificationEnv)
  } finally {
    await stopServer(server)
  }
} finally {
  await rm(verificationDirectory, { recursive: true, force: true })
}

console.log('verification passed')
