import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'

import ResourceIngestionService from '#services/resource_ingestion_service'

@inject()
export default class RecoverResources extends Job<Record<string, never>> {
  static options = { removeOnComplete: true, removeOnFail: true }
  constructor(private ingestion: ResourceIngestionService) {
    super()
  }
  async execute() {
    await this.ingestion.recover()
  }
}
