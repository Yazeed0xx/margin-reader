import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/limiter'

import env from '#start/env'

const limiterConfig = defineConfig({
  default: app.inTest ? 'memory' : env.get('LIMITER_STORE', 'database'),
  stores: {
    database: stores.database({ tableName: 'rate_limits', clearExpiredByTimeout: false }),
    memory: stores.memory({}),
  },
})
export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
