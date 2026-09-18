import { useQuery } from '@tanstack/react-query'

import { getApiErrorMessage } from '@poc/api-client'
import { createApiQueryClient } from '@poc/api-client/react-query'
import { POC_NAME } from '@poc/shared'

const api = createApiQueryClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3333',
})

export default function App() {
  const test = useQuery(api.test.index.queryOptions({ query: { search: 'electron', limit: 5 } }))
  const status = test.isPending ? 'loading' : test.isError ? 'error' : 'success'
  const message = test.isPending
    ? 'Loading API...'
    : test.isError
      ? getApiErrorMessage(test.error)
      : test.data.message

  return (
    <main>
      <h1>{POC_NAME}</h1>
      <p data-api-status={status}>{message}</p>
    </main>
  )
}
