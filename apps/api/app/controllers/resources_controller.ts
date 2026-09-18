import { inject } from '@adonisjs/core'

import Resource from '#models/resource'
import ResourceIngestionService from '#services/resource_ingestion_service'
import ResourceTransformer from '#transformers/resource_transformer'
import { ingestResourceValidator, resourceParamsValidator } from '#validators/resource'

import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class ResourcesController {
  constructor(private ingestion: ResourceIngestionService) {}

  async store({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { url } = await request.validateUsing(ingestResourceValidator)
    const { resource, suggestedStartSeconds } = await this.ingestion.ingest(
      auth.getUserOrFail().id,
      url,
    )
    response.status(resource.processingStatus === 'pending' ? 202 : 200)
    return { ...(await serialize(ResourceTransformer.transform(resource))), suggestedStartSeconds }
  }

  async show({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(resourceParamsValidator)
    const resource = await Resource.query()
      .where('id', params.id)
      .whereHas('accesses', (query) => query.where('userId', auth.getUserOrFail().id))
      .firstOrFail()
    return serialize(ResourceTransformer.transform(resource))
  }

  async refresh({ auth, request, response, serialize }: HttpContext) {
    response.header('Cache-Control', 'private, no-store')
    const { params } = await request.validateUsing(resourceParamsValidator)
    const resource = await Resource.query()
      .where('id', params.id)
      .whereHas('accesses', (query) => query.where('userId', auth.getUserOrFail().id))
      .firstOrFail()
    await this.ingestion.refresh(resource)
    response.status(resource.processingStatus === 'pending' ? 202 : 200)
    return serialize(ResourceTransformer.transform(resource))
  }
}
