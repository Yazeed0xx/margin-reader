import { defineConfig, drivers } from '@adonisjs/queue'

import env from '#start/env'

export default defineConfig({
  default: env.get('QUEUE_DRIVER', 'database'),

  adapters: {
    database: drivers.database({
      connectionName: 'sqlite',
    }),
  },

  worker: {
    concurrency: 1,
    idleDelay: '2s',
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
