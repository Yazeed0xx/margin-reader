import { BaseTransformer } from '@adonisjs/core/transformers'

import DraftRevisionTransformer from '#transformers/draft_revision_transformer'

import type Article from '#models/article'

export default class DraftArticleTransformer extends BaseTransformer<Article> {
  toSummary() {
    const revision = this.resource.draftRevision
    return {
      ...this.pick(this.resource, ['id', 'createdAt', 'updatedAt', 'publishedAt', 'lockVersion']),
      publishedRevisionId: this.resource.publishedRevisionId,
      removedAt: this.resource.removedAt,
      removalReason: this.resource.removalReason,
      hasUnpublishedChanges: this.resource.draftRevisionId !== this.resource.publishedRevisionId,
      draft: revision
        ? {
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            title: revision.title,
            language: revision.language,
            direction: revision.language === 'ar' ? ('rtl' as const) : ('ltr' as const),
          }
        : null,
    }
  }

  toObject() {
    const summary = this.toSummary()
    return {
      ...summary,
      draft: this.resource.draftRevision
        ? DraftRevisionTransformer.transform(this.resource.draftRevision).depth(2)
        : null,
    }
  }
}
