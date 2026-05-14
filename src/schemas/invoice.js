import { z } from 'zod'
import { baseFields, isoDate } from './_base.js'

export const INVOICE_STATUS = ['pending', 'partial', 'paid']

export const invoiceSchema = z.object({
  ...baseFields,
  studentId: z.number().int().positive(),
  academicYearId: z.number().int().positive(),
  amount: z.number().positive(),
  dueDate: isoDate,
  status: z.enum(INVOICE_STATUS).default('pending'),
  items: z.array(z.object({
    label: z.string(),
    amount: z.number(),
  })).optional(),
})
