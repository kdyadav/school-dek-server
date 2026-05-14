import { z } from 'zod'
import { baseFields } from './_base.js'

export const ROLES = ['owner', 'admin', 'teacher', 'student', 'parent']

export const userSchema = z.object({
  ...baseFields,
  email: z.string().email(),
  passwordHash: z.string().min(20),
  role: z.enum(ROLES),
  name: z.string().min(1).max(120).optional(),
  linkedId: z.number().int().positive().nullable().optional(),
})
