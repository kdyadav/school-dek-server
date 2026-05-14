// Read-only access to the audit log. Writes happen as a side-effect of every
// CRUD/auth route via src/audit/logger.js#recordAudit.

import { prisma } from '../db.js'
import { requireRole } from '../auth/middleware.js'

const ALLOWED_FILTERS = ['entity', 'entityId', 'actorId', 'action']

const coerce = (raw) => {
  if (raw == null) return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  return raw
}

export async function registerAuditRoutes(fastify) {
  const guard = requireRole('admin')

  // GET /audit-logs?where[entity]=students&since=2025-01-01&until=2025-12-31&limit=50&offset=0
  fastify.get('/', { preHandler: guard }, async (request, reply) => {
    const where = {}
    const w = request.query?.where || {}
    for (const [k, v] of Object.entries(w)) {
      if (!ALLOWED_FILTERS.includes(k)) {
        return reply.code(400).send({ error: `filter not allowed: ${k}` })
      }
      where[k] = coerce(v)
    }
    const since = request.query?.since
    const until = request.query?.until
    if (since || until) {
      where.createdAt = {
        ...(since ? { gte: new Date(String(since)) } : {}),
        ...(until ? { lte: new Date(String(until) + 'T23:59:59.999Z') } : {}),
      }
    }
    const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 500)
    const offset = Math.max(Number(request.query?.offset) || 0, 0)

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ])
    return { rows, total, limit, offset }
  })

  // DELETE /audit-logs — owner-only nuke. Mirrors the previous clearAll().
  fastify.delete('/', { preHandler: requireRole() /* owner only */ }, async () => {
    const { count } = await prisma.auditLog.deleteMany({})
    return { ok: true, deleted: count }
  })
}
