import { inject } from '@adonisjs/core'
import { Job, exponentialBackoff } from '@adonisjs/queue'

import ResourceFetchException from '#exceptions/resource_fetch_exception'
import ResourceProcessingService from '#services/resource_processing_service'

import type { JobOptions } from '@adonisjs/queue/types'

@inject()
export default class ProcessResource extends Job<{ resourceId: number; generation: number }> {
  static options: JobOptions = {
    maxRetries: 3,
    removeOnComplete: true,
    removeOnFail: true,
    retry: { backoff: exponentialBackoff({ baseDelay: '10s', maxDelay: '2m' }) },
  }
  constructor(private processing: ResourceProcessingService) {
    super()
  }

  async execute() {
    await this.processing.process(this.payload.resourceId, this.payload.generation)
  }

  async failed(error: Error) {
    const failure = error instanceof ResourceFetchException ? error : error.cause
    await this.processing.fail(
      this.payload.resourceId,
      this.payload.generation,
      failure instanceof ResourceFetchException ? failure.reason : 'fetch_failed',
    )
  }
}
