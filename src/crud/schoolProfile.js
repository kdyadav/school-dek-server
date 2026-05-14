// School profile is a singleton row pinned to `key=1`. The CRUD factory
// assumes id/uuid keys, so we expose its endpoints by hand.

import { prisma } from '../db.js'
import { schoolProfileSchema } from '../schemas/index.js'
import { recordAudit, changedFields } from '../audit/logger.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

const REDACT = ['logoUrl', 'faviconUrl']
const SERVER_MANAGED = new Set(['createdAt', 'updatedAt'])

const cleanForWrite = (data) => {
  const out = {}
  for (const [k, v] of Object.entries(data || {})) {
    if (SERVER_MANAGED.has(k)) continue
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

// Strip the Date-typed audit columns before merging current+body for
// validation; the schema's baseFields expects ISO strings.
const stripServerManaged = (data) => {
  if (!data || typeof data !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (SERVER_MANAGED.has(k)) continue
    out[k] = v
  }
  return out
}

export async function registerSchoolProfileRoutes(fastify) {
  // Public-ish read: any authenticated user can read the profile (the SPA
  // shell renders the school name on every page).
  fastify.get('/schoolProfile', { preHandler: requireAuth }, async () => {
    const row = await prisma.schoolProfile.findUnique({ where: { key: 1 } })
    return row ?? null
  })

  // Upsert. Validates the merged-with-current row against the full schema,
  // then either creates or updates.
  fastify.put('/schoolProfile', { preHandler: requireRole('admin') }, async (request, reply) => {
    const current = await prisma.schoolProfile.findUnique({ where: { key: 1 } })
    const merged = { ...stripServerManaged(current), ...stripServerManaged(request.body), key: 1 }
    const parsed = schoolProfileSchema.safeParse(merged)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues })
    const data = cleanForWrite(parsed.data)
    try {
      const saved = current
        ? await prisma.schoolProfile.update({ where: { key: 1 }, data })
        : await prisma.schoolProfile.create({ data })
      if (current) {
        const changes = changedFields(current, saved, { redact: REDACT })
        if (Object.keys(changes).length > 0) {
          await recordAudit({
            entity: 'schoolProfile', action: 'entity.updated',
            entityId: 1, entityUuid: null, changes, redact: REDACT, actor: request.user,
          })
        }
      } else {
        await recordAudit({
          entity: 'schoolProfile', action: 'entity.created',
          entityId: 1, entityUuid: null, after: saved, redact: REDACT, actor: request.user,
        })
      }
      return saved
    } catch (err) {
      return reply.code(400).send({ error: 'save_failed', message: err.message })
    }
  })
}
