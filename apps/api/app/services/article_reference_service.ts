import InvalidReferenceException from '#exceptions/invalid_reference_exception'
import Resource from '#models/resource'

import type { ArticleContent, ReferenceInput } from '#validators/article'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class ArticleReferenceService {
  async validate(
    authorId: number,
    content: ArticleContent,
    references: ReferenceInput[],
    trx: TransactionClientContract,
    checkAccessAndQuotes = true,
  ) {
    const blockIds = new Set(content.blocks.map((block) => block.id))
    if (
      references.length > 100 ||
      new Set(references.map((reference) => reference.referenceKey)).size !== references.length
    ) {
      throw new InvalidReferenceException()
    }
    if (!references.length) {
      return
    }
    const query = Resource.query({ client: trx }).whereIn(
      'id',
      references.map((reference) => reference.resourceId),
    )
    if (checkAccessAndQuotes) {
      query.whereHas('accesses', (accesses) => accesses.where('userId', authorId))
    }
    const resources = new Map((await query).map((resource) => [resource.id, resource]))
    for (const reference of references) {
      const resource = resources.get(reference.resourceId)
      if (!blockIds.has(reference.blockId) || !resource) {
        throw new InvalidReferenceException()
      }
      if (
        reference.videoStartSeconds != null &&
        (resource.provider !== 'youtube' ||
          resource.kind !== 'video' ||
          !Number.isInteger(reference.videoStartSeconds) ||
          reference.videoStartSeconds < 0 ||
          reference.videoStartSeconds > 604800)
      ) {
        throw new InvalidReferenceException()
      }
      if (
        checkAccessAndQuotes &&
        reference.selectedQuote &&
        !resource.permittedContentText?.includes(reference.selectedQuote)
      ) {
        throw new InvalidReferenceException()
      }
    }
  }
}
