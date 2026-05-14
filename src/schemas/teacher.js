import { z } from 'zod'
import { baseFields } from './_base.js'

export const teacherSchema = z.object({
  ...baseFields,
  employeeNo: z.string().min(1).max(30),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email(),
  phone: z.string().min(7).max(20).nullable().optional(),
})
