import User from '#models/user'
import WriterTransformer from '#transformers/writer_transformer'
import { writerParamsValidator } from '#validators/profile'

import type { HttpContext } from '@adonisjs/core/http'

export default class WritersController {
  async show({ request, serialize }: HttpContext) {
    const { params } = await request.validateUsing(writerParamsValidator)
    const writer = await User.findOrFail(params.id)
    return serialize(WriterTransformer.transform(writer))
  }
}
