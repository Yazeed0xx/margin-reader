export interface ApiValidationError {
  field: string
  message: string
  rule?: string
  meta?: Record<string, unknown>
}

export interface ApiError {
  message: string
  status?: number
  validationErrors: ApiValidationError[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseValidationErrors(value: unknown): ApiValidationError[] {
  if (!isRecord(value) || !Array.isArray(value.errors)) {
    return []
  }

  return value.errors.flatMap((error) => {
    if (!isRecord(error) || typeof error.field !== 'string' || typeof error.message !== 'string') {
      return []
    }

    return [
      {
        field: error.field,
        message: error.message,
        ...(typeof error.rule === 'string' ? { rule: error.rule } : {}),
        ...(isRecord(error.meta) ? { meta: error.meta } : {}),
      },
    ]
  })
}

export function normalizeApiError(error: unknown): ApiError {
  const errorRecord = isRecord(error) ? error : undefined
  const response = errorRecord?.response
  const validationErrors = parseValidationErrors(response)
  const responseMessage =
    isRecord(response) && typeof response.message === 'string' ? response.message : undefined
  const fallbackMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

  return {
    message:
      validationErrors.map(({ message }) => message).join('\n') ||
      responseMessage ||
      fallbackMessage,
    status: typeof errorRecord?.status === 'number' ? errorRecord.status : undefined,
    validationErrors,
  }
}

export function getApiErrorMessage(error: unknown) {
  return normalizeApiError(error).message
}
