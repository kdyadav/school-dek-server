import { z } from 'zod'
import { baseFields, isoDate } from './_base.js'

export const SALARY_COMPONENT_TYPES = ['earning', 'deduction']

export const salaryComponentSchema = z.object({
  label: z.string().min(1).max(80),
  amount: z.number().nonnegative(),
  type: z.enum(SALARY_COMPONENT_TYPES),
})

export const salaryStructureSchema = z.object({
  ...baseFields,
  teacherId: z.number().int().positive(),
  effectiveFrom: isoDate,
  components: z.array(salaryComponentSchema).min(1),
})
