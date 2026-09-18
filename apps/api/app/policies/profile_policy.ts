import { BasePolicy } from '@adonisjs/bouncer'

import type User from '#models/user'

export default class ProfilePolicy extends BasePolicy {
  update(user: User, profile: User) {
    return user.id === profile.id
  }
}
