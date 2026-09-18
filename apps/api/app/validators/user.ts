import vine from '@vinejs/vine'

const email = () => vine.string().trim().toLowerCase().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(128)

export const signupValidator = vine.create({
  fullName: vine.string().nullable(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})

export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})
