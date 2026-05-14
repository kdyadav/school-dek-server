import { z } from 'zod'
import { baseFields } from './_base.js'
import { salaryComponentSchema } from './salaryStructure.js'

export const PAYSLIP_STATUS = ['pending', 'partial', 'paid']

export const payslipSchema = z.object({
  ...baseFields,
  teacherId: z.number().int().positive(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM'),
  gross: z.number().nonnegative(),
  deductions: z.number().nonnegative(),
  netAmount: z.number().nonnegative(),
  status: z.enum(PAYSLIP_STATUS).default('pending'),
  components: z.array(salaryComponentSchema).optional(),
  notes: z.string().max(500).nullable().optional(),
})
