import { z } from 'zod'
import { baseFields, isoDate } from './_base.js'

export const PAYMENT_MODES = ['cash', 'online', 'cheque', 'other']

export const paymentSchema = z.object({
  ...baseFields,
  invoiceId: z.number().int().positive(),
  amount: z.number().positive(),
  paidOn: isoDate,
  mode: z.enum(PAYMENT_MODES).default('cash'),
  receiptNo: z.string().min(1).max(30),
})
