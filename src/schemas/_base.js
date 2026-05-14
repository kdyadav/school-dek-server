import { z } from 'zod'

export const baseFields = {
  id: z.number().int().positive().optional(),
  uuid: z.string().uuid().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
export const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM')
