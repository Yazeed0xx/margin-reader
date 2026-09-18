import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

test.group('Authentication', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('signs up and authenticates a user', async ({ client }) => {
    const signup = await client.post('/api/v1/auth/signup').json({
      fullName: 'Starter User',
      email: ' Starter@Example.com ',
      password: 'password123',
      passwordConfirmation: 'password123',
    })

    signup.assertStatus(200)
    signup.assertBodyContains({
      data: {
        user: {
          fullName: 'Starter User',
          email: 'starter@example.com',
          initials: 'SU',
        },
      },
    })

    const token = signup.body().data.token as string
    const profile = await client.get('/api/v1/account/profile').bearerToken(token)

    profile.assertStatus(200)
    profile.assertBodyContains({
      data: {
        email: 'starter@example.com',
      },
    })
  })

  test('logs in and revokes the current access token', async ({ client }) => {
    const signup = await client.post('/api/v1/auth/signup').json({
      fullName: null,
      email: 'login@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })
    const signupToken = signup.body().data.token as string

    const logout = await client.post('/api/v1/account/logout').bearerToken(signupToken)
    logout.assertStatus(200)

    const revokedProfile = await client.get('/api/v1/account/profile').bearerToken(signupToken)
    revokedProfile.assertStatus(401)

    const login = await client.post('/api/v1/auth/login').json({
      email: 'login@example.com',
      password: 'password123',
    })

    login.assertStatus(200)
    login.assertBodyContains({ data: { user: { email: 'login@example.com' } } })

    const loginToken = login.body().data.token as string
    const profile = await client.get('/api/v1/account/profile').bearerToken(loginToken)
    profile.assertStatus(200)
  })

  test('rejects unauthenticated requests, invalid credentials, and duplicate accounts', async ({
    client,
  }) => {
    const profile = await client.get('/api/v1/account/profile')
    profile.assertStatus(401)

    const account = {
      fullName: null,
      email: 'duplicate@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    }
    const signup = await client.post('/api/v1/auth/signup').json(account)
    signup.assertStatus(200)

    const duplicate = await client.post('/api/v1/auth/signup').json(account)
    duplicate.assertStatus(422)

    const invalidLogin = await client.post('/api/v1/auth/login').json({
      email: account.email,
      password: 'incorrect-password',
    })
    invalidLogin.assertStatus(400)
  })
})
