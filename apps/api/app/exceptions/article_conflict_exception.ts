import { Exception } from '@adonisjs/core/exceptions'

import type { HttpContext } from '@adonisjs/core/http'

export default class ArticleConflictException extends Exception {
  static status = 409
  static code = 'E_ARTICLE_CONFLICT'
  static message = 'This article has changed. Reload it before saving or publishing.'

  async handle(_error: this, { response }: HttpContext) {
    return response.status(409).send({ errors: [{ code: this.code, message: this.message }] })
  }
}
