// Wires REST routes for one entry of the CRUD registry. Reuses the per-table
// Zod schemas to validate writes and emits audit log rows around mutations.

import { prisma } from '../db.js'
import { recordAudit, changedFields } from '../audit/logger.js'
import { requireRole } from '../auth/middleware.js'
import { delegateFor, jsonFieldsFor, allowedWhereFor } from './registry.js'

const SERVER_MANAGED = new Set(['id', 'uuid', 'createdAt', 'updatedAt'])

// Strip server-managed columns and coerce empty patches into a no-op.
const cleanForWrite = (data) => {
  const out = {}
  for (const [k, v] of Object.entries(data || {})) {
    if (SERVER_MANAGED.has(k)) continue
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

// Same as cleanForWrite but used pre-validation. Prisma returns createdAt /
// updatedAt as Date instances; the Zod baseFields expect ISO strings, so we
// drop them before merging current+body for the PUT validate-then-write path.
const stripServerManaged = (data) => {
  if (!data || typeof data !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (SERVER_MANAGED.has(k)) continue
    out[k] = v
  }
  return out
}

// Numeric IDs vs UUIDs: clients call /:table/123 and /:table/<uuid>. We
// accept either and route to the right Prisma `where` clause.
const buildWhere = (idOrUuid) => {
  const asNum = Number(idOrUuid)
  return Number.isInteger(asNum) && String(asNum) === String(idOrUuid)
    ? { id: asNum }
    : { uuid: String(idOrUuid) }
}

// Coerce ?where[field]=value into a Prisma `where` object. Numbers and
// booleans are coerced; everything else stays a string.
const coerceValue = (raw) => {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  return raw
}

const parseWhereQuery = (query, allowed) => {
  const where = {}
  if (!query || typeof query !== 'object') return where
  // Fastify parses ?where[a]=1&where[b]=2 into { where: { a: '1', b: '2' } }.
  const w = query.where || {}
  for (const [k, v] of Object.entries(w)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Filter not allowed on field: ${k}`)
      err.statusCode = 400
      throw err
    }
    where[k] = coerceValue(v)
  }
  return where
}

const parseRange = (query) => {
  const out = {}
  const limit = Number(query?.limit)
  const offset = Number(query?.offset)
  if (Number.isInteger(limit) && limit > 0 && limit <= 1000) out.take = limit
  if (Number.isInteger(offset) && offset >= 0) out.skip = offset
  return out
}

export function registerCrudRoutes(fastify, table, entry) {
  const delegate = delegateFor(table)
  if (!delegate) throw new Error(`No Prisma delegate for table: ${table}`)
  const model = prisma[delegate]
  if (!model) throw new Error(`Prisma client missing delegate: ${delegate}`)

  const allowedWhere = allowedWhereFor(table)
  const { schema, redact, roles } = entry
  const readGuard = requireRole(...roles.read)
  const writeGuard = requireRole(...roles.write)

  // Per-table date-range support for the few endpoints that need it. Currently
  // only /attendance uses it (Dashboard summaries). Implemented here rather
  // than a per-table file to keep the registry-driven approach intact.
  const augmentWhereFromQuery = (where, query) => {
    if (table === 'attendance') {
      const from = query?.dateFrom
      const to = query?.dateTo
      if (from || to) {
        where.date = {
          ...(from ? { gte: String(from) } : {}),
          ...(to ? { lte: String(to) } : {}),
        }
      }
    }
    return where
  }

  // GET /:table — list with optional where + pagination.
  fastify.get(`/${table}`, { preHandler: readGuard }, async (request, reply) => {
    let where
    try { where = parseWhereQuery(request.query, allowedWhere) }
    catch (err) { return reply.code(err.statusCode || 400).send({ error: err.message }) }
    augmentWhereFromQuery(where, request.query)
    const range = parseRange(request.query)
    return model.findMany({ where, ...range, orderBy: { id: 'asc' } })
  })

  // GET /:table/count
  fastify.get(`/${table}/count`, { preHandler: readGuard }, async () => {
    const total = await model.count()
    return { count: total }
  })

  // GET /:table/:idOrUuid
  fastify.get(`/${table}/:idOrUuid`, { preHandler: readGuard }, async (request, reply) => {
    const row = await model.findUnique({ where: buildWhere(request.params.idOrUuid) })
    if (!row) return reply.code(404).send({ error: 'not_found' })
    return row
  })

  // POST /:table
  fastify.post(`/${table}`, { preHandler: writeGuard }, async (request, reply) => {
    const parsed = schema.safeParse(stripServerManaged(request.body))
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues })
    const data = cleanForWrite(parsed.data)
    try {
      const created = await model.create({ data })
      await recordAudit({
        entity: table, action: 'entity.created',
        entityId: created.id, entityUuid: created.uuid,
        after: created, redact, actor: request.user,
      })
      return reply.code(201).send(created)
    } catch (err) {
      return reply.code(400).send({ error: 'create_failed', message: err.message })
    }
  })

  // PUT /:table/:idOrUuid — patch-merge with current row, then validate full.
  fastify.put(`/${table}/:idOrUuid`, { preHandler: writeGuard }, async (request, reply) => {
    const where = buildWhere(request.params.idOrUuid)
    const current = await model.findUnique({ where })
    if (!current) return reply.code(404).send({ error: 'not_found' })

    const merged = { ...stripServerManaged(current), ...stripServerManaged(request.body) }
    const parsed = schema.safeParse(merged)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues })
    const data = cleanForWrite(parsed.data)
    try {
      const updated = await model.update({ where, data })
      const changes = changedFields(current, updated, { redact })
      if (Object.keys(changes).length > 0) {
        await recordAudit({
          entity: table, action: 'entity.updated',
          entityId: updated.id, entityUuid: updated.uuid,
          changes, redact, actor: request.user,
        })
      }
      return updated
    } catch (err) {
      return reply.code(400).send({ error: 'update_failed', message: err.message })
    }
  })

  // DELETE /:table/:idOrUuid
  fastify.delete(`/${table}/:idOrUuid`, { preHandler: writeGuard }, async (request, reply) => {
    const where = buildWhere(request.params.idOrUuid)
    const current = await model.findUnique({ where })
    if (!current) return reply.code(404).send({ error: 'not_found' })
    try {
      await model.delete({ where })
      await recordAudit({
        entity: table, action: 'entity.deleted',
        entityId: current.id, entityUuid: current.uuid,
        before: current, redact, actor: request.user,
      })
      return { ok: true }
    } catch (err) {
      return reply.code(400).send({ error: 'delete_failed', message: err.message })
    }
  })
}
