import { BaseTransformer } from '@adonisjs/core/transformers'

import type ReadingProgress from '#models/reading_progress'

export default class ReadingProgressTransformer extends BaseTransformer<ReadingProgress> {
  toObject() {
    return this.pick(this.resource, [
      'articleId',
      'revisionId',
      'blockId',
      'blockProgress',
      'lockVersion',
      'updatedAt',
    ])
  }
}
