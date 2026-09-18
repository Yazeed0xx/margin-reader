# AdonisJS lint conventions

`pnpm lint` runs Oxlint with the local plugin in `tooling/oxlint/adonis.mjs`.
No ESLint installation is required. `pnpm test:lint` exercises the actual Oxlint CLI
and file overrides; `pnpm verify` includes it. Oxlint is pinned because its JavaScript
plugin API is in alpha; run these tests on upgrades.

The defaults were reviewed against the official docs and installed Core 7.5.0,
Lucid 22.4.2, Auth 10.1.0, Vine 4.4.0, and Fold 11.1.0. This is a review of the
conventions below, not every package or page in the AdonisJS ecosystem.

## Enabled checks

Custom rules have the `adonis/` prefix; `no-console` is built into Oxlint.

| Rule                              | Scope                                                            | What it detects                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-runtime-models-in-migrations` | API migrations                                                   | Runtime imports/re-exports and literal dynamic imports of application models or generated schema classes. Type-only imports are allowed.       |
| `no-controller-import`            | Controllers, services, Actions                                   | Reusing a controller through a runtime import or re-export.                                                                                    |
| `require-constructor-inject`      | Controllers, services, Actions, policies, middleware, listeners  | Constructor dependencies on imported services/Actions, `HttpContext`, or `Logger` without class-level `@inject()`.                             |
| `require-method-inject`           | Controllers                                                      | Service/Action/context/logger parameters after a recognized first `HttpContext` parameter without method-level `@inject()`.                    |
| `injection-runtime-imports`       | Same folders as constructor check                                | Type-only imports in decorated constructors or auto-resolved slots of decorated controller HTTP methods. The first context argument is exempt. |
| `use-validated-env`               | API app and config                                               | Global/imported `process.env`, including literal bracket access and named `env` imports.                                                       |
| `no-console`                      | API app                                                          | Console output; use request-aware/framework logging. CLI and tooling output remains allowed.                                                   |
| `no-controller-database`          | Controllers                                                      | Lucid database client/class imports; a starter architecture preference. Simple model calls remain allowed.                                     |
| `no-new-service`                  | Controllers, services, Actions, policies, validators, exceptions | `new` on imported service/Action classes; a starter preference for container-managed collaborators.                                            |
| `prefer-static-imports`           | Same folders as `no-new-service`                                 | Dynamic `import()` outside the established lazy-loading boundaries; a starter convention.                                                      |

Model/service/controller checks recognize canonical aliases and relative paths
within `apps/api/app`. Injection checks follow renamed import bindings and local
shadowing. Class decorator aliases and namespace `core.inject()` are supported.

## Corrections from the documentation review

- **Data migrations may use `this.defer`.** It orders data changes with schema work
  and is skipped during dry runs. Use seeders for reference/demo data and factories
  for test data; a linter cannot infer which purpose a callback serves.
- **Request-oriented services may inject `HttpContext`.** Keep reusable domain logic
  transport-independent where useful, but do not reject documented request-scoped
  services. Use the request resolver and avoid global singleton context retention.
- **Constructor and method injection are different.** A class decorator does not
  enable method injection. Auto-resolved dependencies must survive compilation as
  value imports; the router-supplied first controller parameter can be type-only.
- **Framework service imports are normal.** Importing a ready-to-use framework
  singleton does not violate dependency injection conventions.
- **Lazy auth configuration is valid.** Do not reject `model: () => import(...)`
  callbacks or import application models eagerly during config boot.
- **Ordinary errors remain valid.** Named exceptions suit reusable domain failures;
  there is no blanket rule prohibiting `throw new Error`.

`no-migration-defer` and `no-service-http` remain available as optional stricter
project policies, but are disabled by default. Enabling them is an architecture
choice with documented exceptions, not a claim that AdonisJS forbids these patterns.
For example, a team that wants review of every backfill may enable the defer rule
in its migration override and use a narrow documented suppression:

```ts
// oxlint-disable-next-line adonis/no-migration-defer -- Backfill the new column after its schema statement executes.
this.defer(async (db) => {
  // Versioned data transformation.
})
```

## Limits and review responsibilities

These are syntax checks, not exhaustive type-aware or cross-file analysis. Arbitrary
barrel re-exports, runtime-computed import paths, variable aliases of imports, and
namespace-qualified dependency type annotations are not fully resolved. Runtime-import
checks do not inspect every decorated service method: `container.call` callers may
supply explicit leading runtime arguments. Manual injection metadata, inherited
constructors, explicit bindings, and unusual factories need review or narrow exceptions.
Type-only model imports avoid runtime coupling but can still create maintenance coupling.

Tests, commands, providers, frontend code, and generated files are outside the
application architecture scopes. No automatic architectural fixes are provided.
Use a rule-specific suppression with a reason when a legitimate exception is needed.

Review must still establish transaction necessity, validation completeness,
service responsibility, seeding intent, and singleton lifetime. `AGENTS.md` requires
Ace generators where available; lint cannot prove how a file was created.

## Official sources

- [Controllers](https://docs.adonisjs.com/guides/basics/controllers): generators, simple model calls, and injection.
- [Dependency injection](https://docs.adonisjs.com/guides/concepts/dependency-injection): decorator placement, erased imports, and runtime arguments.
- [HTTP context](https://docs.adonisjs.com/guides/basics/http-context): request-scoped services and resolvers.
- [Container services](https://docs.adonisjs.com/guides/concepts/container-services): direct singleton imports.
- [Configuration](https://docs.adonisjs.com/configuration): boot ordering and validated environment values; auth callback exceptions were checked against the installed configuration.
- [Logger](https://docs.adonisjs.com/guides/digging-deeper/logger): structured and request-aware logging.
- [Exception handling](https://docs.adonisjs.com/guides/basics/exception-handling): named domain exceptions and centralized handling.
- [Lucid migrations](https://lucid.adonisjs.com/docs/migrations): deferred data changes, query client, and dry-run behavior. Avoiding evolving application models is a reproducibility policy inferred from migration lifecycle, not an upstream import ban.
- [Lucid seeders](https://lucid.adonisjs.com/docs/seeders): explicit data setup and environments.
- [Oxlint JavaScript plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins): local plugin integration.
