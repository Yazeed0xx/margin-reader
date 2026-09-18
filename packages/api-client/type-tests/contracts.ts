import { createApiClient } from '../src/index.js'

import type { Data } from '@poc/api/data'

const api = createApiClient({ baseUrl: 'http://localhost:3333' })

await api.test.store({ body: { name: 'John', age: 30 } })

await api.test.store({
  body: {
    // @ts-expect-error Tuyau must reject fields absent from the VineJS validator.
    wrongField: true,
  },
})

await api.users.show({
  params: {
    // @ts-expect-error Tuyau must use the route's `id` param.
    wrongParam: '123',
  },
})

await api.test.index({ query: { search: 'john', limit: 10 } })

await api.auth.newAccount.store({
  body: {
    fullName: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    passwordConfirmation: 'password123',
  },
})

declare const transformedUser: Data.User
transformedUser.email satisfies string

await api.auth.newAccount.store({
  // @ts-expect-error Signup requires password confirmation.
  body: {
    fullName: null,
    email: 'john@example.com',
    password: 'password123',
  },
})
