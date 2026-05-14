import { z } from 'zod'
import { baseFields } from './_base.js'

export const classSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(40),
  academicYearId: z.number().int().positive(),
})
