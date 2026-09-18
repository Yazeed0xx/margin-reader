import { QueryClient } from '@tanstack/react-query'

import { createApiClient } from '@poc/api-client'

export const tokenStore = {
  get: () => sessionStorage.getItem('margin.token'),
  set: (token: string | null) => {
    if (token) {
      sessionStorage.setItem('margin.token', token)
    } else {
      sessionStorage.removeItem('margin.token')
    }
  },
}
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3333',
  tokenProvider: tokenStore.get,
})
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})
export type { Data } from '@poc/api/data'
