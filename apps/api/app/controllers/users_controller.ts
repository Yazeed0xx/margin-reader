import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  show({ params }: HttpContext) {
    return {
      id: String(params.id),
      displayName: `User ${String(params.id)}`,
      active: true as const,
    }
  }
}
