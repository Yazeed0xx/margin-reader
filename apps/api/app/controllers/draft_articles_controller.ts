import { inject } from '@adonisjs/core'

import Article from '#models/article'
import ArticlePolicy from '#policies/article_policy'
import ArticlePublishingService from '#services/article_publishing_service'
import DraftArticleTransformer from '#transformers/draft_article_transformer'
import {
  articleParamsValidator,
  createArticleValidator,
  draftArticleIndexValidator,
  publicationValidator,
  updateArticleValidator,
} from '#validators/article'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class DraftArticlesController {
  constructor(private publishing: ArticlePublishingService) {}

  async index({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { page = 1, perPage = 20 } = await request.validateUsing(draftArticleIndexValidator)
    const articles = await Article.query()
      .where('authorId', auth.getUserOrFail().id)
      .preload('draftRevision', (revision) =>
        revision.select(['id', 'revisionNumber', 'title', 'language']),
      )
      .orderBy('updatedAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
    articles.baseUrl('/api/v1/account/articles').queryString({ perPage })
    return serialize(
      DraftArticleTransformer.paginate(articles.all(), articles.getMeta()).useVariant('toSummary'),
    )
  }

  async store({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const payload = await request.validateUsing(createArticleValidator)
    const article = await this.publishing.create(auth.getUserOrFail().id, payload)
    response.status(201)
    return serialize(DraftArticleTransformer.transform(article))
  }

  async show({ bouncer, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(articleParamsValidator)
    const article = await Article.findOrFail(params.id)
    await bouncer.with(ArticlePolicy).authorize('viewDraft', article)
    await article.load('draftRevision', (revision) => revision.preload('references'))
    return serialize(DraftArticleTransformer.transform(article))
  }

  async update({ auth, bouncer, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params, expectedVersion, ...payload } =
      await request.validateUsing(updateArticleValidator)
    const article = await Article.findOrFail(params.id)
    await bouncer.with(ArticlePolicy).authorize('update', article)
    const updated = await this.publishing.update(
      article.id,
      auth.getUserOrFail().id,
      expectedVersion,
      payload,
    )
    return serialize(DraftArticleTransformer.transform(updated))
  }

  async publish({ auth, bouncer, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params, expectedVersion } = await request.validateUsing(publicationValidator)
    const article = await Article.findOrFail(params.id)
    await bouncer.with(ArticlePolicy).authorize('publish', article)
    const published = await this.publishing.publish(
      article.id,
      auth.getUserOrFail().id,
      expectedVersion,
    )
    return serialize(DraftArticleTransformer.transform(published))
  }

  async unpublish({ auth, bouncer, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params, expectedVersion } = await request.validateUsing(publicationValidator)
    const article = await Article.findOrFail(params.id)
    await bouncer.with(ArticlePolicy).authorize('unpublish', article)
    const unpublished = await this.publishing.unpublish(
      article.id,
      auth.getUserOrFail().id,
      expectedVersion,
    )
    return serialize(DraftArticleTransformer.transform(unpublished))
  }
}
