import { z } from 'zod'
import { baseFields } from './_base.js'

export const subjectSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(60),
  code: z.string().min(1).max(20),
})
