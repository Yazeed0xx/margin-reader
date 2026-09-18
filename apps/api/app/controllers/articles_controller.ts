import { inject } from '@adonisjs/core'

import Article from '#models/article'
import ArticleDiscoveryService from '#services/article_discovery_service'
import ArticleTransformer from '#transformers/article_transformer'
import { articleParamsValidator, publicArticleIndexValidator } from '#validators/article'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class ArticlesController {
  constructor(private discovery: ArticleDiscoveryService) {}
  async index({ request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    const filters = await request.validateUsing(publicArticleIndexValidator)
    const articles = await this.discovery.list(filters)
    return serialize(
      ArticleTransformer.paginate(articles.all(), articles.getMeta()).useVariant('toSummary'),
    )
  }

  async show({ request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    const { params } = await request.validateUsing(articleParamsValidator)
    const article = await Article.query()
      .where('id', params.id)
      .whereNotNull('publishedRevisionId')
      .preload('publishedRevision', (revision) => revision.preload('references'))
      .preload('author')
      .firstOrFail()
    return serialize(ArticleTransformer.transform(article))
  }
}
