import { Exception } from '@adonisjs/core/exceptions'

export default class ResourceFetchException extends Exception {
  static status = 422
  static code = 'E_RESOURCE_FETCH'

  constructor(
    public reason: string,
    public retryable = false,
  ) {
    super('This source could not be fetched safely.', { status: 422, code: 'E_RESOURCE_FETCH' })
  }
}
