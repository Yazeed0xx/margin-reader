import { BaseTransformer } from '@adonisjs/core/transformers'

import type User from '#models/user'

/** Public profile: never expose account email or reading preferences. */
export default class WriterTransformer extends BaseTransformer<User> {
  toObject() {
    return this.pick(this.resource, ['id', 'fullName', 'bio'])
  }
}
