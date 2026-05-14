import { z } from 'zod'
import { baseFields } from './_base.js'

export const feeItemSchema = z.object({
  label: z.string().min(1).max(80),
  amount: z.number().positive(),
})

export const feeStructureSchema = z.object({
  ...baseFields,
  classId: z.number().int().positive(),
  academicYearId: z.number().int().positive(),
  items: z.array(feeItemSchema).min(1),
})
