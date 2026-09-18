# Phase 5: following, feeds, and search

Implemented on the existing AdonisJS/SQLite backend, without new dependencies or
external search infrastructure. This is the chronological discovery API for the
future mobile-first frontend, not a recommendation algorithm.

## Following writers

All account endpoints require bearer authentication and use `private, no-store`.
Every account can be followed; no separate writer role is required.

| Method | Path                                 | Result                                      |
| ------ | ------------------------------------ | ------------------------------------------- |
| GET    | `/api/v1/account/following`          | Paginated followed writers and `followedAt` |
| GET    | `/api/v1/account/writers/:id/follow` | `{ data: { writerId, following } }`         |
| PUT    | `/api/v1/account/writers/:id/follow` | Follow; 200, including repeated requests    |
| DELETE | `/api/v1/account/writers/:id/follow` | Unfollow; 204, including repeated requests  |

Only the authenticated account's relationship is read or changed. Request bodies
cannot choose another follower. Following yourself returns 403 through WriterPolicy
and is also prohibited by a database check. Missing target writers return 404 on
GET/PUT; invalid IDs return 422. DELETE is idempotent even if the target is gone.

A unique `(follower_id, writer_id)` constraint and conflict-ignore insert prevent
concurrent duplicates without changing the original follow time. Following lists
sort by creation time then ID descending. They expose only public writer fields:
ID, full name, and biography. No public follower graph, follower counts, email
notifications, or email subscriptions are introduced. Deleting either account
cascades its follow relationships.

## Feed and public discovery

| Method | Path                   | Purpose                                          |
| ------ | ---------------------- | ------------------------------------------------ |
| GET    | `/api/v1/articles`     | Existing public discovery list, now with search  |
| GET    | `/api/v1/account/feed` | Published articles by writers the reader follows |

Both accept:

- `page`: default 1, integer 1–100,000.
- `perPage`: default 20, integer 1–50.
- `language`: `ar`, `en`, or `both`.
- `authorId`: optional positive writer ID, intersected with the other filters.
- `q`: optional trimmed search phrase, 2–200 characters when supplied.

The public list defaults to both languages. The private feed defaults to the
account's `readingLanguage`; an explicit language overrides that preference.
Following nobody returns an empty feed. Unfollowing removes that writer's articles
from subsequent feed requests. The feed includes existing published work as well
as newer articles, rather than restricting results to articles published after the
follow date. Your own articles are available through public discovery and the
existing draft APIs; the following feed does not add them automatically.

Results use existing ArticleTransformer summaries with public author fields, not
article bodies, citations, or extracted source text. Pagination metadata preserves
all effective filters, including a language selected from the reader's preference.
Sorting is `publishedAt DESC, id DESC`. Republishing retains the existing publication
date, so editing alone does not bump an article to the top.

Only the current published revision participates in matching. Draft-only articles
and newer private revisions are excluded even when the author requests the list.
Unpublishing removes subsequent search/feed results. Public responses retain
`no-store`; private responses use `private, no-store`.

## Search behavior and limits

Search matches a literal, normalized substring across the published title and
visible article block text, including list items and code/quote blocks. Both stored
text and query use Unicode NFKC normalization, lowercase conversion, and collapsed
whitespace. Arabic text is supported, but there is no stemming, spelling correction,
diacritic removal, semantic matching, or relevance ranking in this phase.

Percent signs, underscores, quotes, and SQL-looking input are literal characters.
Search does not inspect editor JSON keys, private account fields, source metadata,
external full text, or citation commentary outside the article body.

Each immutable article revision stores a `search_text` projection, created in the
same transaction as its content. A focused migration backfills earlier revisions in
250-row batches from historical JSON; it never imports runtime application models.
It stores projections for drafts too, but discovery always follows the article's
published-revision pointer. The migration disables the outer transaction so SQLite
can safely rebuild the table on rollback without cascading away existing references.

The query uses bound SQLite `instr(search_text, query)` because Lucid has no direct
literal-substring operation and LIKE would interpret wildcard characters. This is
intentionally a small SQLite-specific expression inside the normal Lucid query.
Substring matching scans candidate text; it is not a full-text index. Before a large
public launch, measure corpus size and query latency and choose indexed search as
part of capacity planning. A database-dialect migration must replace this expression.
Offset pagination is deterministic for unchanged data; new publications can shift
page boundaries between requests.

## Verification and generators

The full backend suite passes **54 tests**, including following ownership and
concurrency, preference overrides, pagination, literal/Unicode/body search, private
revision isolation, publication changes, self-follow constraints, deletion cascades,
and populated migration rollback/upgrade with historical text backfill.

Checks: `pnpm generate`, `pnpm --filter @poc/api typecheck`,
`pnpm --filter @poc/api test`, `pnpm lint`, and changed-file formatting checks.

The existing AdonisJS skill and project generator conventions were followed. Ace
list/help was inspected before generation. Commands below used the prefix
`pnpm --filter @poc/api exec node ace`:

```text
make:model Follow -m
make:migration add_revision_search_text --alter
make:controller Follows --resource
make:controller Feeds --resource
make:service ArticleDiscovery
make:service Following
make:validator discovery
make:transformer Follow
make:policy Writer follow --model=User
make:test discovery --suite=functional
migration:run
```

The initial migration invocation encountered not-yet-generated controller indexes;
`pnpm generate` refreshed them, then the migration was rerun successfully. Database
schemas and API contracts were generated, never hand-edited. Documentation was
written directly because Ace has no Markdown generator. No worker or deployment
changes are required by this phase.
