import vine from '@vinejs/vine'

import type { Infer } from '@vinejs/vine/types'

const id = () => vine.number().positive().withoutDecimals()
const params = () => vine.object({ id: id() })
const version = () => vine.number().min(0).max(2147483646).withoutDecimals()
export const sourceParamsValidator = vine.create({
  params: vine.object({ id: id(), referenceKey: vine.string().regex(/^[A-Za-z0-9_-]{1,100}$/) }),
  revisionId: id(),
})
export const readingParamsValidator = vine.create({ params: params() })
export const bookmarkIndexValidator = vine.create({
  page: vine.number().min(1).max(100000).withoutDecimals().optional(),
  perPage: vine.number().min(1).max(50).withoutDecimals().optional(),
})
export const saveProgressValidator = vine.create({
  params: params(),
  expectedVersion: version(),
  revisionId: id(),
  blockId: vine.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  blockProgress: vine.number().min(0).max(1),
})
export const clearProgressValidator = vine.create({ params: params(), expectedVersion: version() })
export type ProgressInput = Omit<Infer<typeof saveProgressValidator>, 'params'>
