import vine from '@vinejs/vine'

export const followParamsValidator = vine.create({
  params: vine.object({ id: vine.number().positive().withoutDecimals() }),
})
export const followingIndexValidator = vine.create({
  page: vine.number().min(1).max(100000).withoutDecimals().optional(),
  perPage: vine.number().min(1).max(50).withoutDecimals().optional(),
})
