# Phase 3: external resource processing

Phase 4 now adds source attachment and reading APIs and corrects queue/codegen
warmup behavior; see [Phase 4](publishing-phase-4.md).

Implemented backend resource ingestion, durable processing, source metadata, YouTube
playback configuration, permission-gated text extraction, caching, and recovery.
The source sheet/player UI and attaching references to article revisions remain
Phase 4/6 work. No production deployment is included.

## API

These endpoints require the existing bearer authentication. Responses are private
and `Cache-Control: private, no-store`.

| Method | Path                                    | Purpose                                                     |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| POST   | `/api/v1/account/resources`             | Submit `{ "url": "https://…" }`; ingest or reuse a source   |
| GET    | `/api/v1/account/resources/:id`         | Poll processing state and retrieve its preview              |
| POST   | `/api/v1/account/resources/:id/refresh` | Reprocess an expired source; fresh cache entries are reused |

POST returns **202** while processing is pending, otherwise **200**. Responses use
`{ data: resource }`; ingestion additionally returns `suggestedStartSeconds` at the
top level. A YouTube timestamp is a suggestion for the later citation API, never
stored on the shared resource. Unknown client fields cannot grant display rights.
Invalid/unsafe URL syntax returns 422. DNS/network restrictions discovered by the
worker become explicit failure states. Unauthenticated requests return 401; absent
resources and resources the requester has not ingested both return 404.

Each submitting user receives a private access grant. Resources are deduplicated
by normalized URL, but knowing their numeric IDs does not reveal another writer's
sources. Public reader access through published references will be added in Phase 4.

## Processing and display states

- `pending`: durable work requested; poll the resource endpoint.
- `ready`: approved YouTube metadata/playback config, or permitted extracted text.
- `limited`: usable metadata with an explicit limitation such as `metadata_only`,
  `preview_restricted`, `pdf_preview_only`, or `unsupported_type`.
- `failed`: fetching could not complete; `failureCode` gives a stable, safe reason.

`displayPolicy` is independent: `metadata`, `embed`, or `full_content`.
The response includes title, creator, site, language, description, timestamps,
thumbnail when available, `failureCode`, optional plain `contentText`, and optional
`playback`. HTML from external sites or oEmbed is never returned for execution.
A previously fetched title can remain visible during refresh/failure, but full text
and playback are disabled while reprocessing.

Successful/limited results are cached for 24 hours. Failures have a 15-minute
cooldown. Expired records are refreshed on submission or explicit refresh; GET
remains read-only. Changes are guarded by a processing generation, preventing old
jobs from overwriting a newer refresh. Cache durations live in `config/resources.ts`.

## YouTube

Supported URLs include watch, youtu.be, Shorts, live, and embed links on explicitly
recognized YouTube hosts. IDs are validated and canonicalized; `t`, `start`, and
fragment timestamps are parsed separately, capped at seven days.

The worker calls YouTube's official oEmbed endpoint for title/author metadata.
No API key is needed. Returned oEmbed HTML is ignored. The API constructs an
approved `youtube-nocookie.com/embed/<id>` URL with inline playback and autoplay
disabled, plus `requiresUserAction: true` and `availability: unverified`.

A metadata response does not establish that embedding is allowed for every viewer.
The future frontend must load the player on user action, handle IFrame API errors,
preserve reading position, pause on dismissal, and provide an original-link fallback.
It must set player identity/origin/referrer correctly when adding the IFrame API.
No video downloading, rehosting, transcript scraping, or promise to remove YouTube
branding/ads is part of this integration.

## Fetching and extraction boundaries

- HTTP/HTTPS only; reject URL credentials and nonstandard ports.
- Block local/private/reserved addresses and known internal hostname suffixes.
- Resolve every destination, reject mixed public/private DNS answers, and pin the
  actual connection to a validated address while preserving hostname/TLS checks.
- Revalidate each redirect; at most three redirects, 12 seconds total, and 1.5 MB
  of response bytes. Do not forward cookies, authorization, or user headers.
- Request identity encoding; compressed responses that ignore it fail safely.
  Version 1 decodes HTML as UTF-8. No browser execution or remote DOM subresources.
- Detect research metadata from citation fields. PDFs receive a metadata-only
  fallback; PDF downloading/extraction and cross-origin PDF viewers are deferred.
- Default HTML pages to bounded metadata. Full text requires an operator-approved
  **final origin** plus recorded permission evidence in `config/resources.ts`.
  The allowlist ships empty. Populate it only after verifying actual permission;
  author input and scraped license hints cannot grant permission.
- Respect restrictive page preview hints. Mozilla Readability extracts plain text
  only, capped at 200,000 characters. Recheck the configured permission when serving
  cached text, so removing a grant stops full-text display after config reload.

This is backend infrastructure, not a production abuse-control release. Ingestion
rate limits, operational monitoring, removal/reporting workflows, and production
capacity planning remain required Phase 7 work before public beta.

## Worker operation

Adonis's first-party `@adonisjs/queue` **0.6.2** is pinned because the package is
experimental. Its database adapter uses the existing SQLite database; no Redis
service is needed for this phase. Review release notes and rerun queue/migration
tests before upgrading. The docs recommend Redis for higher-throughput production.

After installing dependencies:

```sh
pnpm --filter @poc/api exec node ace migration:run
pnpm generate
pnpm dev:api
```

`pnpm dev:api` and `pnpm dev` start the API and one queue worker together through
Turborepo. If you instead start the API directly with `pnpm --filter @poc/api dev`,
start its worker separately with the same environment/database:

```sh
pnpm --filter @poc/api worker
```

`QUEUE_DRIVER=database` is the supported configuration. Production must supervise
the worker alongside the web server; starting only the HTTP server leaves work
pending. Run migrations before either process. Avoid starting an additional manual
worker when using the root development commands. Production process supervision
is configured separately.

Transient network errors, timeouts, 429s, and upstream 5xx responses get up to three
retries with exponential backoff. Permanent failures do not retry. The real worker's
exhaustion callback records a safe reason without exposing the source URL in logs.

Web boot registers a persistent one-minute recovery schedule. It scans up to 100
pending resources older than two minutes, dispatches missing work, and rotates the
scan order. The committed pending row survives an interrupted enqueue. Dispatch
uses a five-minute deduplication window per resource/generation; expired dedup keys
also allow recovery after a terminal stalled job. Repeated deliveries are safe:
completed/stale generations are ignored and writes require the current generation.
The schedule itself is executed by the worker, not an HTTP timer.

Three migrations add queue tables, processing fields, and private access grants.
The resource alteration lets SQLite/Knex own its table-rebuild transaction so
existing references survive upgrades and rollbacks. The populated migration
regression test covers Phase 2 and Phase 3 together.

## Verification

- `pnpm generate`
- `pnpm --filter @poc/api typecheck`
- `pnpm --filter @poc/api test` — 40 passing tests
- `pnpm lint`
- `pnpm exec oxfmt --check <changed source/docs files>`

Coverage includes private access, concurrent ingestion and real queue deduplication,
real worker execution and retry exhaustion, orphan recovery, stale-generation
protection, permission revocation, PDFs, preview restrictions, unsafe URLs/DNS,
redirect checks, response-size limits, and populated database migrations.
Live smoke requests through the protected client returned HTTP 200 from example.com
and YouTube oEmbed; automated tests do not depend on those external services.

## Scaffolding record

Ace help was inspected before using generators. Commands run from the repo root:

```sh
pnpm --filter @poc/api exec node ace list
pnpm --filter @poc/api exec node ace add @adonisjs/queue
pnpm --filter @poc/api exec node ace make:migration add_resource_processing --alter
pnpm --filter @poc/api exec node ace make:model ResourceAccess -m
pnpm --filter @poc/api exec node ace make:migration resource_accesses --create
pnpm --filter @poc/api exec node ace make:service ResourceUrl
pnpm --filter @poc/api exec node ace make:service SafeResourceHttp
pnpm --filter @poc/api exec node ace make:service ResourceProcessing
pnpm --filter @poc/api exec node ace make:service ResourceIngestion
pnpm --filter @poc/api exec node ace make:controller Resources --resource
pnpm --filter @poc/api exec node ace make:validator resource
pnpm --filter @poc/api exec node ace make:transformer Resource
pnpm --filter @poc/api exec node ace make:exception ResourceFetch
pnpm --filter @poc/api exec node ace make:job ProcessResource
pnpm --filter @poc/api exec node ace make:job RecoverResources
pnpm --filter @poc/api exec node ace make:test resources --suite=functional
pnpm --filter @poc/api exec node ace make:test resource_url --suite=unit
pnpm --filter @poc/api exec node ace make:test resource_http --suite=unit
```

The queue configure hook generated its config, scheduler, and queue migration. Its
initial `primary` connection was corrected to the existing `sqlite` connection;
failed migration generation was retried with Ace. ResourceAccess's model was already
created, so only its failed migration generation was retried. Resource settings and
this Markdown file were created directly because no matching config/documentation
generator exists. Generated schemas/contracts were regenerated, never hand-edited.

## References

- [Adonis queues](https://docs.adonisjs.com/guides/digging-deeper/queues)
- [YouTube oEmbed provider](https://github.com/iamcal/oembed/blob/master/providers/youtube.yml)
- [YouTube player parameters](https://developers.google.com/youtube/player_parameters)
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [Mozilla Readability](https://github.com/mozilla/readability)
