# Starter development instructions

## CodeGraph

If `.codegraph/` exists at the repository root, use `codegraph explore` or the
CodeGraph MCP tool before text searches or file reads to locate or understand code.
Otherwise skip CodeGraph; do not create an index automatically.

## Generate AdonisJS resources with Ace

Before creating an AdonisJS application file, check whether the installed version
provides a suitable Ace generator. When one exists, you MUST run it first:

```bash
pnpm --filter @poc/api exec node ace list
pnpm --filter @poc/api exec node ace make:controller --help
pnpm --filter @poc/api exec node ace make:controller Users --resource
```

Use the appropriate installed generator for controllers, models, migrations,
validators, services, middleware, policies, transformers, tests, and other supported
resources. Inspect the command's `--help` for names and flags; do not assume them.
Do not substitute patches, shell redirection, copying another resource, or custom
scripts for an available generator. Generate first, then edit the generated file.
If no suitable generator exists, manual creation is allowed; explain the exception.
If a generator fails, fix the cause and retry instead of silently creating its output
manually. Include the generator commands used in the completion report.

Never manually edit `apps/api/database/schema.ts` or files in `.adonisjs/`.
Regenerate the schema through migrations and API indexes/contracts with `pnpm generate`.
Lint checks resulting code, not proof of how a file was created.

## AdonisJS conventions

- Follow the installed AdonisJS generation and existing first-party APIs. Prefer
  appropriate first-party packages over custom infrastructure.
- Controllers own HTTP input, Vine validation, authorization, and responses.
  Keep simple model operations there when extraction would add only a wrapper.
  Put transactions, multi-model orchestration, and reusable business operations
  in services or single-operation Actions. This starter keeps database-client imports
  out of controllers as an architecture preference, not an AdonisJS requirement.
  Do not import another controller to reuse its behavior; extract shared logic.
- Prefer explicit inputs for business services and Actions reused across HTTP, jobs,
  and CLI. Request-oriented services may inject `HttpContext` or `Logger`, as the
  official docs demonstrate. Keep their request-scoped resolver bindings; do not
  store request context in global singletons.
- Inject service/Action class collaborators instead of constructing them with `new`
  inside the application folders covered by lint (a starter convention). Add
  class-level `@inject()` for constructor injection and method-level `@inject()`
  for method injection. Auto-resolved dependencies need value imports, not
  `import type`. The first controller handler argument is supplied by the router,
  so its `HttpContext` type may be imported with `import type`.
  Stateless functions and established singleton service imports need no injection.
  Do not create container bindings or providers without a lifecycle or abstraction need.
- Use static imports in controllers, services, Actions, policies, validators, and
  exceptions. Keep lazy imports at established boundaries such as routes/providers
  and first-party config callbacks (for example, auth's lazy model loader).
- Validate environment values in `#start/env`, consume them in config, and prefer
  config for application settings. Use the framework logger; use `ctx.logger` for
  request-correlated logs. CLI/tooling output has a different scope.
- Generate focused migrations for table creation or alteration. Use seeders for
  initial/reference/demo records and factories for test data. Use `this.defer` for
  ordered schema-coupled backfills; it is a documented Lucid API and is skipped in
  dry runs. Keep migrations independent of runtime application models/generated
  schemas, using the migration query client for historical data changes.
- Preserve generated model schema inheritance, transformers, and typed API contracts.
  Prefer model queries and Lucid builders before raw SQL. Let the central exception
  handler handle ordinary failures; catch only for genuine recovery or translation.
  Prefer named exceptions for reusable domain failures, without banning ordinary
  `Error` for unexpected local failures.

## Checks

Run `pnpm lint`, focused tests for changes, and formatting checks on changed files.
Run `pnpm test:lint` when changing the local Oxlint plugin or its configuration.
Do not disable rules globally to pass checks; correct the code or document a narrow exception.
See `docs/adonis-lint.md` for rule scope and limits.

Machine-specific simulator/testing restrictions belong in local instructions, not
in this reusable starter's rules for every developer machine.
