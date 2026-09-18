import { BasePolicy } from '@adonisjs/bouncer'

import type User from '#models/user'

export default class WriterPolicy extends BasePolicy {
  follow(user: User, writer: User) {
    return user.id !== writer.id
  }
}
