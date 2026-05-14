import { z } from 'zod'
import { baseFields, isoDate } from './_base.js'

export const ATTENDANCE_STATUS = ['present', 'absent', 'late']

export const attendanceSchema = z.object({
  ...baseFields,
  sectionId: z.number().int().positive(),
  date: isoDate,
  studentId: z.number().int().positive(),
  status: z.enum(ATTENDANCE_STATUS),
  markedBy: z.number().int().positive().nullable().optional(),
})
