import { createTuyauReactQueryClient } from '@tuyau/react-query'

import { createApiTransport, type ApiClientOptions } from './index'

export function createApiQueryClient(options: ApiClientOptions) {
  return createTuyauReactQueryClient({ client: createApiTransport(options) })
}
