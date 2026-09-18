# Publishing backend: Phase 1

Phase 7 engineering is implemented: see [beta safeguards and operations](publishing-phase-7.md).
Deployment and human beta gates remain outstanding.

Phase 6 is implemented: see [the web reader and writing desk](publishing-phase-6.md).

Phase 5 is implemented: see [following, feeds, and search](publishing-phase-5.md).

Phase 4 is implemented: see [references and reading APIs](publishing-phase-4.md)
for citation editing, reader source access, bookmarks, and progress.

Phase 3 is implemented: see [external resource processing](publishing-phase-3.md)
for ingestion, YouTube support, and worker setup.

Phase 2 is now implemented: see [writing and publishing](publishing-phase-2.md) for
the current article API. This document records the Phase 1 foundation; its Phase 2
deferrals are superseded by that implementation.

## Product decisions

Mobile-first web publishing for thoughtful essays and research, supporting Arabic
and English. Readers explore sources and videos while preserving their place.
Writers and readers share one account type; every account can have a public profile.

Phase 1 adds account/profile preferences, public writer profiles, ownership policies,
and the persistence foundation. Existing token signup/login/logout are retained.
It does not expose article or resource mutation endpoints yet.

## Phases

1. **Foundation (implemented):** accounts, profiles, language preferences, ownership
   policies, core tables, generated contracts, and tests.
2. **Writing/publishing:** validated editor blocks with stable IDs and per-block
   direction, private drafts, immutable published revisions, preview, publish,
   unpublish, public article endpoints, and pagination. Enforce ArticlePolicy on
   every mutation. Add publication state and revision selection in focused migrations.
3. **Resource processing:** safe URL ingestion, normalization, background fetching,
   metadata, approved YouTube embeds, permitted extraction, caching, retries, and
   explicit fallback states. Add provider/rights evidence and fetched-content storage.
4. **Reading APIs:** attach references, validate block/quote/timestamp targets,
   retrieve previews/content separately, bookmarks, and private reading progress.
5. **Discovery:** following, feeds, language filtering, and basic search.
6. **Frontend:** bilingual reader/editor, expandable source sheet, video controls,
   position restoration, accessibility, and mobile interaction tests.
7. **Beta:** reporting/removal, rate limits, monitoring, backups/recovery, and reader tests.

Payments, chat, automatic translation, and AI summaries are outside the initial release.

## HTTP contract

All paths below start with `/api/v1`. Authenticated routes use the existing
`Authorization: Bearer <token>` guard. Successful serialized responses use `{ data: ... }`.

| Method | Path               | Access    | Behavior                                          |
| ------ | ------------------ | --------- | ------------------------------------------------- |
| POST   | `/auth/signup`     | Public    | Existing account creation; returns user and token |
| POST   | `/auth/login`      | Public    | Existing login; returns user and token            |
| POST   | `/account/logout`  | Signed in | Revokes the current token                         |
| GET    | `/account/profile` | Signed in | Private account profile                           |
| PATCH  | `/account/profile` | Signed in | Updates only the authenticated account            |
| GET    | `/writers/:id`     | Public    | Returns only `id`, `fullName`, and `bio`          |

PATCH accepts any subset of:

```json
{
  "fullName": "كاتب / Writer",
  "bio": "Essays about ideas / مقالات وأفكار",
  "interfaceLanguage": "ar",
  "readingLanguage": "both"
}
```

- `fullName`: trimmed, up to 120 characters; nullable.
- `bio`: trimmed, up to 2000 characters; nullable.
- `interfaceLanguage`: `ar` or `en`; database default `en`.
- `readingLanguage`: `ar`, `en`, or `both`; database default `both`.
- Omitted fields stay unchanged. Following installed Vine behavior, null optional
  preferences are ignored; null/blank nullable profile text clears the field.
- Unknown fields are stripped. Neither IDs, passwords, nor email can be changed
  through this endpoint. No target user ID is accepted for profile updates.
- Public profiles never include email, password, preferences, or email-derived initials.

Use the framework's existing error handling: unauthenticated requests return 401,
policy denial returns 403, missing profiles return 404, and validation failures
return 422 with an `errors` array. Invalid credentials retain the starter's 400 response.
The generated Tuyau registry and transformer data types are the TypeScript contract;
this phase does not introduce a separate OpenAPI generator.

## Data model

- **User:** account plus public profile text and private language preferences.
- **Article:** stable identity and author. Publishing state comes in Phase 2.
- **ArticleRevision:** article, positive revision number, title, Arabic/English
  language, and serialized editor document (`contentJson`). The editor document
  schema is deliberately deferred to Phase 2; no endpoint accepts arbitrary JSON.
- **Resource:** a unique source URL and shared metadata. Processing state
  (`pending`, `ready`, `limited`, `failed`) is separate from display policy
  (`metadata`, `embed`, `full_content`). Defaults never grant full-content display.
- **ArticleReference:** revision, resource, stable reference key, containing block
  ID, writer commentary, selected quote, and optional nonnegative video timestamp.

Each revision has unique reference keys. Multiple references may occur within the
same block. Different revisions can reuse a source while preserving distinct
commentary, selected passages, and timestamps. URL normalization and resource-type
validation belong to the later ingestion boundary, not to this schema-only phase.

Foreign keys cascade article deletion through revisions/references. Referenced
resources cannot be deleted, and deleting an article leaves shared resources intact.
Revision numbers are unique within an article. The future publication service must
allocate revision numbers transactionally and treat published revisions as immutable;
Phase 1 does not claim those workflow guarantees.

ProfilePolicy and ArticlePolicy use Bouncer. Profile authorization runs on the
update endpoint; article policies are tested now and will be enforced by Phase 2
controllers. SQLite remains the starter's local database; no production database
migration or deployment is part of this phase.

## Verification

- `pnpm generate`
- `pnpm --filter @poc/api typecheck`
- `pnpm --filter @poc/api test` (14 tests, including 6 foundation scenarios)
- `pnpm lint`
- `pnpm exec oxfmt --check <changed files>`

The API suite runs against the configured test database, migrates it, and rolls it
back. Tests exercise profile ownership, private/public fields, ignored injected
fields, bilingual text, preferences, authentication, policy denial for other users
and guests, revision isolation, unique constraints, timestamps, and deletion behavior.
Full monorepo builds and production exports are not needed for this backend phase.

## Scaffolding record

Generator help was inspected before use. Commands executed from the repository root:

```sh
pnpm --filter @poc/api exec node ace list
pnpm --filter @poc/api exec node ace add @adonisjs/bouncer --package-manager=pnpm
pnpm --filter @poc/api exec node ace make:migration add_profile_preferences_to_users --alter
pnpm --filter @poc/api exec node ace make:model Article -m
pnpm --filter @poc/api exec node ace make:model ArticleRevision -m
pnpm --filter @poc/api exec node ace make:model Resource -m
pnpm --filter @poc/api exec node ace make:model ArticleReference -m
pnpm --filter @poc/api exec node ace make:validator profile
pnpm --filter @poc/api exec node ace make:controller Writers --resource
pnpm --filter @poc/api exec node ace make:transformer Writer
pnpm --filter @poc/api exec node ace make:test foundation --suite=functional
pnpm --filter @poc/api exec node ace make:policy Profile update --model=User
pnpm --filter @poc/api exec node ace make:policy Article update delete --model=Article
pnpm --filter @poc/api exec node ace migration:run
pnpm --filter @poc/api exec node ace schema:generate
pnpm generate
```

The package configure hook generated Bouncer's provider, middleware, and abilities
file. Its optional Edge template sharing was removed because this API has no Edge
view integration. Schemas and API indexes were regenerated, never edited manually.
This documentation was written directly; Ace has no Markdown documentation generator.
