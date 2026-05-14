import { z } from 'zod'
import { baseFields } from './_base.js'

export const examMarkSchema = z.object({
  ...baseFields,
  examId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  marks: z.number().min(0),
  grade: z.string().max(5).optional(),
})
