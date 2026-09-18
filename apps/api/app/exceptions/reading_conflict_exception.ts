import { Exception } from '@adonisjs/core/exceptions'

import type { HttpContext } from '@adonisjs/core/http'

export default class ReadingConflictException extends Exception {
  static status = 409
  static code = 'E_READING_CONFLICT'
  static message = 'The article or reading position has changed. Reload before saving progress.'
  async handle(_error: this, { response }: HttpContext) {
    return response
      .status(this.status)
      .send({ errors: [{ code: this.code, message: this.message }] })
  }
}
