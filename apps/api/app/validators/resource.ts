import vine from '@vinejs/vine'

export const ingestResourceValidator = vine.create({ url: vine.string().trim().maxLength(2048) })
export const resourceParamsValidator = vine.create({
  params: vine.object({ id: vine.number().positive().withoutDecimals() }),
})
