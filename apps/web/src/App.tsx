import { useMutation, useQuery } from '@tanstack/react-query'

import { getApiErrorMessage } from '@poc/api-client'
import { createApiQueryClient } from '@poc/api-client/react-query'
import { POC_NAME } from '@poc/shared'

const api = createApiQueryClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3333',
})

export default function App() {
  const test = useQuery(api.test.index.queryOptions({ query: { search: 'web', limit: 5 } }))
  const createPerson = useMutation(
    api.test.store.mutationOptions({
      onSuccess: (result) => window.alert(`Created ${result.person.name}`),
    }),
  )

  return (
    <main>
      <h1>{POC_NAME}</h1>
      <p>
        {test.isPending
          ? 'Loading API...'
          : test.isError
            ? `API error: ${getApiErrorMessage(test.error)}`
            : test.data.message}
      </p>
      {createPerson.isError && <p>Mutation error: {getApiErrorMessage(createPerson.error)}</p>}
      <button
        type="button"
        disabled={createPerson.isPending}
        onClick={() =>
          createPerson.mutate({
            body: { name: 'Web user', age: 30 },
          })
        }
      >
        {createPerson.isPending ? 'Creating...' : 'Test typed mutation'}
      </button>
    </main>
  )
}
