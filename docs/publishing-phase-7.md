# Phase 7: beta safeguards and operations

The engineering baseline is implemented. Deployment, external monitoring/backup schedules,
and a beta with real readers have not been performed. This runbook assumes the current
SQLite deployment: one API service and one queue worker sharing a persistent local database.
Do not put SQLite on an ephemeral filesystem or share it across machines over a network mount.

## Reporting and moderation

Signed-in readers can report a published essay from its footer in English or Arabic.
`POST /api/v1/account/articles/:id/reports` accepts `reason` (`spam`, `harassment`,
`copyright`, `other`) and optional `details` (maximum 2,000 characters). The server binds
identity and the current published revision; client-supplied identity/status are ignored.
One report per reader/article is enforced in the database. Repeating it returns the
existing record, including after review. Reports have no public listing endpoint.

Moderation is available only to operators with server/CLI access. No user receives
moderator privileges through the web app. From the repository root:

```sh
pnpm --filter @poc/api exec node ace moderation:reports
pnpm --filter @poc/api exec node ace moderation:reports --id=123 --decision=removed --operator=reviewer-name --note='Reason communicated to the writer'
pnpm --filter @poc/api exec node ace moderation:reports --id=124 --decision=dismissed --operator=reviewer-name --note='No violation found'
```

The list returns the oldest 50 pending reports. Inspect the captured `revisionId`
through trusted database tooling before deciding; the current article may have changed.
Review is atomic and can happen only once. It records operator, decision, note, and time.
Removal clears the public revision and publication date, increments the edit version,
and blocks republishing. Existing public article/source/feed/bookmark queries therefore
stop returning the publication. The author retains their private draft, sees the reason,
and can export it. The reason is writer-visible: do not include reporter details in it.

Dismissal preserves publication. This first beta has no appeal/reinstatement UI or CLI;
handle appeals manually through the operator team before extending moderation workflows.
Do not repurpose dismissal to undo a completed removal. Reports are not an automatic
truth signal: review evidence before removing an article. No report or decision emails
are sent by this implementation.

## Rate limits

`@adonisjs/limiter` 3.x supplies atomic counters and standard 429/Retry-After responses.
`LIMITER_STORE=database` is the default outside Japa; instances sharing this SQLite
file share the counters. Japa uses the memory store with the same active middleware.

| Surface                        | Limit         | Key                |
| ------------------------------ | ------------- | ------------------ |
| All `/api/v1` requests         | 300/minute    | Client IP          |
| Signup/login combined          | 20/15 minutes | Client IP          |
| Account routes                 | 180/minute    | Authenticated user |
| Source ingest/refresh combined | 20/minute     | Authenticated user |
| Reports                        | 5/hour        | Authenticated user |

Limits stack. Invalid requests consume quota. Reading progress is debounced and source
polling remains below normal account quotas. The UI explains 429 responses without
silently retrying mutations. Do not select the memory store for multi-process production.

Expired rows are pruned explicitly, avoiding background timers during code generation.
Schedule this command hourly with the same application environment:

```sh
pnpm --filter @poc/api exec node ace limiter:prune
```

It deletes only rows expired for over an hour. Configure a trusted reverse proxy boundary
before launch: preserve real client IPs using Adonis's supported proxy configuration and
never trust arbitrary forwarded headers from direct internet clients. Confirm that two
real clients produce independent quotas. Add perimeter traffic controls at the host/CDN.

## Health and monitoring

- `GET /health/live`: process responsiveness, `{ "status": "ok" }`.
- `GET /health/ready`: native Adonis/Lucid DB and RSS checks; returns only `healthy` and
  `status`, with HTTP 503 on failure and `Cache-Control: no-store`. No database details,
  paths, stack traces, or process information are exposed. It does not prove schema
  currency, available disk space, or worker liveness.
- Existing framework structured logs, request IDs, exception reporting, and resource
  failure logs remain enabled. Use production log collection with access control.
- Starter `/api/test` and `/api/users/:id` diagnostics are unavailable in production.

Before inviting readers, configure an external readiness probe, process supervision for
API and worker, and alerts for repeated 5xx, sustained 429, disk usage, worker exits,
backup failures, and sources pending longer than 15 minutes. Check `queue_jobs` failures
and resource `failure_code` through private operator tooling. Do not log auth headers,
passwords, full report bodies, or fetched article text. No hosted monitoring account or
alert delivery channel has been configured by this phase.

## Backups and recovery

```sh
pnpm --filter @poc/api exec node ace database:backup /private/backups/margin-2026-09-19.sqlite3
```

The destination parent directory must exist. The command refuses existing destinations
and the live database path, uses SQLite's online backup API (including committed WAL
content), verifies integrity/foreign keys, and creates the file with mode 0600. On failure
it removes its incomplete output. It does not delete old backups or upload them.

Schedule daily backups and one immediately before migrations. Copy verified backups to
encrypted storage outside the host with restricted access; retain according to the beta's
agreed recovery objectives. Backups contain credentials/token records and private drafts.
The `APP_KEY` and deployment configuration must be backed up separately in secret storage.

Recovery procedure (operator-controlled; do not run over a live service):

1. Stop the API, worker, and scheduled jobs. Preserve the current DB and its WAL/SHM files
   together in a separate location for investigation.
2. Copy a verified backup into a new private directory, using a new database filename.
   Set `DB_DATABASE` to this path; do not reuse an old filename with stale WAL/SHM files.
3. Run `node ace migration:status` against the restored DB using the matching application
   release. Apply required forward migrations only after checking their compatibility.
4. Start the API against the restored path. Check readiness, a published article, a private
   draft, bookmarks, and report records. Start the worker and monitor replayed queue work.
5. Confirm checks pass before reopening traffic. Record the backup time and any lost work.

The automated restore rehearsal backs up a live WAL database, changes the original,
restores a separate copy, and verifies the committed data and integrity. This is a local
mechanical test; a deployment recovery drill and off-host recovery still need an operator.

## Reader beta plan

Invite a small Arabic/English cohort after operational setup. Use essays with ordinary
web sources, a YouTube timestamp, a restricted video, a metadata-only source, and a long
Arabic article. Ask readers to:

1. Open a citation midway through reading and return to the same place.
2. Watch/pause/close a video and reopen it; confirm there is no background audio.
3. Save an essay, leave, and resume reading after signing in again.
4. Follow a writer and find their work in the feed.
5. Report an issue and confirm the acknowledgement is understandable.

Ask writers to compose, attach a source, preview, publish, edit privately, and republish.
Test two tabs editing one draft and verify conflict recovery. Record completion, lost
position, accidental navigation, confusing fallbacks, keyboard/screen-reader issues,
and qualitative comments. Include physical iPhone/Safari, Android Chrome, and desktop
keyboard users; responsive Chrome tests alone do not cover these devices.

Launch gate: no lost drafts, no unauthorized private data, reliable citation return,
verified backup restoration, an assigned moderation operator, and alerts reaching an
assigned on-call person. These human/operational gates remain outstanding.

## Verification and scaffolding

API tests cover reporting identity/privacy/idempotency, removal and republish denial,
dismissal, 429/Retry-After, minimal health responses, and WAL backup restoration/refusal
to overwrite. A database-store test checks shared rate-limit counters. Existing migration
rollback/upgrade and code-generation lifecycle regression tests also pass. Browser coverage
includes submitting a real report through the UI, in addition to Phase 6's four flows.

```sh
pnpm generate
pnpm --filter @poc/api typecheck
pnpm --filter @poc/api test
pnpm --filter @poc/web typecheck
PLAYWRIGHT_CHANNEL=chrome pnpm --filter @poc/web test:e2e
pnpm lint
pnpm exec oxfmt --check <changed files>
```

Ace list and generator help were inspected first. Generators used (from repository root):

```sh
pnpm --filter @poc/api exec node ace add @adonisjs/limiter --package-manager=pnpm
pnpm --filter @poc/api exec node ace make:model ArticleReport -m
pnpm --filter @poc/api exec node ace make:migration add_article_moderation --alter
pnpm --filter @poc/api exec node ace make:controller ArticleReports --resource
pnpm --filter @poc/api exec node ace make:validator report
pnpm --filter @poc/api exec node ace make:transformer ArticleReport
pnpm --filter @poc/api exec node ace make:service Moderation
pnpm --filter @poc/api exec node ace make:command ReviewReports
pnpm --filter @poc/api exec node ace make:command BackupDatabase
pnpm --filter @poc/api exec node ace make:controller HealthChecks live ready
pnpm --filter @poc/api exec node ace make:service BetaHealth
pnpm --filter @poc/api exec node ace make:service DatabaseBackup
pnpm --filter @poc/api exec node ace make:exception ArticleRemoved
pnpm --filter @poc/api exec node ace make:command PruneRateLimits
pnpm --filter @poc/api exec node ace make:test beta --suite=functional
pnpm --filter @poc/api exec node ace migration:run
pnpm generate
```

Limiter's configure hook generated its config, preload, provider registration, migration,
and environment entry. Schema classes/contracts were regenerated rather than hand-edited.
The backup service uses the installed SQLite driver's native backup API because Lucid has
no online SQLite snapshot API. Commands dynamically import application services after app
boot; HTTP/application services retain static imports. Markdown and React files have no
Ace generator and were created directly.
