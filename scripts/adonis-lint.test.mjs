import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import config from '../oxlint.config.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const controller = 'apps/api/app/controllers/example.ts'
const service = 'apps/api/app/services/example.ts'
const migration = 'apps/api/database/migrations/example.ts'
const cases = [
  ['defer', migration, 'class Migration { up() { this.defer(() => {}) } }', null],
  ['computed-defer', migration, "class Migration { up() { this['defer'](() => {}) } }", null],
  [
    'regular-migration',
    migration,
    "class Migration { up() { this.schema.createTable('users', () => {}) } }",
    null,
  ],
  [
    'optional-defer-policy',
    migration,
    'class Migration { up() { this.defer(() => {}) } }',
    'no-migration-defer',
    { 'adonis/no-migration-defer': 'error' },
  ],
  ['defer-outside-migrations', service, 'class Service { run() { this.defer(() => {}) } }', null],
  [
    'db-controller',
    controller,
    "import db from '@adonisjs/lucid/services/db'; export default db",
    'no-controller-database',
  ],
  [
    'model-controller',
    controller,
    "import User from '#models/user'; export const show = () => User.findOrFail(1)",
    null,
  ],
  ['db-service', service, "import db from '@adonisjs/lucid/services/db'; export default db", null],
  [
    'http-service',
    service,
    "import type { HttpContext } from '@adonisjs/core/http'; export type Input = HttpContext",
    null,
  ],
  [
    'controller-service',
    service,
    "import C from '#controllers/example'; export default C",
    'no-controller-import',
  ],
  [
    'new-service',
    controller,
    "import Renamed from '#services/example'; export const value = new Renamed()",
    'no-new-service',
  ],
  [
    'shadowed-service',
    controller,
    "import Service from '#services/example'; export { Service }; export function make(Service) { return new Service() }",
    null,
  ],
  [
    'static-function',
    controller,
    "import { calculate } from '#services/example'; export const value = calculate()",
    null,
  ],
  [
    'missing-inject',
    controller,
    "import Service from '#services/example'; export default class Controller { constructor(private service: Service) {} }",
    'require-constructor-inject',
  ],
  [
    'aliased-inject',
    controller,
    "import { inject as di } from '@adonisjs/core'; import Service from '#services/example'; @di() export default class Controller { constructor(private service: Service) {} }",
    null,
  ],
  [
    'wrong-inject',
    controller,
    "import { inject } from 'other'; import Service from '#services/example'; @inject() export default class Controller { constructor(private service: Service) {} }",
    'require-constructor-inject',
  ],
  ['no-constructor', controller, 'export default class Controller {}', null],
  [
    'dynamic-import',
    controller,
    "export const load = () => import('#services/example')",
    'prefer-static-imports',
  ],
  [
    'lazy-route',
    'apps/api/start/routes.ts',
    "export const load = () => import('#controllers/example')",
    null,
  ],
  ['env', service, 'export const value = process.env.SECRET', 'use-validated-env'],
  ['computed-env', service, "export const value = process['env']['SECRET']", 'use-validated-env'],
  [
    'imported-process',
    service,
    "import p from 'node:process'; export const value = p.env.SECRET",
    'use-validated-env',
  ],
  [
    'imported-env',
    service,
    "import { env } from 'node:process'; export const value = env.SECRET",
    'use-validated-env',
  ],
  ['shadowed-process', service, 'export function value(process) { return process.env }', null],
  [
    'validated-env',
    service,
    "import env from '#start/env'; export const value = env.get('SECRET')",
    null,
  ],
  ['script-env', 'scripts/example.ts', 'export const value = process.env.SECRET', null],
  [
    'suppression',
    migration,
    'class Migration { up() {\n// oxlint-disable-next-line adonis/no-migration-defer -- Required backfill after adding the column.\nthis.defer(() => {})\n} }',
    null,
  ],
  [
    'relative-new',
    controller,
    "import S from '../services/s.js'; export const x = new S()",
    'no-new-service',
  ],
  [
    'relative-controller',
    service,
    "import C from '../controllers/c.js'; export default C",
    'no-controller-import',
  ],
  [
    'controller-to-controller',
    controller,
    "import C from './other.js'; export default C",
    'no-controller-import',
  ],
  [
    'relative-migration-model',
    migration,
    "import User from '../../app/models/user.js'; export default User",
    'no-runtime-models-in-migrations',
  ],
  [
    'migration-model',
    migration,
    "import User from '#models/user'; export default User",
    'no-runtime-models-in-migrations',
  ],
  [
    'migration-dynamic-model',
    migration,
    "export const load = () => import('#models/user')",
    'no-runtime-models-in-migrations',
  ],
  [
    'migration-model-reexport',
    migration,
    "export { default as User } from '#models/user'",
    'no-runtime-models-in-migrations',
  ],
  [
    'migration-model-types',
    migration,
    "import type User from '#models/user'; export type Input = User",
    null,
  ],
  [
    'migration-schema',
    migration,
    "import { UserSchema } from '#database/schema'; export default UserSchema",
    'no-runtime-models-in-migrations',
  ],
  [
    'seeder-model',
    'apps/api/database/seeders/example.ts',
    "import User from '#models/user'; export default User",
    null,
  ],
  [
    'request-service',
    service,
    "import { inject } from '@adonisjs/core'; import { HttpContext } from '@adonisjs/core/http'; @inject() export default class S { constructor(private ctx: HttpContext) {} }",
    null,
  ],
  [
    'context-missing-inject',
    service,
    "import { HttpContext } from '@adonisjs/core/http'; export default class S { constructor(private ctx: HttpContext) {} }",
    'require-constructor-inject',
  ],
  [
    'namespace-decorator',
    service,
    "import * as core from '@adonisjs/core'; import { HttpContext } from '@adonisjs/core/http'; @core.inject() export default class S { constructor(private ctx: HttpContext) {} }",
    null,
  ],
  [
    'erased-constructor-import',
    service,
    "import { inject } from '@adonisjs/core'; import type { HttpContext } from '@adonisjs/core/http'; @inject() export default class S { constructor(private ctx: HttpContext) {} }",
    'injection-runtime-imports',
  ],
  [
    'erased-inline-import',
    controller,
    "import { inject } from '@adonisjs/core'; import { type S } from '#services/s'; @inject() export default class C { constructor(private service: S) {} }",
    'injection-runtime-imports',
  ],
  [
    'method-injection',
    controller,
    "import { inject } from '@adonisjs/core'; import type { HttpContext } from '@adonisjs/core/http'; import S from '#services/s'; export default class C { @inject() async index(ctx: HttpContext, s: S) { return s } }",
    null,
  ],
  [
    'method-missing-inject',
    controller,
    "import type { HttpContext } from '@adonisjs/core/http'; import S from '#services/s'; export default class C { async index(ctx: HttpContext, s: S) { return s } }",
    'require-method-inject',
  ],
  [
    'class-decorator-not-method',
    controller,
    "import { inject } from '@adonisjs/core'; import type { HttpContext } from '@adonisjs/core/http'; import S from '#services/s'; @inject() export default class C { async index(ctx: HttpContext, s: S) { return s } }",
    'require-method-inject',
  ],
  [
    'erased-method-import',
    controller,
    "import { inject } from '@adonisjs/core'; import type { HttpContext } from '@adonisjs/core/http'; import type S from '#services/s'; export default class C { @inject() async index(ctx: HttpContext, s: S) { return s } }",
    'injection-runtime-imports',
  ],
  [
    'service-method-runtime-input',
    service,
    "import { inject } from '@adonisjs/core'; import type { Input } from './types.js'; export default class S { @inject() send(input: Input) { return input } }",
    null,
  ],
  [
    'auth-lazy-config',
    'apps/api/config/auth.ts',
    "export const provider = { model: () => import('#models/user') }",
    null,
  ],
  [
    'framework-service-import',
    service,
    "import hash from '@adonisjs/core/services/hash'; export default hash",
    null,
  ],
  [
    'ordinary-error',
    controller,
    "export function fail() { throw new Error('Unexpected state') }",
    null,
  ],
  ['app-console', controller, "console.log('debug')", 'eslint(no-console)'],
  [
    'request-logger',
    controller,
    'export function index({ logger }) { logger.info("request") }',
    null,
  ],
  ['cli-console', 'scripts/example.ts', "console.log('progress')", null],
]

test('Adonis conventions run through the real Oxlint CLI and file overrides', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'adonis-lint-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const fixtureConfig = {
    ...config,
    jsPlugins: [{ name: 'adonis', specifier: join(root, 'tooling/oxlint/adonis.mjs') }],
  }
  await writeFile(join(directory, '.oxlintrc.json'), JSON.stringify(fixtureConfig))
  for (const [name, path, code, expected, rules = {}] of cases) {
    await t.test(name, async () => {
      await writeFile(
        join(directory, '.oxlintrc.json'),
        JSON.stringify({
          ...fixtureConfig,
          overrides: [...fixtureConfig.overrides, { files: [path], rules }],
        }),
      )
      const target = join(directory, path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, code)
      const result = spawnSync(
        process.execPath,
        [join(root, 'node_modules/oxlint/bin/oxlint'), '--format', 'json', path],
        {
          cwd: directory,
          encoding: 'utf8',
        },
      )
      assert.ifError(result.error)
      const output = JSON.parse(result.stdout)
      const diagnostics = output.diagnostics.filter(
        (item) => item.code?.startsWith('adonis') || item.code === 'eslint(no-console)',
      )
      assert.deepEqual(
        diagnostics.map((item) => item.code),
        expected ? [expected.startsWith('eslint(') ? expected : `adonis(${expected})`] : [],
        result.stdout + result.stderr,
      )
      assert.equal(result.status, expected ? 1 : 0, result.stdout + result.stderr)
    })
  }
})
