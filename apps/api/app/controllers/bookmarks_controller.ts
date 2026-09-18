import { inject } from '@adonisjs/core'

import Article from '#models/article'
import Bookmark from '#models/bookmark'
import ReadingStateService from '#services/reading_state_service'
import BookmarkTransformer from '#transformers/bookmark_transformer'
import { bookmarkIndexValidator, readingParamsValidator } from '#validators/reading'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class BookmarksController {
  constructor(private reading: ReadingStateService) {}

  async index({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { page = 1, perPage = 20 } = await request.validateUsing(bookmarkIndexValidator)
    const bookmarks = await Bookmark.query()
      .where('userId', auth.getUserOrFail().id)
      .whereHas('article', (article) => article.whereNotNull('publishedRevisionId'))
      .preload('article', (article) =>
        article
          .preload('publishedRevision', (revision) => revision.select(['id', 'title', 'language']))
          .preload('author'),
      )
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
    bookmarks.baseUrl('/api/v1/account/bookmarks').queryString({ perPage })
    return serialize(BookmarkTransformer.paginate(bookmarks.all(), bookmarks.getMeta()))
  }

  async show({ auth, request, response }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(readingParamsValidator)
    await Article.query().where('id', params.id).whereNotNull('publishedRevisionId').firstOrFail()
    const bookmark = await Bookmark.query()
      .where('userId', auth.getUserOrFail().id)
      .where('articleId', params.id)
      .first()
    return { data: { articleId: params.id, bookmarked: !!bookmark } }
  }

  async store({ auth, request, response }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(readingParamsValidator)
    await Article.query().where('id', params.id).whereNotNull('publishedRevisionId').firstOrFail()
    await this.reading.bookmark(auth.getUserOrFail().id, params.id)
    return { data: { articleId: params.id, bookmarked: true } }
  }

  async destroy({ auth, request, response }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(readingParamsValidator)
    await Bookmark.query()
      .where('userId', auth.getUserOrFail().id)
      .where('articleId', params.id)
      .delete()
    return response.noContent()
  }
}
