import { test } from '@japa/runner'

test.group('API routes', () => {
  test('returns validated query data', async ({ client }) => {
    const response = await client.get('/api/test').qs({ search: 'functional', limit: 5 })

    response.assertStatus(200)
    response.assertBodyContains({
      ok: true,
      message: 'AdonisJS v7 API is reachable',
      query: { search: 'functional', limit: 5 },
    })
  })

  test('rejects invalid query data', async ({ client }) => {
    const response = await client.get('/api/test').qs({ limit: 101 })

    response.assertStatus(422)
  })

  test('creates a validated person', async ({ client }) => {
    const response = await client.post('/api/test').json({ name: 'Starter user', age: 30 })

    response.assertStatus(201)
    response.assertBody({
      created: true,
      person: { name: 'Starter user', age: 30 },
    })
  })

  test('rejects an invalid person', async ({ client }) => {
    const response = await client.post('/api/test').json({ name: '', age: 151 })

    response.assertStatus(422)
  })

  test('substitutes route parameters', async ({ client }) => {
    const response = await client.get('/api/users/42')

    response.assertStatus(200)
    response.assertBody({ id: '42', displayName: 'User 42', active: true })
  })
})
