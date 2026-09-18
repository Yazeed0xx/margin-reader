import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import ArticleConflictException from '#exceptions/article_conflict_exception'
import ArticleRemovedException from '#exceptions/article_removed_exception'
import Article from '#models/article'
import ArticleDiscoveryService from '#services/article_discovery_service'
import ArticleReferenceService from '#services/article_reference_service'
import { publishableArticleValidator } from '#validators/article'

import type { ArticleInput } from '#validators/article'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

@inject()
export default class ArticlePublishingService {
  constructor(
    private references: ArticleReferenceService,
    private discovery: ArticleDiscoveryService,
  ) {}
  async create(authorId: number, input: ArticleInput) {
    return db.transaction(async (trx) => {
      const article = await Article.create({ authorId, lockVersion: 0 }, { client: trx })
      const revision = await article.related('revisions').create({
        revisionNumber: 1,
        title: input.title,
        language: input.language,
        contentJson: JSON.stringify(input.content),
        searchText: this.discovery.searchText(input),
      })
      await this.references.validate(authorId, input.content, input.references ?? [], trx)
      if (input.references?.length) {
        await revision.related('references').createMany(input.references)
      }
      article.draftRevisionId = revision.id
      await article.save()
      await article.refresh()
      await article.load('draftRevision', (revision) => revision.preload('references'))
      return article
    })
  }

  async update(articleId: number, authorId: number, expectedVersion: number, input: ArticleInput) {
    return db.transaction(async (trx) => {
      const article = await this.claim(articleId, authorId, expectedVersion, trx)
      const previous = await article.related('draftRevision').query().preload('references').first()
      const revision = await article.related('revisions').create({
        revisionNumber: (previous?.revisionNumber ?? 0) + 1,
        title: input.title,
        language: input.language,
        contentJson: JSON.stringify(input.content),
        searchText: this.discovery.searchText(input),
      })
      // Explicit references replace the set; omission retains references on surviving blocks.
      const blockIds = new Set(input.content.blocks.map((block) => block.id))
      const references =
        input.references ??
        previous?.references
          .filter((reference) => blockIds.has(reference.blockId))
          .map((reference) => ({
            resourceId: reference.resourceId,
            blockId: reference.blockId,
            referenceKey: reference.referenceKey,
            commentary: reference.commentary,
            selectedQuote: reference.selectedQuote,
            videoStartSeconds: reference.videoStartSeconds,
          })) ??
        []
      await this.references.validate(
        authorId,
        input.content,
        references,
        trx,
        input.references !== undefined,
      )
      if (references.length) {
        await revision.related('references').createMany(references)
      }
      article.draftRevisionId = revision.id
      await article.save()
      await article.refresh()
      await article.load('draftRevision', (revision) => revision.preload('references'))
      return article
    })
  }

  async publish(articleId: number, authorId: number, expectedVersion: number) {
    return db.transaction(async (trx) => {
      const article = await this.claim(articleId, authorId, expectedVersion, trx)
      if (article.removedAt) {
        throw new ArticleRemovedException()
      }
      const revision = await article
        .related('draftRevision')
        .query()
        .preload('references')
        .firstOrFail()
      // Validate again at the transition, including legacy/imported documents.
      await publishableArticleValidator.validate({
        title: revision.title,
        language: revision.language,
        content: revision.content,
        references: revision.references.map((reference) => ({
          referenceKey: reference.referenceKey,
          blockId: reference.blockId,
          resourceId: reference.resourceId,
          commentary: reference.commentary,
          selectedQuote: reference.selectedQuote,
          videoStartSeconds: reference.videoStartSeconds,
        })),
      })
      await this.references.validate(authorId, revision.content, revision.references, trx, false)
      article.publishedRevisionId = revision.id
      article.publishedAt ??= DateTime.utc()
      await article.save()
      await article.refresh()
      await article.load('draftRevision', (revision) => revision.preload('references'))
      return article
    })
  }

  async unpublish(articleId: number, authorId: number, expectedVersion: number) {
    return db.transaction(async (trx) => {
      const article = await this.claim(articleId, authorId, expectedVersion, trx)
      article.publishedRevisionId = null
      article.publishedAt = null
      await article.save()
      await article.refresh()
      await article.load('draftRevision', (revision) => revision.preload('references'))
      return article
    })
  }

  private async claim(
    articleId: number,
    authorId: number,
    expectedVersion: number,
    trx: TransactionClientContract,
  ) {
    // First statement takes the SQLite write lock; the conditional update also
    // protects against stale requests on databases with concurrent writers.
    const changed = await Article.query({ client: trx })
      .where('id', articleId)
      .where('authorId', authorId)
      .where('lockVersion', expectedVersion)
      .update({ lockVersion: expectedVersion + 1 })
    if (Number(changed) !== 1) {
      throw new ArticleConflictException()
    }
    return Article.query({ client: trx }).where('id', articleId).firstOrFail()
  }
}
