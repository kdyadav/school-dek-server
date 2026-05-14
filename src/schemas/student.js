import { z } from 'zod'
import { baseFields, isoDate } from './_base.js'

export const studentSchema = z.object({
  ...baseFields,
  admissionNo: z.string().min(1).max(30),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  dob: isoDate,
  gender: z.enum(['male', 'female', 'other']),
  guardianId: z.number().int().positive().nullable().optional(),
  currentSectionId: z.number().int().positive().nullable().optional(),
})
