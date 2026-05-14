import { z } from 'zod'
import { baseFields, isoDate } from './_base.js'

export const SALARY_PAYMENT_MODES = ['bank_transfer', 'cash', 'cheque', 'other']

export const salaryPaymentSchema = z.object({
  ...baseFields,
  payslipId: z.number().int().positive(),
  amount: z.number().positive(),
  paidOn: isoDate,
  mode: z.enum(SALARY_PAYMENT_MODES).default('bank_transfer'),
  reference: z.string().max(60).nullable().optional(),
  voucherNo: z.string().min(1).max(30),
})
