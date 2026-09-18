# Phase 2: writing and publishing

Implemented on the existing AdonisJS 7 / Lucid 22 / Vine 4 backend. No new runtime
packages. The Phase 1 account and source foundation remains in place.

## Behavior

- Writers create private drafts with a required title and Arabic/English language.
- Every successful save appends a revision. Existing revision content is never
  overwritten by these endpoints.
- Publishing selects the current draft revision. Later draft edits do not change
  the public title, language, or content until explicitly republished.
- Unpublishing immediately removes the article from public detail and list queries.
  Drafts and revision history remain available to the owner.
- Preview is an owner-only read of the saved draft; it does not publish or save.
- Arabic articles default to RTL; English articles default to LTR. Individual blocks
  can override direction, including `auto` for mixed text.
- Both short ideas and long essays use the same document shape.

## Endpoints

All paths start with `/api/v1`. Private endpoints require the existing bearer token.

| Method      | Path                              | Result                                                 |
| ----------- | --------------------------------- | ------------------------------------------------------ |
| POST        | `/account/articles`               | Create a private draft; 201                            |
| GET         | `/account/articles`               | Paginated summaries of the signed-in writer's articles |
| GET         | `/account/articles/:id`           | Owner-only draft and publication state                 |
| PUT / PATCH | `/account/articles/:id`           | Save a complete new draft revision                     |
| GET         | `/account/articles/:id/preview`   | Same saved draft representation, owner-only            |
| POST        | `/account/articles/:id/publish`   | Select the current draft for public reading            |
| POST        | `/account/articles/:id/unpublish` | Remove public visibility                               |
| GET         | `/articles`                       | Paginated published summaries                          |
| GET         | `/articles/:id`                   | Published revision and public writer profile           |

PUT and PATCH both require the complete document; neither accepts a partial editor
patch in this phase. Article deletion, revision restore, and shared preview tokens
are not exposed.

### Create/save input

```json
{
  "title": "مقال عن الأفكار",
  "language": "ar",
  "content": {
    "version": 1,
    "blocks": [
      { "id": "intro", "type": "paragraph", "text": "فكرة تستحق القراءة" },
      {
        "id": "quote-1",
        "type": "quote",
        "direction": "ltr",
        "text": "An English quotation within an Arabic essay."
      }
    ]
  }
}
```

For updates, also send `expectedVersion`, equal to the last response's `lockVersion`.
Block IDs are supplied by the editor and retained when editing or moving blocks.
Generate a new ID for a genuinely new block. Accepted IDs use 1–100 ASCII letters,
digits, hyphens, or underscores, and must be unique within the document.

| Block type                   | Additional fields                                            |
| ---------------------------- | ------------------------------------------------------------ |
| `paragraph`                  | `text`, 1–20,000 characters                                  |
| `heading`                    | `text`, 1–500 characters; `level`: 2, 3, or 4                |
| `quote`                      | `text`, 1–20,000 characters                                  |
| `code`                       | `text`, 1–20,000 characters; whitespace preserved            |
| `bulletList` / `orderedList` | `items`: 1–100 nonempty strings, up to 2,000 characters each |

All blocks accept optional `direction`: `ltr`, `rtl`, or `auto`. Omission inherits
article direction. Documents support up to 500 blocks; the existing HTTP body size
limit also applies. Titles are trimmed and limited to 240 characters. Drafts can
have an empty block array, but publication requires at least one valid block.
Prose is trimmed; code indentation and trailing newlines survive round trips.

The JSON body parser no longer globally trims strings, so validators own text
normalization. Profile normalization remains compatible; signup names are now
explicitly trimmed and bounded. Password whitespace is preserved.

Content is structured plain text, not trusted HTML. A future frontend must render
text through normal escaping, never inject it as HTML. Arbitrary HTML/embed block
types are rejected. Links, formatting marks, and resource editing controls will
extend the document/API contract in later phases; no external fetch occurs here.

### Publication input and conflicts

```json
{ "expectedVersion": 2 }
```

Every successful update, publish, or unpublish increments `lockVersion`. A stale
version returns 409 with:

```json
{
  "errors": [
    {
      "code": "E_ARTICLE_CONFLICT",
      "message": "This article has changed. Reload it before saving or publishing."
    }
  ]
}
```

Clients should reload and reconcile their local edits. Do not automatically retry
with a newer version: that could overwrite newer work or publish an unseen draft.
Replaying an already successful command with the old version also returns 409;
this is conflict detection, not an idempotency-key/replay system.

An empty-draft publish returns 422 and leaves the version and publication state
unchanged. Guest private access returns 401; another account's private operations
return 403. Missing IDs return 404 and malformed IDs return 422. Draft/unpublished
articles return 404 on the public endpoint even to their author.

Successful item responses are wrapped in `data`. Private responses include
`lockVersion`, `publishedRevisionId`, `publishedAt`, `hasUnpublishedChanges`, and
`draft` (revision ID/number, title, language, direction, and content). Public
responses expose only the selected revision and public author fields.

`publishedAt` is preserved when republishing a still-public article. Unpublishing
clears it; publishing again starts a new publication date. Private lists sort by
`updatedAt`, then ID; public lists sort by `publishedAt`, then ID, descending.

### Lists and caching

Both list endpoints accept `page` (default 1, max 100,000) and `perPage` (default 20,
max 50). Public lists also accept `language=ar|en` and positive `authorId`.
Filtering uses the published revision's language, never the private draft.

Lists use transformer summary variants and omit content bodies. Pagination links
retain filters. Public and private item/list responses use `Cache-Control: no-store`
(private responses additionally use `private`) until a later caching strategy can
reliably invalidate unpublished content.

## Persistence and concurrency

Two focused migrations add:

1. A composite unique revision identity `(article_id, id)`.
2. Article draft/published revision pointers, publication timestamp, and lock version.

Composite foreign keys ensure both selected revisions belong to the same article.
The second migration adopts each existing article's latest revision as a private
draft using `this.defer`; it never publishes existing data. This is a schema-coupled
backfill, not seed data. Articles without existing revisions keep a null draft.

The publication-state migration disables Lucid’s outer migration transaction on
this SQLite project. Knex then owns each table-rebuild transaction and can suspend
foreign-key enforcement during the rebuild without cascading into child rows.
The overall migration is consequently not one atomic transaction; run migrations
with backups and normal deployment controls. A populated-data regression test
covers both directions. Reassess this setting if the database dialect changes.

The service uses a managed transaction for each dependent write. Its first write
conditionally increments the version for the article and owner, preventing stale
writers from proceeding. On SQLite this also acquires the write lock before the
revision is read. Failed operations roll back the claim and all dependent changes.

For retained block IDs, saving copies references to the new revision. Removed
blocks lose their references only in the new revision. Earlier revision references
remain untouched. Resource attachment/editing and quote revalidation remain Phase 4.

Revision immutability is enforced by this API workflow, not a database trigger.
Future services/importers must use the same append-only convention. Typed models
and direct database access are not substitutes for application authorization.

## Verification

- 26 API tests pass, including 11 publishing/concurrency scenarios and a populated-migration regression test.
- Two competing saves: one succeeds, one returns 409, with no duplicate revision.
- Save racing publish: one succeeds, and no unseen draft is published.
- Lifecycle, ownership, private/public isolation, mixed direction, code whitespace,
  validation, stale requests, transaction rollback, filtering, pagination, source
  retention, same-article foreign keys, and cascade deletion are covered.
- A separate temporary SQLite database verified upgrade from populated Phase 1,
  preservation through rollback, and successful reapplication. Schema generation
  was disabled for this isolated check so it could not overwrite project types.
- Backend typecheck, root lint, changed-file formatting, and generated contracts.

## Ace commands used

Help was inspected before scaffolding. All commands ran from the repository root.

```sh
pnpm --filter @poc/api exec node ace list
pnpm --filter @poc/api exec node ace make:migration add_article_revision_identity --alter
pnpm --filter @poc/api exec node ace make:migration add_article_publication_state --alter
pnpm --filter @poc/api exec node ace make:controller DraftArticles --resource
pnpm --filter @poc/api exec node ace make:controller Articles --resource
pnpm --filter @poc/api exec node ace make:service ArticlePublishing
pnpm --filter @poc/api exec node ace make:validator article
pnpm --filter @poc/api exec node ace make:transformer Article
pnpm --filter @poc/api exec node ace make:transformer DraftArticle
pnpm --filter @poc/api exec node ace make:exception ArticleConflict
pnpm --filter @poc/api exec node ace make:test articles --suite=functional
pnpm --filter @poc/api exec node ace make:test article_migrations --suite=functional
pnpm --filter @poc/api exec node ace migration:run
pnpm generate
pnpm --filter @poc/api typecheck
pnpm --filter @poc/api test
pnpm lint
```

The two generated migration filenames were renamed descriptively before editing.
Models extend the regenerated schema classes; `.adonisjs` indexes were regenerated.
No generated schema or index was edited by hand. Documentation has no Ace generator
and was written directly.
