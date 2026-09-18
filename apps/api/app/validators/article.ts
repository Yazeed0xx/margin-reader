import vine from '@vinejs/vine'

import type { Infer } from '@vinejs/vine/types'

const blockFields = () => ({
  id: vine.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  direction: vine.enum(['ltr', 'rtl', 'auto']).optional(),
})

const isBlock = (value: unknown, type: string) =>
  typeof value === 'object' && value !== null && 'type' in value && value.type === type

const block = vine.union([
  vine.union.if(
    (value) => isBlock(value, 'paragraph'),
    vine.object({
      ...blockFields(),
      type: vine.literal('paragraph'),
      text: vine.string().trim().minLength(1).maxLength(20000),
    }),
  ),
  vine.union.if(
    (value) => isBlock(value, 'heading'),
    vine.object({
      ...blockFields(),
      type: vine.literal('heading'),
      level: vine.enum([2, 3, 4]),
      text: vine.string().trim().minLength(1).maxLength(500),
    }),
  ),
  vine.union.if(
    (value) => isBlock(value, 'quote'),
    vine.object({
      ...blockFields(),
      type: vine.literal('quote'),
      text: vine.string().trim().minLength(1).maxLength(20000),
    }),
  ),
  vine.union.if(
    (value) => isBlock(value, 'code'),
    vine.object({
      ...blockFields(),
      type: vine.literal('code'),
      text: vine.string().minLength(1).maxLength(20000),
    }),
  ),
  vine.union.if(
    (value) => isBlock(value, 'bulletList'),
    vine.object({
      ...blockFields(),
      type: vine.literal('bulletList'),
      items: vine
        .array(vine.string().trim().minLength(1).maxLength(2000))
        .minLength(1)
        .maxLength(100),
    }),
  ),
  vine.union.if(
    (value) => isBlock(value, 'orderedList'),
    vine.object({
      ...blockFields(),
      type: vine.literal('orderedList'),
      items: vine
        .array(vine.string().trim().minLength(1).maxLength(2000))
        .minLength(1)
        .maxLength(100),
    }),
  ),
])

const document = vine.object({
  version: vine.literal(1),
  blocks: vine.array(block).maxLength(500).distinct('id'),
})
export const referenceFields = vine.object({
  referenceKey: vine.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  blockId: vine.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  resourceId: vine.number().positive().withoutDecimals(),
  commentary: vine.string().trim().maxLength(5000).nullable().optional(),
  selectedQuote: vine.string().trim().minLength(1).maxLength(2000).nullable().optional(),
  videoStartSeconds: vine.number().min(0).max(604800).withoutDecimals().nullable().optional(),
})
const articleFields = () => ({
  title: vine.string().trim().minLength(1).maxLength(240),
  language: vine.enum(['ar', 'en']),
  content: document.clone(),
  references: vine.array(referenceFields).maxLength(100).distinct('referenceKey').optional(),
})
const params = () => vine.object({ id: vine.number().positive().withoutDecimals() })
const expectedVersion = () => vine.number().min(0).max(2147483646).withoutDecimals()
const pagination = () => ({
  page: vine.number().min(1).max(100000).withoutDecimals().optional(),
  perPage: vine.number().min(1).max(50).withoutDecimals().optional(),
})

export const createArticleValidator = vine.create(articleFields())
export const updateArticleValidator = vine.create({
  ...articleFields(),
  params: params(),
  expectedVersion: expectedVersion(),
})
export const articleParamsValidator = vine.create({ params: params() })
export const publicationValidator = vine.create({
  params: params(),
  expectedVersion: expectedVersion(),
})
export const draftArticleIndexValidator = vine.create(pagination())
export const publicArticleIndexValidator = vine.create({
  ...pagination(),
  language: vine.enum(['ar', 'en', 'both']).optional(),
  q: vine.string().trim().minLength(2).maxLength(200).optional(),
  authorId: vine.number().positive().withoutDecimals().optional(),
})
export const publishableArticleValidator = vine.create({
  ...articleFields(),
  content: vine.object({
    version: vine.literal(1),
    blocks: vine.array(block.clone()).minLength(1).maxLength(500).distinct('id'),
  }),
})

export type ArticleInput = Infer<typeof createArticleValidator>
export type ArticleContent = ArticleInput['content']

export type ReferenceInput = Infer<typeof referenceFields>

export type DiscoveryInput = Infer<typeof publicArticleIndexValidator>
