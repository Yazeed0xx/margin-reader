import ArticleReference from '#models/article_reference'
import ArticleReferenceTransformer from '#transformers/article_reference_transformer'
import ResourceTransformer from '#transformers/resource_transformer'
import { sourceParamsValidator } from '#validators/reading'

import type { HttpContext } from '@adonisjs/core/http'

export default class ArticleSourcesController {
  async show({ request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    const { params, revisionId } = await request.validateUsing(sourceParamsValidator)
    const reference = await ArticleReference.query()
      .withScopes((scopes) => scopes.publishedFor(params.id, revisionId))
      .where('referenceKey', params.referenceKey)
      .preload('resource')
      .firstOrFail()
    return serialize({
      reference: ArticleReferenceTransformer.transform(reference),
      resource: ResourceTransformer.transform(reference.resource).useVariant('toPreview'),
    })
  }

  async content({ request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    const { params, revisionId } = await request.validateUsing(sourceParamsValidator)
    const reference = await ArticleReference.query()
      .withScopes((scopes) => scopes.publishedFor(params.id, revisionId))
      .where('referenceKey', params.referenceKey)
      .preload('resource')
      .firstOrFail()
    return serialize(ResourceTransformer.transform(reference.resource).useVariant('toContent'))
  }
}
