# AdonisJS Multi-Client Starter

A pnpm and Turborepo starter with an authenticated, database-backed AdonisJS API shared by React web, Expo mobile, and Electron desktop clients.

## Architecture

```text
Adonis routes + Vine validators + controller responses
                         |
                         v
              generated Tuyau registry
                         |
                         v
                  @poc/api-client
                  /       |       \
                 v        v        v
               web      mobile   desktop
```

The API is the contract source of truth. `@poc/api-client` imports the generated registry and exposes both a direct typed client and a TanStack Query adapter. Turbo generates the registry before development, builds, type checks, and tests, including filtered commands.

## Requirements

- Node.js 24 or newer
- pnpm 11.22.0 through Corepack

## Setup

### Create a new project

Click [Use this template](https://github.com/Yazeed0xx/adonisjs-monorepo-starter/generate)
on GitHub, give the new repository a name, and clone it. Or use an authenticated
GitHub CLI from the folder where you keep your projects:

```bash
gh repo create restaurant-app --template Yazeed0xx/adonisjs-monorepo-starter --private --clone
cd restaurant-app
```

Then run:

```bash
corepack enable
pnpm setup:project
```

Setup asks for a project name, display name, and iOS/Android app identifier. It
updates the root package name, mobile identity, desktop product name, page titles,
and shared demo label. It creates the API `.env`, installs the locked dependencies,
generates an API key when missing, runs SQLite migrations, and generates the API
contracts. Use an identifier you own, such as `com.yourcompany.restaurant`; the
`com.example` default is a development placeholder.

No dependencies need to be installed before running setup. If Corepack is missing,
install it with `npm install --global corepack` and then run `corepack enable`.
The repository pins the pnpm version. Use `pnpm setup:project`, not `pnpm setup`
(which is pnpm's own environment setup command).

For a noninteractive setup:

```bash
pnpm setup:project --name restaurant-app --display-name "Restaurant App" --app-id com.yourcompany.restaurant
```

Existing `.env` files and nonempty API keys are preserved. Setup records the chosen
identity in `package.json` under `starterProject`; rerunning it resumes installation
and API preparation without renaming the project or overwriting later UI edits.
If installation fails, fix the reported error and run the same command again.
Do not run first-time setup in your master starter repository.

Internal `@poc/*` workspace names stay unchanged so imports, filters, and the lockfile
remain consistent. New projects are independent copies; starter updates do not
automatically propagate to them. Commit the generated project configuration, but
never commit `.env` files.

For configuration only, add `--configure-only`; later run `pnpm setup:project` to
complete installation and API preparation. See `pnpm setup:project --help` for options.

### Start building

Start the backend:

```bash
pnpm dev:api
```

In another terminal, start the web app:

```bash
pnpm dev:web
```

## Development

Start every application:

```bash
pnpm dev
```

Start one application:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
pnpm dev:desktop
```

Client-only commands do not start the API. Run `pnpm dev:api` in another terminal when the client needs a local backend, or use `pnpm dev` to start everything.

Turbo runs API contract generation before every development task. Client-only filtered workflows therefore work from a clean checkout after environment setup.

## Default URLs

| Service              | URL                     |
| -------------------- | ----------------------- |
| API                  | `http://localhost:3333` |
| Web                  | `http://localhost:5173` |
| Desktop renderer     | `http://localhost:5174` |
| Android emulator API | `http://10.0.2.2:3333`  |

Override client API URLs with `VITE_API_URL` for web and desktop or `EXPO_PUBLIC_API_URL` for mobile. Set these variables explicitly when producing deployable client artifacts; the defaults are local development addresses. A physical mobile device must use the development machine's LAN address.

For physical-device development, set `HOST=0.0.0.0` in `apps/api/.env` and point `EXPO_PUBLIC_API_URL` at the development machine's LAN address.

## Commands

| Command              | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `pnpm setup:project` | Configure a new project and prepare local development                                |
| `pnpm test:setup`    | Test setup in isolated temporary folders                                             |
| `pnpm generate`      | Generate Adonis indexes and the Tuyau registry                                       |
| `pnpm lint`          | Check the repository with Oxlint                                                     |
| `pnpm lint:fix`      | Apply safe Oxlint fixes                                                              |
| `pnpm format`        | Check repository formatting with Oxfmt                                               |
| `pnpm format:fix`    | Format the repository with Oxfmt                                                     |
| `pnpm typecheck`     | Generate contracts and type-check all workspaces                                     |
| `pnpm test`          | Run workspace tests                                                                  |
| `pnpm build`         | Generate contracts and build all workspaces                                          |
| `pnpm verify`        | Run lint, type checks, tests, builds, contract propagation, and runtime smoke checks |

## AdonisJS Conventions

AdonisJS creation and architecture conventions are documented in `AGENTS.md` and
[Adonis lint rules](docs/adonis-lint.md). `pnpm lint` enforces the concrete conventions
with a local Oxlint plugin; `pnpm test:lint` tests its rules and file scopes.

## Contract Workflow

Define named routes in `apps/api/start/routes.ts`, validate inputs with Vine, and return typed controller responses. After changing the contract, run:

```bash
pnpm generate
```

Calls such as `api.test.store({ body: ... })` and `api.users.show({ params: ... })` update automatically. `packages/api-client/type-tests` checks expected compile-time failures, while `scripts/verify-contract-change.mjs` confirms a newly required server field breaks stale client calls.

## Package Responsibilities

| Workspace             | Responsibility                                                   |
| --------------------- | ---------------------------------------------------------------- |
| `apps/api`            | Auth, Lucid/SQLite, HTTP delivery, and generated contract source |
| `apps/web`            | Browser UI and TanStack Query integration                        |
| `apps/mobile`         | Expo UI and mobile-specific environment/storage behavior         |
| `apps/desktop`        | Electron shell and renderer UI with TanStack Query               |
| `packages/api-client` | Platform-neutral Tuyau transport and React Query adapter         |
| `packages/shared`     | Small framework-neutral values and utilities                     |
| `packages/tsconfig`   | Shared TypeScript presets                                        |

Keep product business logic in API services rather than controllers, and keep platform-specific UI or storage inside each application. Split `packages/shared` only when a real reusable domain boundary emerges.

## Environment

API variables are documented in `apps/api/.env.example`. Production browser origins are a comma-separated `CORS_ORIGINS` allowlist. `DB_DATABASE` may be relative to the API process working directory during development, but deployments should use an absolute path to durable storage. Do not commit real `.env` files; only `.env.example` and safe test defaults are tracked.

The compiled API can be started after `pnpm build` with `pnpm --filter @poc/api start`. Keep `APP_URL` explicit in `.env`; Node's compiled-mode env loader does not expand `${HOST}` or `${PORT}` placeholders.

## Authentication And Database

The API follows the official AdonisJS v7 API starter structure. SQLite is configured through Lucid, migrations create users and access tokens, and `database/schema.ts` is generated from the migrated database. Do not edit that file manually.

Authentication routes are available under `/api/v1`:

| Method | Route                     | Purpose                               |
| ------ | ------------------------- | ------------------------------------- |
| `POST` | `/api/v1/auth/signup`     | Create a user and access token        |
| `POST` | `/api/v1/auth/login`      | Verify credentials and create a token |
| `GET`  | `/api/v1/account/profile` | Return the authenticated profile      |
| `POST` | `/api/v1/account/logout`  | Revoke the current access token       |

After changing migrations, run `pnpm --filter @poc/api exec node ace migration:run`. Lucid regenerates `database/schema.ts` automatically.

## Verification

`pnpm verify` performs:

1. Repository linting with Oxlint.
2. Repository formatting with Oxfmt.
3. Type checking with generated contracts.
4. Functional API and authentication tests.
5. Production builds.
6. A contract propagation test.
7. Runtime query, body, parameter, response, compiled-database, and authentication smoke tests.

An optional GitHub Actions definition is available at `docs/ci.example.yml`. Copy it to
`.github/workflows/ci.yml` when CI is needed; pushing that workflow over HTTPS requires a token
with the `workflow` scope.

The repository is intentionally a starter. Product-specific domain packages, deployment, and release workflows should be added only when required by the application built from it.
