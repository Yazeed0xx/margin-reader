import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineConfig } from '@playwright/test'

// Every run uses a separate database. Never reuse the developer's server or data.
const database = join(tmpdir(), `margin-browser-${process.pid}.sqlite3`)
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5180',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'pnpm --filter @poc/api exec node ace migration:run --no-schema-generate && pnpm --filter @poc/api exec node ace serve',
      cwd: '../..',
      url: 'http://localhost:3340/api/v1/articles',
      env: { DB_DATABASE: database, PORT: '3340' },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'pnpm dev --port 5180 --strictPort',
      url: 'http://localhost:5180',
      env: { VITE_API_URL: 'http://localhost:3340' },
      reuseExistingServer: false,
    },
  ],
})
