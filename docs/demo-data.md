# Development demo articles

Run against the local development database:

```sh
pnpm --filter @poc/api exec node ace db:seed --files database/seeders/demo_article_seeder.ts
```

The seeder is scoped to development/test. It adds eight published articles, two private
drafts, three demo writers, real external references, and sample bookmarks/follows for
Maya. Existing records and edits are preserved. Historical revision block IDs identify
the seeded articles, so rerunning does not duplicate articles after title edits.

All three demo accounts initially use password `MarginDemo123!`:

| Email           | Writer       | Content                                                             |
| --------------- | ------------ | ------------------------------------------------------------------- |
| maya@demo.test  | Maya Bennett | Essays, two video citations, long-form reading, private draft       |
| omar@demo.test  | Omar Haddad  | Research notebook and technical guide with code                     |
| noura@demo.test | نورة السالم  | Arabic essay, mixed-direction code article, checklist, Arabic draft |

New accounts use that password; rerunning never resets an existing account's password.
The writing is original demonstration content. External sources are ingested through
the normal service and queue, not represented as fabricated fetched content. Run
`pnpm dev:api` to process pending references. Full-text permissions remain unchanged:
research/documentation references can be metadata previews, and YouTube uses opt-in
embedding. The provider controls playback availability.

The published examples cover paragraphs, heading levels, quotes, unordered and ordered
lists, code, short and long writing, multiple references, video timestamps, Arabic,
and explicit left-to-right blocks within Arabic articles.

Scaffolded with the installed generator:

```sh
pnpm --filter @poc/api exec node ace make:seeder DemoArticles
```

Verified locally: first run created ten articles; second run created zero. Demo login,
public source previews, and ready YouTube embed state were checked through the API.
