import { testIndexValidator, testStoreValidator } from '#validators/test'

import type { HttpContext } from '@adonisjs/core/http'

export default class TestController {
  async index({ request }: HttpContext) {
    const query = await request.validateUsing(testIndexValidator)

    return {
      ok: true as const,
      message: 'AdonisJS v7 API is reachable',
      query,
      authorization: request.header('authorization') ?? null,
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(testStoreValidator)

    return response.created({
      created: true as const,
      person: payload,
    })
  }
}
