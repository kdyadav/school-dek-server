import { z } from 'zod'
import { baseFields } from './_base.js'

export const AUDIENCE_OPTIONS = ['all', 'admin', 'teacher', 'student', 'parent']

export const announcementSchema = z.object({
  ...baseFields,
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  audience: z.enum(AUDIENCE_OPTIONS).default('all'),
  createdBy: z.number().int().positive().nullable().optional(),
})
