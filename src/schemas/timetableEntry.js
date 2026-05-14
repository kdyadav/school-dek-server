import { z } from 'zod'
import { baseFields } from './_base.js'

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const timetableEntrySchema = z.object({
  ...baseFields,
  sectionId: z.number().int().positive(),
  dayOfWeek: z.enum(DAYS),
  periodId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
})
