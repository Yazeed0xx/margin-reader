import { BaseTransformer } from '@adonisjs/core/transformers'

import WriterTransformer from '#transformers/writer_transformer'

import type Follow from '#models/follow'

export default class FollowTransformer extends BaseTransformer<Follow> {
  toObject() {
    return {
      followedAt: this.resource.createdAt,
      writer: WriterTransformer.transform(this.resource.writer),
    }
  }
}
