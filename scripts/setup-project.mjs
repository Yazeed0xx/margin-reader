import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs, parseEnv } from 'node:util'

const root = new URL('../', import.meta.url)
const file = (path) => new URL(path, root)
const read = (path) => readFile(file(path), 'utf8')
const json = async (path) => JSON.parse(await read(path))
const saveJson = (path, value) => writeFile(file(path), `${JSON.stringify(value, null, 2)}\n`)

function run(args) {
  // pnpm exposes its JS entrypoint when running a package script. This also
  // avoids invoking a Windows .cmd file through a shell with user input.
  const entry = process.env.npm_execpath
  const command = entry ? process.execPath : 'pnpm'
  const result = spawnSync(command, entry ? [entry, ...args] : args, {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed. Rerun setup after fixing it.`)
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      'display-name': { type: 'string' },
      'app-id': { type: 'string' },
      'configure-only': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(`Usage: pnpm setup:project [options]

  --name restaurant-app           Project slug (lowercase, hyphen-separated)
  --display-name "Restaurant App" Display name
  --app-id com.example.restaurant Unique iOS/Android identifier
  --configure-only               Write configuration without installing or running API commands

Interactive on first run. Reruns preserve project identity and existing .env files.
Run from a NEW project created from the template, not the master starter.`)
    return
  }
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('Node.js 24 or newer is required.')
  }
  const pkg = await json('package.json')
  const mobile = await json('apps/mobile/app.json')
  const previous = pkg.starterProject
  let identity = previous

  if (previous) {
    for (const [option, key] of [
      ['name', 'name'],
      ['display-name', 'displayName'],
      ['app-id', 'appId'],
    ]) {
      if (values[option] !== undefined && values[option] !== previous[key]) {
        throw new Error(
          'This project is already configured. Edit its configuration manually to rename it.',
        )
      }
    }
    console.log(`Continuing setup for ${previous.displayName}.`)
  } else {
    const prompt = process.stdin.isTTY
      ? createInterface({ input: process.stdin, output: process.stdout })
      : null
    const ask = async (label, fallback) =>
      prompt ? (await prompt.question(`${label} (${fallback}): `)).trim() || fallback : fallback
    try {
      const defaultName = basename(fileURLToPath(root))
      const name = values.name ?? (await ask('Project name', defaultName))
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name) || name.length > 80) {
        throw new Error(
          'Use a lowercase project name such as restaurant-app (maximum 80 characters).',
        )
      }
      if (name === 'adonisjs-monorepo-starter' || name === 'adonis-tuyau-multiclient-poc') {
        throw new Error(
          'Create a new project from the GitHub template first, or provide --name your-project.',
        )
      }
      const displayName =
        values['display-name'] ??
        (await ask(
          'App display name',
          name
            .split('-')
            .map((part) => part[0].toUpperCase() + part.slice(1))
            .join(' '),
        ))
      if (
        !displayName.trim() ||
        Array.from(displayName).some((character) => character.codePointAt(0) < 32) ||
        displayName.length > 100
      ) {
        throw new Error('Display name must be 1–100 characters without control characters.')
      }
      const appId =
        values['app-id'] ?? (await ask('App identifier', `com.example.${name.replaceAll('-', '')}`))
      if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(appId)) {
        throw new Error(
          'Use a dotted app identifier such as com.yourcompany.restaurant (letters and digits).',
        )
      }
      identity = { name, displayName, appId }
    } finally {
      prompt?.close()
    }

    // Read all targets before writing. Keep workspace names/imports and the
    // dependency graph intact so frozen-lockfile installs remain reproducible.
    const web = await read('apps/web/index.html')
    const desktop = await read('apps/desktop/index.html')
    const desktopPkg = await json('apps/desktop/package.json')
    const title = identity.displayName
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
    pkg.name = identity.name
    mobile.expo.name = identity.displayName
    mobile.expo.slug = identity.name
    mobile.expo.ios = { ...mobile.expo.ios, bundleIdentifier: identity.appId }
    mobile.expo.android = { ...mobile.expo.android, package: identity.appId }
    desktopPkg.productName = identity.displayName
    await saveJson('apps/mobile/app.json', mobile)
    await saveJson('apps/desktop/package.json', desktopPkg)
    await writeFile(
      file('apps/web/index.html'),
      web.replace(/<title>.*?<\/title>/s, () => `<title>${title}</title>`),
    )
    await writeFile(
      file('apps/desktop/index.html'),
      desktop.replace(/<title>.*?<\/title>/s, () => `<title>${title}</title>`),
    )
    await writeFile(
      file('packages/shared/src/index.ts'),
      `export const POC_NAME = ${JSON.stringify(identity.displayName)} as const\n`,
    )
    pkg.starterProject = identity
    await saveJson('package.json', pkg)
  }

  const example = (await read('apps/api/.env.example')).replace(
    /^APP_NAME=.*$/m,
    `APP_NAME=${identity.name}`,
  )
  try {
    await writeFile(file('apps/api/.env'), example, { flag: 'wx', mode: 0o600 })
    console.log('Created apps/api/.env.')
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
    console.log('Preserved existing apps/api/.env.')
  }

  if (values['configure-only']) {
    console.log(
      'Configuration saved. Run pnpm setup:project to install dependencies and prepare the API.',
    )
    return
  }

  const env = parseEnv(await read('apps/api/.env'))
  if (
    env.NODE_ENV !== 'development' ||
    (process.env.NODE_ENV && process.env.NODE_ENV !== 'development')
  ) {
    throw new Error(
      'Project setup is for local development. Set NODE_ENV=development before continuing.',
    )
  }
  run(['install', '--frozen-lockfile'])
  run(['exec', 'oxfmt', '--write', 'packages/shared/src/index.ts'])
  if (!env.APP_KEY) {
    run(['--filter', '@poc/api', 'exec', 'node', 'ace', 'generate:key'])
  }
  run(['generate'])
  await mkdir(file('apps/api/tmp/'), { recursive: true })
  run(['--filter', '@poc/api', 'exec', 'node', 'ace', 'migration:run'])
  console.log(
    `\n${identity.displayName} is ready.\n\nStart the API: pnpm dev:api\nIn another terminal: pnpm dev:web\n\nReview and commit the project configuration. Keep apps/api/.env private.`,
  )
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`)
  process.exitCode = 1
})
