import { z } from 'zod'
import { baseFields } from './_base.js'

export const AUDIT_ACTIONS = [
  'entity.created',
  'entity.updated',
  'entity.deleted',
  'auth.login_success',
  'auth.login_failed',
  'auth.logout',
  'auth.register_success',
  'auth.register_failed',
  'event',
]

export const auditLogSchema = z.object({
  ...baseFields,
  entity: z.string().min(1),
  entityId: z.union([z.number().int(), z.string(), z.null()]).optional(),
  entityUuid: z.string().nullable().optional(),
  action: z.enum(AUDIT_ACTIONS),
  actorId: z.number().int().nullable().optional(),
  actorRole: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
  changes: z.record(z.string(), z.object({
    before: z.unknown().optional(),
    after: z.unknown().optional(),
  })).nullable().optional(),
  before: z.record(z.string(), z.unknown()).nullable().optional(),
  after: z.record(z.string(), z.unknown()).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
})
