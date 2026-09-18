import { createTuyau } from '@tuyau/core/client'

import { registry } from '@poc/api/registry'

export * from './errors'

export type TokenProvider = () => Promise<string | null> | string | null

export interface ApiClientOptions {
  baseUrl: string
  tokenProvider?: TokenProvider
  credentials?: RequestCredentials
}

export function createApiTransport(options: ApiClientOptions) {
  const { baseUrl, tokenProvider, credentials = 'omit' } = options

  return createTuyau({
    baseUrl,
    registry,
    credentials,
    headers: { Accept: 'application/json' },
    hooks: {
      beforeRequest: [
        async (request) => {
          const token = await tokenProvider?.()
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`)
          }
        },
      ],
    },
  })
}

export function createApiClient(options: ApiClientOptions) {
  return createApiTransport(options).api
}

export type ApiClient = ReturnType<typeof createApiClient>
