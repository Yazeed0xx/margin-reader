# Margin / هامش — a vibe-coded article-reading prototype

Margin is a **vibe-coded app** built to prototype an idea: a calmer way to read and
share articles, essays, and research without losing your place when exploring a source.
It is an experiment developed through AI-assisted coding and iteration, intended to
explore the product and UX rather than present a finished, production-ready platform.

The central idea is simple: **keep the article and its references in one reading flow.**
Sources expand beneath the paragraph that references them. Videos play inline when the
reader chooses to load them, and closing a source returns the reader to the citation.

## What the prototype explores

- A mobile-first web experience for thoughtful essays, ideas, and research notes.
- Inline source previews, writer commentary, and YouTube videos with timestamps.
- A document-style writing surface with autosave, inline source attachment, preview,
  and publishing.
- English and Arabic content, including right-to-left and mixed-direction articles.
- Bookmarks, following writers, and saved reading progress.

External content is displayed according to the source permissions and provider's
embedding restrictions. Some links offer a preview and an original-source link rather
than their full text.

The article experience currently lives in the web app. The repository also contains
mobile and desktop scaffolding inherited from its AdonisJS multi-client starter.

## Try it with demo content

After setup, seed eight published articles and two private drafts:

```bash
pnpm --filter @poc/api exec node ace db:seed --files database/seeders/demo_article_seeder.ts
```

Examples include short essays, a research notebook, code, lists, video references,
long-form reading, and Arabic writing. See [demo accounts and seed instructions](docs/demo-data.md).

## Stack

React, shadcn/ui with Base UI, and Tailwind CSS power the web interface. AdonisJS,
Lucid/SQLite, and a resource-processing queue power the backend. The pnpm/Turborepo
workspace shares typed API contracts through Tuyau.

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

From your local checkout:

```bash
corepack enable
pnpm setup:project
```

The setup script installs dependencies, creates the API `.env` when missing, generates
an application key, runs SQLite migrations, and generates typed API contracts. Existing
`.env` files and nonempty keys are preserved. The repository already records its project
identity; rerunning setup resumes preparation without renaming it.

If Corepack is missing, install it with `npm install --global corepack`. Use
`pnpm setup:project`, not `pnpm setup` (which is pnpm's own command). Never commit `.env`
files. See `pnpm setup:project --help` for setup options.

### Run the prototype

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

`pnpm dev` and `pnpm dev:api` also start the resource queue worker, so source and video previews process automatically.

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

This is a vibe-coded prototype under active experimentation. The current features are
here to help try the reading and writing idea, gather feedback, and discover what needs
to change. Production deployment and real-reader validation remain separate work.

Implementation notes: [backend](docs/publishing-backend.md),
[web experience](docs/publishing-phase-6.md), and [beta engineering](docs/publishing-phase-7.md).
