import { inject } from '@adonisjs/core'

import Follow from '#models/follow'
import User from '#models/user'
import WriterPolicy from '#policies/writer_policy'
import FollowingService from '#services/following_service'
import FollowTransformer from '#transformers/follow_transformer'
import { followingIndexValidator, followParamsValidator } from '#validators/discovery'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class FollowsController {
  constructor(private following: FollowingService) {}

  async index({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { page = 1, perPage = 20 } = await request.validateUsing(followingIndexValidator)
    const follows = await Follow.query()
      .where('followerId', auth.getUserOrFail().id)
      .preload('writer')
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
    follows.baseUrl('/api/v1/account/following').queryString({ perPage })
    return serialize(FollowTransformer.paginate(follows.all(), follows.getMeta()))
  }
  async show({ auth, request, response }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(followParamsValidator)
    await User.findOrFail(params.id)
    const follow = await Follow.query()
      .where('followerId', auth.getUserOrFail().id)
      .where('writerId', params.id)
      .first()
    return { data: { writerId: params.id, following: !!follow } }
  }
  async store({ auth, bouncer, request, response }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(followParamsValidator)
    const writer = await User.findOrFail(params.id)
    await bouncer.with(WriterPolicy).authorize('follow', writer)
    await this.following.follow(auth.getUserOrFail().id, writer.id)
    return { data: { writerId: writer.id, following: true } }
  }
  async destroy({ auth, request, response }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(followParamsValidator)
    await Follow.query()
      .where('followerId', auth.getUserOrFail().id)
      .where('writerId', params.id)
      .delete()
    return response.noContent()
  }
}
