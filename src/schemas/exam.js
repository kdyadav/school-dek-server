import { z } from 'zod'
import { baseFields } from './_base.js'

export const examSubjectSchema = z.object({
  subjectId: z.number().int().positive(),
  maxMarks: z.number().int().positive(),
})

export const examSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(80),
  academicYearId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjects: z.array(examSubjectSchema).min(1),
})
