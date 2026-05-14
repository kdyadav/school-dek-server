import { z } from 'zod'
import { baseFields, hhmm } from './_base.js'

export const periodSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(40),
  startTime: hhmm,
  endTime: hhmm,
}).refine((v) => v.startTime < v.endTime, {
  message: 'Start time must be before end time',
  path: ['endTime'],
})
