import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeApiError } from '../src/errors.ts'

test('normalizes Adonis validation errors', () => {
  const error = normalizeApiError({
    status: 422,
    response: {
      errors: [
        {
          message: 'The limit field must not be greater than 100',
          rule: 'max',
          field: 'limit',
          meta: { max: 100 },
        },
      ],
    },
  })

  assert.deepEqual(error, {
    message: 'The limit field must not be greater than 100',
    status: 422,
    validationErrors: [
      {
        field: 'limit',
        message: 'The limit field must not be greater than 100',
        rule: 'max',
        meta: { max: 100 },
      },
    ],
  })
})

test('uses standard API messages and Error fallbacks', () => {
  assert.equal(
    normalizeApiError({ status: 401, response: { message: 'Unauthorized' } }).message,
    'Unauthorized',
  )
  assert.equal(normalizeApiError(new Error('Network unavailable')).message, 'Network unavailable')
})
