import { z } from 'zod'
import { baseFields } from './_base.js'

export const guardianSchema = z.object({
  ...baseFields,
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().min(7).max(20),
  email: z.string().email().nullable().optional(),
  relation: z.enum(['father', 'mother', 'guardian']).default('guardian'),
})
