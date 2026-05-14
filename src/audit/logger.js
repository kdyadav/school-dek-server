// Server-side audit writer. Mirrors the shape produced by the previous
// client-side logger (src/audit/logger.js) so the audit page reads the same
// records regardless of who wrote them.

import { prisma } from '../db.js'

const DEFAULT_REDACT = new Set(['passwordHash', 'password', 'token'])
const ALWAYS_IGNORED = new Set(['updatedAt'])
const REDACTED = '[redacted]'

const redactObject = (obj, redactSet) => {
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const k of Object.keys(obj)) out[k] = redactSet.has(k) ? REDACTED : obj[k]
  return out
}

const shallowEqual = (a, b) => {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export function changedFields(before, after, { ignore = [], redact = [] } = {}) {
  const ignoreSet = new Set([...ALWAYS_IGNORED, ...ignore])
  const redactSet = new Set([...DEFAULT_REDACT, ...redact])
  const out = {}
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ])
  for (const k of keys) {
    if (ignoreSet.has(k)) continue
    const a = before ? before[k] : undefined
    const b = after ? after[k] : undefined
    if (!shallowEqual(a, b)) {
      out[k] = {
        before: redactSet.has(k) ? REDACTED : a,
        after: redactSet.has(k) ? REDACTED : b,
      }
    }
  }
  return out
}

/**
 * Persist a single audit row. Best-effort: failures are swallowed so a broken
 * audit pipeline never blocks the user-facing operation.
 *
 * @param {object} entry
 * @param {object} [entry.actor] { id, role, name } — usually request.user
 */
export async function recordAudit({
  entity,
  action,
  entityId = null,
  entityUuid = null,
  before = null,
  after = null,
  changes = null,
  redact = [],
  meta = null,
  actor = null,
} = {}) {
  if (!entity || !action) return null

  const redactSet = new Set([...DEFAULT_REDACT, ...redact])
  const safeBefore = before ? redactObject(before, redactSet) : null
  const safeAfter = after ? redactObject(after, redactSet) : null
  const safeChanges = changes
    ? Object.fromEntries(Object.entries(changes).map(([k, v]) => ([
      k,
      redactSet.has(k) ? { before: REDACTED, after: REDACTED } : v,
    ])))
    : null

  try {
    return await prisma.auditLog.create({
      data: {
        entity,
        entityId: entityId ?? null,
        entityUuid: entityUuid ?? null,
        action,
        actorId: actor?.id ?? null,
        actorRole: actor?.role ?? 'system',
        actorName: actor?.name ?? 'system',
        changes: safeChanges,
        before: safeBefore,
        after: safeAfter,
        meta,
      },
    })
  } catch (err) {
    // Don't throw; just log so the request completes.
    // eslint-disable-next-line no-console
    console.warn('[audit] write failed:', err?.message || err)
    return null
  }
}

export default { recordAudit, changedFields }
