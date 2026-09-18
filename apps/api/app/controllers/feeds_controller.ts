import { inject } from '@adonisjs/core'

import ArticleDiscoveryService from '#services/article_discovery_service'
import ArticleTransformer from '#transformers/article_transformer'
import { publicArticleIndexValidator } from '#validators/article'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class FeedsController {
  constructor(private discovery: ArticleDiscoveryService) {}

  async index({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const filters = await request.validateUsing(publicArticleIndexValidator)
    const reader = auth.getUserOrFail()
    const language = filters.language ?? reader.readingLanguage
    const articles = await this.discovery.list({ ...filters, language }, reader.id)
    return serialize(
      ArticleTransformer.paginate(articles.all(), articles.getMeta()).useVariant('toSummary'),
    )
  }
}
