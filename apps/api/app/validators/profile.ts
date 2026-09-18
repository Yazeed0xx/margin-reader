import vine from '@vinejs/vine'

export const updateProfileValidator = vine.create({
  fullName: vine
    .string()
    .trim()
    .maxLength(120)
    .transform((value) => value || null)
    .nullable()
    .optional(),
  bio: vine
    .string()
    .trim()
    .maxLength(2000)
    .transform((value) => value || null)
    .nullable()
    .optional(),
  interfaceLanguage: vine.enum(['ar', 'en']).optional(),
  readingLanguage: vine.enum(['ar', 'en', 'both']).optional(),
})

export const writerParamsValidator = vine.create({
  params: vine.object({ id: vine.number().positive().withoutDecimals() }),
})
