import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

import { getApiErrorMessage } from '@poc/api-client'
import { createApiQueryClient } from '@poc/api-client/react-query'
import { POC_NAME } from '@poc/shared'

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3333'
const queryClient = new QueryClient()
const api = createApiQueryClient({
  baseUrl,
})

function ApiResult() {
  const test = useQuery(api.test.index.queryOptions({ query: { search: 'expo', limit: 5 } }))

  if (test.isPending) {
    return <Text>Calling {baseUrl}/api/test...</Text>
  }
  if (test.error) {
    return <Text testID="api-error">{getApiErrorMessage(test.error)}</Text>
  }

  return <Text testID="api-result">{test.data.message}</Text>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.container}>
        <Text style={styles.title}>{POC_NAME}</Text>
        <ApiResult />
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '700' },
})
