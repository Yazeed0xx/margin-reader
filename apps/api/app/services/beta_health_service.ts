import { HealthChecks, MemoryRSSCheck } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'

export default class BetaHealthService {
  async ready() {
    // Construct on demand: code generation must not open a database connection.
    const report = await new HealthChecks()
      .register([
        new DbCheck(db.connection()),
        new MemoryRSSCheck().warnWhenExceeds('600 mb').failWhenExceeds('900 mb'),
      ])
      .run()
    return { healthy: report.isHealthy, status: report.status }
  }
}
