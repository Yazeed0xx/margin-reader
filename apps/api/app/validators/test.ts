import vine from '@vinejs/vine'

export const testIndexValidator = vine.create(
  vine.object({
    search: vine.string().trim().optional(),
    limit: vine.number().min(1).max(100).optional(),
  }),
)

export const testStoreValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1),
    age: vine.number().min(0).max(150),
  }),
)
