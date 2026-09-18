import { Exception } from '@adonisjs/core/exceptions'

import type { HttpContext } from '@adonisjs/core/http'

export default class InvalidReferenceException extends Exception {
  static status = 422
  static code = 'E_INVALID_REFERENCE'
  static message =
    'A reference has an invalid block, inaccessible source, quote, or video timestamp.'
  async handle(_error: this, { response }: HttpContext) {
    return response
      .status(this.status)
      .send({ errors: [{ code: this.code, message: this.message }] })
  }
}
