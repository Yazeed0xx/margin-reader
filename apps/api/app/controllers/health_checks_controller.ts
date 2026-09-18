import { inject } from '@adonisjs/core'

import BetaHealthService from '#services/beta_health_service'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class HealthChecksController {
  constructor(private health: BetaHealthService) {}
  async live({ response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    return { status: 'ok' }
  }
  async ready({ response }: HttpContext) {
    const health = await this.health.ready()
    response.header('Cache-Control', 'no-store')
    response.status(health.healthy ? 200 : 503)
    return health
  }
}
