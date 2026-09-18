import { VineDate } from '@vinejs/vine'
import { DateTime } from 'luxon'

declare module '@vinejs/vine/types' {
  interface VineGlobalTransforms {
    date: DateTime
  }
}

VineDate.transform((value) => DateTime.fromJSDate(value))
