import ProfilePolicy from '#policies/profile_policy'
import UserTransformer from '#transformers/user_transformer'
import { updateProfileValidator } from '#validators/profile'

import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  async show({ auth, serialize }: HttpContext) {
    return serialize(UserTransformer.transform(auth.getUserOrFail()))
  }

  async update({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    await bouncer.with(ProfilePolicy).authorize('update', user)
    const payload = await request.validateUsing(updateProfileValidator)
    await user.merge(payload).save()
    return serialize(UserTransformer.transform(user))
  }
}
