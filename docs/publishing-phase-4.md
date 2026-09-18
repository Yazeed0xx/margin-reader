# Phase 4: references and reading APIs

Implemented citation editing through article revisions, public source previews and
separate content retrieval, private bookmarks, and revision-aware reading progress.
No additional packages, frontend screens, or production deployment are required by
this phase. Existing bearer authentication and ArticlePolicy protect draft edits.

## Editing citations

The existing article create and save endpoints accept an optional `references`
array, with at most 100 entries and unique `referenceKey` values:

```json
{
  "referenceKey": "study-1",
  "blockId": "intro",
  "resourceId": 12,
  "commentary": "Why this source matters",
  "selectedQuote": "An exact passage from permitted fetched text.",
  "videoStartSeconds": null
}
```

Include this array alongside the existing title, language, content, and (for saves)
`expectedVersion` fields. Each citation is attached to a document block; inline
character-range annotations are not part of the version 1 document contract.

- Supplying an array replaces the entire reference set for the **new draft revision**.
- Supplying `[]` removes all references from the new draft.
- Omitting it preserves earlier references on block IDs that still exist.
- Removing a block removes its references only from the new revision.
- Every successful save creates a revision and uses the existing version conflict
  checks. Editing a citation never changes a published revision in place.
- Full article and saved-draft responses now include their revision's `references`.
  List summaries omit citations and article content.

Reference and block keys contain 1–100 ASCII letters, digits, underscores, or
hyphens. Commentary is optional/nullable, trimmed, and limited to 5,000 characters.
Quotes are optional/nullable, trimmed, and limited to 2,000 characters. Explicitly
submitted quotes must match a substring of the source's currently permitted fetched
text. For metadata-only sources, use commentary; this endpoint does not pretend to
verify an unfetched passage. Previously saved quotes remain historical citation
text when references are carried forward without replacement; they are not silently
rewritten when a remote source changes.

Newly submitted references require an access grant obtained through Phase 3 ingestion.
Knowing another writer's resource ID does not grant attachment rights. Block IDs must
exist in the submitted document. Timestamps require a YouTube video resource and an
integer from 0 to 604,800 seconds; actual duration is not known from oEmbed. Save and
publish recheck structural targets. Publishing does not require successful external
fetching, so an unavailable source can retain its fallback link.

Invalid references return 422 (`E_INVALID_REFERENCE`); malformed field shapes use
normal Vine validation errors. Stale article versions remain 409. All dependent
writes, including the article version claim, roll back on failure.

## Public source access

| Method | Path                                                              | Result                                                         |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| GET    | `/api/v1/articles/:id/sources/:referenceKey?revisionId=…`         | `{ data: { reference, resource } }` preview                    |
| GET    | `/api/v1/articles/:id/sources/:referenceKey/content?revisionId=…` | `{ data: { id, contentText, displayPolicy, rightsEvidence } }` |

Pass the `revisionId` returned by the article reader endpoint. A single query binds
the citation to that article's **current published revision**. Draft revisions,
unpublished articles, references from another article, and superseded published
revisions return 404. After republishing, readers should reload the article before
opening its sources. Missing or malformed revision parameters return 422.

Preview responses omit full extracted text. Content is fetched through the second
endpoint only when the reader requests it. Permission is rechecked on every content
response; restricted, pending, failed, video, and metadata-only sources return null
text and their display policy. The original URL remains available in the preview.
YouTube previews include the approved player configuration; the citation separately
supplies its start time. Public reads do not grant private resource access or enqueue
work. These endpoints use `Cache-Control: no-store`.

Source metadata/content remain a shared, refreshable cache. Revision-specific
commentary, selected quotes, and video timestamps are immutable snapshots. As with
ordinary HTTP reads, a request already in flight can complete during an unpublish;
subsequent reads require the current publication pointer.

## Bookmarks

All account routes require bearer authentication and use `private, no-store`.

| Method | Path                                    | Behavior                                                    |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| GET    | `/api/v1/account/bookmarks`             | Paginated public article summaries, newest saved first      |
| GET    | `/api/v1/account/articles/:id/bookmark` | `{ data: { articleId, bookmarked } }`                       |
| PUT    | `/api/v1/account/articles/:id/bookmark` | Set bookmark, returning 200; repeated calls are idempotent  |
| DELETE | `/api/v1/account/articles/:id/bookmark` | Remove own bookmark, returning 204 even when already absent |

Lists accept `page` (default 1, max 100,000) and `perPage` (default 20, max 50), with
stable created-at/ID ordering and preserved pagination parameters. A database
unique key prevents duplicate bookmarks under concurrent requests. No endpoint
accepts a target user ID. Unpublished articles are hidden from the list and cannot
be newly bookmarked; the saved association survives republishing. Deletion remains
available after unpublishing. If publication changes between a list query and its
preload, a saved item can have a null article rather than expose a draft.

## Reading progress

| Method | Path                                    | Behavior                                                                |
| ------ | --------------------------------------- | ----------------------------------------------------------------------- |
| GET    | `/api/v1/account/articles/:id/progress` | Own saved position or null, current revision ID, and `needsReanchor`    |
| PUT    | `/api/v1/account/articles/:id/progress` | Save a checked position; return its incremented `lockVersion`           |
| DELETE | `/api/v1/account/articles/:id/progress` | Clear the position using `{ "expectedVersion": … }`; return reset state |

PUT example:

```json
{
  "expectedVersion": 0,
  "revisionId": 42,
  "blockId": "intro",
  "blockProgress": 0.35
}
```

`blockProgress` is a fraction from 0 to 1 within the block, not an overall article
percentage or a device-specific pixel offset. This supports restoring position
across viewport sizes. The frontend will implement the actual scroll restoration.
Use version 0 only when GET returns no saved row; otherwise use its `lockVersion`.
The article's revision and saved-position version are independent.

Saving requires a current published revision and an existing block. Stale position
versions, old article revisions, and missing block anchors return 409 with
`E_READING_CONFLICT`; malformed inputs return 422. Clients should reload and reconcile
rather than automatically retry a stale write. Two competing saves from the same
version result in one success and one conflict. GET marks positions from an older
publication with `needsReanchor: true`; it never silently remaps them.

Reset retains a versioned row with null revision/block and zero block progress.
This prevents delayed saves from resurrecting cleared progress using version 0.
Reset remains available after unpublishing, while reading/saving hidden articles
returns 404. Reading state is never exposed in public article responses or to other
accounts. Bookmarks and progress cascade when their user/article is deleted; the
progress composite foreign key prevents pairing an article with another's revision.

## Queue lifecycle correction

Checking the generated contracts exposed an integration issue from Phase 3:
`@adonisjs/queue` 0.6.2 opens database resources in boot/start, and the scheduler
preload also schedules work during codegen's warmup. Warmup deliberately skips
shutdown hooks, leaving the command alive after generation.

The generated `QueueLifecycleProvider` extends the native provider and skips its
boot/start side effects only in warmup. Native bindings and normal runtime behavior
are retained. The scheduler also checks run mode. A subprocess regression verifies
that codegen exits within its timeout and creates no database file. No dependency
code was patched and no forced process exit was added.

## Validation and scaffolding

Run `pnpm generate`, `pnpm --filter @poc/api typecheck`, `pnpm --filter @poc/api test`,
`pnpm lint`, and changed-file `oxfmt --check`. The full suite covers citation/publication
isolation, rollback, permissions, quote and video targets, bookmark privacy and
pagination, progress conflicts/reset/reanchoring, concurrent saves, database cascades,
existing processing behavior, migrations, and codegen lifecycle.

After inspecting Ace list/help, these generators were used (prefix every command
with `pnpm --filter @poc/api exec node ace`):

```text
make:model Bookmark -m
make:model ReadingProgress -m
make:service ArticleReferences
make:service ReadingState
make:controller ArticleSources --resource
make:controller Bookmarks --resource
make:controller ReadingProgress --resource
make:validator reading
make:transformer ArticleReference
make:transformer Bookmark
make:transformer ReadingProgress
make:transformer DraftRevision
make:exception InvalidReference
make:exception ReadingConflict
make:provider QueueLifecycle --no-register
make:test reading --suite=functional
make:test queue_lifecycle --suite=functional
migration:run
```

The provider was then registered in place of the native queue provider. Schema and
API contracts were regenerated; generated files were never hand-edited. This
Markdown document was created directly because Ace has no documentation generator.
