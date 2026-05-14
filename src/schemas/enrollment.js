import { z } from 'zod'
import { baseFields } from './_base.js'

export const enrollmentSchema = z.object({
  ...baseFields,
  studentId: z.number().int().positive(),
  sectionId: z.number().int().positive(),
  academicYearId: z.number().int().positive(),
  rollNo: z.string().min(1).max(20),
})
