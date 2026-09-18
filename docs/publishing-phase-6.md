# Phase 6: mobile-first web reader and writing desk

The Vite web app now uses shadcn/ui's Base UI components, Tailwind v4, React Router,
and the generated Tuyau API client. “Margin / هامش” is a working product name.

## Delivered

- Public essay discovery, search, language filters, pagination, and writer profiles.
- Signup/login, profile/preferences, following, a followed-writer feed, bookmarks,
  and a private writing desk. Tokens use sessionStorage; account changes clear queries.
- English/Arabic interface switching and per-article language/direction. Content remains
  in its original language. All supported article block types render as escaped text.
- Continuous plain-text writing surface with stable paragraph IDs, contextual controls,
  Enter to split paragraphs, Backspace to merge paragraphs, inline source attachment, writer notes,
  permitted exact quotes, and YouTube citation timestamps. Drafts are private until
  published. Preview renders local edits and interactive inline sources. Valid drafts autosave after
  1.8 seconds of inactivity; manual save remains available. Edits made during a request
  remain dirty and save afterward. New-draft saves preserve focus and scroll.
- Publish/unpublish actions use the current lock version. Conflicts preserve local edits
  and offer a JSON download before reloading. Navigation/refresh warns about unsaved work.
- Citations expand beneath their paragraph in the article flow, without an overlay or
  scroll lock. Collapsing returns focus and the citation's original viewport position.
  Source previews load on expansion; permitted full text loads on a separate inline
  request. Long descriptions expand progressively. Requests use the published revision. Pending, limited, failed, and stale
  sources have visible fallback states. The original link opens a separate tab.
- YouTube loads only after an explicit reader action, using the official iframe SDK and
  youtube-nocookie host, with native controls, playsinline, origin, and autoplay disabled.
  Citation timestamps are supported. Closing destroys the player; its playback position
  is remembered in memory for that citation while the app stays open.
- Signed-in readers automatically save progress after scrolling, with a quiet resume
  action for a previous position. Source exploration pauses progress writes.
  Progress saves after scrolling settles, with serialized requests and optimistic locking.
  Conflicts stop saving until the reader reloads the progress state. Republished essays
  reanchor to the saved block when it still exists.
- Keyboard focus, labels, skip link, mobile layouts, and reduced-motion support.

## Run

```sh
pnpm dev:api # starts the API and queue worker together
pnpm dev:web
```

`VITE_API_URL` defaults to `http://localhost:3333`. Deploy the web server with SPA
fallback for deep links; configure the API's production CORS allowlist for the web origin.

The web TypeScript configuration matches the server's syntax/indexed-access settings
because generated client contracts reference server source types. Runtime web imports
remain the generated route registry and client, not server controllers.

## Verification

```sh
pnpm lint
pnpm --filter @poc/web typecheck
pnpm exec oxfmt --check apps/web docs/publishing-phase-6.md
PLAYWRIGHT_CHANNEL=chrome pnpm --filter @poc/web test:e2e
```

Seven browser tests cover: signup → draft → publish → bookmark → unpublish; unsaved
navigation protection; stale-save recovery; inline-source scroll/focus/video lifecycle;
mobile RTL/progress resume; private reporting; autosave races and paragraph keyboard
editing; and mobile inline attachment with interactive preview. The test runner uses one browser worker, separate
ports (3340/5180), and a unique temporary SQLite database per run. It refuses to reuse
existing servers. On CI, install Playwright Chromium and omit `PLAYWRIGHT_CHANNEL`.
The deterministic video test substitutes source data and the provider SDK. A separate
manual browser check used real YouTube URL ingestion/oEmbed and verified the generated
privacy-enhanced iframe URL, timestamp, and destruction on close. Playback availability
still depends on YouTube and the video owner's embed settings.

Desktop and 390px mobile layouts were visually inspected. No production deployment,
production export, native build, or full monorepo verification was performed.

## Scope and follow-up

Full source text remains subject to Phase 3's operator allowlist; the frontend does
not bypass it. PDF sources currently use metadata/original-link fallbacks. No automatic
translation or transcript scraping is added. Video resume is session-memory only;
reading progress is persisted by the API. The editor supports structured blocks rather
than inline rich-text formatting. Progress is debounced, so the final scroll can be
lost if the page closes immediately before the request is sent.

Phase 7 engineering is documented in `publishing-phase-7.md`. A beta with real readers,
including Safari/iOS and screen-reader testing, remains outstanding.

## Scaffolding

No Adonis application resources or migrations were added in this phase. UI scaffolding:

```sh
# From apps/web
pnpm dlx shadcn@latest init --base base --preset nova --rtl --no-monorepo
pnpm dlx shadcn@latest add button field input textarea sheet toggle-group alert empty skeleton badge separator select -y
```

Generated UI files were reviewed and formatted. Two narrow accessibility lint comments
explain shadcn's forwarding label and composite field wrappers. Application controls
supply their actual labels. No lint rule was disabled globally.
