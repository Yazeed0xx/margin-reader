import assert from 'node:assert/strict'

import { createApiClient } from '../packages/api-client/dist/index.js'

const api = createApiClient({
  baseUrl: process.env.POC_API_URL ?? 'http://localhost:3333',
  tokenProvider: () => 'runtime-smoke-token',
})

const index = await api.test.index({ query: { search: 'runtime', limit: 3 } })
assert.equal(index.ok, true)
assert.equal(index.query.search, 'runtime')
assert.equal(index.query.limit, 3)
assert.equal(index.authorization, 'Bearer runtime-smoke-token')

const created = await api.test.store({ body: { name: 'John', age: 30 } })
assert.equal(created.created, true)
assert.deepEqual(created.person, { name: 'John', age: 30 })

const user = await api.users.show({ params: { id: '42' } })
assert.deepEqual(user, { id: '42', displayName: 'User 42', active: true })

const email = `runtime-${Date.now()}@example.com`
const signup = await fetch(
  `${process.env.POC_API_URL ?? 'http://localhost:3333'}/api/v1/auth/signup`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Runtime User',
      email,
      password: 'password123',
      passwordConfirmation: 'password123',
    }),
  },
)
assert.equal(signup.status, 200)
const signupBody = await signup.json()
const token = signupBody.data.token
assert.equal(typeof token, 'string')

const authHeaders = { authorization: `Bearer ${token}` }
const profile = await fetch(
  `${process.env.POC_API_URL ?? 'http://localhost:3333'}/api/v1/account/profile`,
  { headers: authHeaders },
)
assert.equal(profile.status, 200)
assert.equal((await profile.json()).data.email, email)

const logout = await fetch(
  `${process.env.POC_API_URL ?? 'http://localhost:3333'}/api/v1/account/logout`,
  { method: 'POST', headers: authHeaders },
)
assert.equal(logout.status, 200)

const revokedProfile = await fetch(
  `${process.env.POC_API_URL ?? 'http://localhost:3333'}/api/v1/account/profile`,
  { headers: authHeaders },
)
assert.equal(revokedProfile.status, 401)

console.log('runtime smoke passed: typed routes, compiled database, and authentication')
