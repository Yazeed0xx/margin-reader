import { inject } from '@adonisjs/core'

import Article from '#models/article'
import ReadingProgress from '#models/reading_progress'
import ReadingStateService from '#services/reading_state_service'
import ReadingProgressTransformer from '#transformers/reading_progress_transformer'
import {
  clearProgressValidator,
  readingParamsValidator,
  saveProgressValidator,
} from '#validators/reading'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class ReadingProgressesController {
  constructor(private reading: ReadingStateService) {}

  async show({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(readingParamsValidator)
    const article = await Article.query()
      .where('id', params.id)
      .whereNotNull('publishedRevisionId')
      .firstOrFail()
    const progress = await ReadingProgress.query()
      .where('userId', auth.getUserOrFail().id)
      .where('articleId', params.id)
      .first()
    return {
      ...(progress
        ? await serialize(ReadingProgressTransformer.transform(progress))
        : { data: null }),
      currentRevisionId: article.publishedRevisionId,
      needsReanchor: !!progress?.revisionId && progress.revisionId !== article.publishedRevisionId,
    }
  }

  async update({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params, ...input } = await request.validateUsing(saveProgressValidator)
    await Article.query().where('id', params.id).whereNotNull('publishedRevisionId').firstOrFail()
    const progress = await this.reading.saveProgress(auth.getUserOrFail().id, params.id, input)
    return serialize(ReadingProgressTransformer.transform(progress))
  }

  async destroy({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params, expectedVersion } = await request.validateUsing(clearProgressValidator)
    await Article.findOrFail(params.id)
    const progress = await this.reading.saveProgress(auth.getUserOrFail().id, params.id, {
      expectedVersion,
    })
    return serialize(ReadingProgressTransformer.transform(progress))
  }
}
