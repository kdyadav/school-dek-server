import { z } from 'zod'
import { baseFields, isoDate } from './_base.js'

export const academicYearSchema = z.object({
  ...baseFields,
  name: z.string().min(2).max(40),
  startDate: isoDate,
  endDate: isoDate,
  isActive: z.boolean().default(false),
}).refine((v) => v.startDate <= v.endDate, {
  message: 'startDate must be on or before endDate',
  path: ['endDate'],
})
