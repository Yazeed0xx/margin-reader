import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import ProcessResource from '#jobs/process_resource'
import Resource from '#models/resource'
import ResourceUrlService from '#services/resource_url_service'

@inject()
export default class ResourceIngestionService {
  constructor(private urls: ResourceUrlService) {}

  async ingest(userId: number, input: string) {
    const normalized = this.urls.normalize(input)
    const resource = await db.transaction(async (trx) => {
      const now = DateTime.utc().toSQL()
      await trx
        .table('resources')
        .insert({
          url: normalized.url,
          kind: normalized.videoId ? 'video' : 'unknown',
          provider: normalized.videoId ? 'youtube' : null,
          provider_id: normalized.videoId,
          created_at: now,
          updated_at: now,
        })
        .onConflict('url')
        .ignore()
      const record = await Resource.query({ client: trx })
        .where('url', normalized.url)
        .firstOrFail()
      await trx
        .table('resource_accesses')
        .insert({ user_id: userId, resource_id: record.id, created_at: now })
        .onConflict(['user_id', 'resource_id'])
        .ignore()
      return record
    })
    await this.refresh(resource)
    return { resource, suggestedStartSeconds: normalized.suggestedStartSeconds }
  }

  async refresh(resource: Resource) {
    if (
      resource.processingStatus !== 'pending' &&
      (!resource.expiresAt || resource.expiresAt.toMillis() <= Date.now())
    ) {
      await Resource.query()
        .where('id', resource.id)
        .where('processingGeneration', resource.processingGeneration)
        .whereNot('processingStatus', 'pending')
        .update({
          processingStatus: 'pending',
          processingGeneration: resource.processingGeneration + 1,
          displayPolicy: 'metadata',
          contentText: null,
          rightsEvidence: null,
          failureCode: null,
          updatedAt: DateTime.utc().toSQL(),
        })
      await resource.refresh()
    }
    if (resource.processingStatus === 'pending') {
      try {
        await this.dispatch(resource)
      } catch {
        // The committed pending row is a durable recovery marker if enqueueing is interrupted.
        logger.warn({ resourceId: resource.id }, 'Resource enqueue deferred to recovery job')
      }
    }
  }

  async dispatch(resource: Resource) {
    await ProcessResource.dispatch({
      resourceId: resource.id,
      generation: resource.processingGeneration,
    }).dedup({ id: `${resource.id}:${resource.processingGeneration}`, ttl: '5m' })
  }

  async recover() {
    const resources = await Resource.query()
      .where('processingStatus', 'pending')
      .where((query) =>
        query
          .whereNull('updatedAt')
          .orWhere('updatedAt', '<', DateTime.utc().minus({ minutes: 2 }).toSQL()!),
      )
      .orderBy('updatedAt', 'asc')
      .limit(100)
    for (const resource of resources) {
      await this.dispatch(resource)
      await Resource.query()
        .where('id', resource.id)
        .where('processingGeneration', resource.processingGeneration)
        .where('processingStatus', 'pending')
        .update({ updatedAt: DateTime.utc().toSQL() })
    }
  }
}
