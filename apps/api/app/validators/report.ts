import vine from '@vinejs/vine'
export const reportValidator = vine.create({
  params: vine.object({ id: vine.number().positive().withoutDecimals() }),
  reason: vine.enum(['spam', 'harassment', 'copyright', 'other']),
  details: vine.string().trim().maxLength(2000).nullable().optional(),
})
