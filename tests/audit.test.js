// Audit middleware: every CRUD mutation should emit a row, redaction lists
// from the registry should be honoured, and the GET /audit-logs endpoint
// should support filtering + pagination.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildTestApp, setupOwner, createUserAndToken, authHeaders } from './helpers/app.js'
import { prisma } from './helpers/db.js'

let app
let ownerToken
let owner
beforeEach(async () => {
  app = await buildTestApp()
  const setup = await setupOwner(app)
  ownerToken = setup.token
  owner = setup.user
})
afterEach(async () => { await app?.close() })

const post = (url, payload, token = ownerToken) =>
  app.inject({ method: 'POST', url, payload, headers: authHeaders(token) })
const put = (url, payload, token = ownerToken) =>
  app.inject({ method: 'PUT', url, payload, headers: authHeaders(token) })
const del = (url, token = ownerToken) =>
  app.inject({ method: 'DELETE', url, headers: authHeaders(token) })

const sampleYear = (over = {}) => ({
  name: '2025-26', startDate: '2025-06-01', endDate: '2026-05-31', isActive: true, ...over,
})

describe('audit emission', () => {
  it('records entity.created with after-snapshot and actor', async () => {
    const created = (await post('/academicYears', sampleYear())).json()
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'academicYears', action: 'entity.created', entityId: created.id },
    })
    expect(log).not.toBeNull()
    expect(log.actorId).toBe(owner.id)
    expect(log.actorRole).toBe('owner')
    expect(log.after.name).toBe('2025-26')
  })

  it('records entity.updated with a per-field changes diff', async () => {
    const created = (await post('/academicYears', sampleYear())).json()
    await put(`/academicYears/${created.id}`, { name: 'Renamed' })
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'academicYears', action: 'entity.updated', entityId: created.id },
    })
    expect(log).not.toBeNull()
    expect(log.changes.name).toEqual({ before: '2025-26', after: 'Renamed' })
    // Unchanged fields must not appear in the diff.
    expect(log.changes.startDate).toBeUndefined()
  })

  it('skips writing an updated row when no field changed', async () => {
    const created = (await post('/academicYears', sampleYear())).json()
    await put(`/academicYears/${created.id}`, { name: created.name })
    const updates = await prisma.auditLog.count({
      where: { entity: 'academicYears', action: 'entity.updated', entityId: created.id },
    })
    expect(updates).toBe(0)
  })

  it('records entity.deleted with the before-snapshot', async () => {
    const created = (await post('/academicYears', sampleYear())).json()
    await del(`/academicYears/${created.id}`)
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'academicYears', action: 'entity.deleted', entityId: created.id },
    })
    expect(log).not.toBeNull()
    expect(log.before.name).toBe('2025-26')
  })

  it('redacts passwordHash on user writes', async () => {
    // Owners can manage users; create one through the API.
    const res = await post('/users', {
      email: 'new@x.test', role: 'admin', name: 'N',
      passwordHash: 'should-not-leak-into-audit',
    })
    expect(res.statusCode).toBe(201)
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'users', action: 'entity.created' },
    })
    expect(log.after.passwordHash).toBe('[redacted]')
  })
})

describe('GET /audit-logs', () => {
  it('returns paginated rows with filters', async () => {
    // Schema requires name length >= 2; use longer strings so POSTs actually succeed.
    await post('/academicYears', sampleYear({ name: '2023' }))
    await post('/academicYears', sampleYear({ name: '2024' }))
    await post('/subjects', { name: 'Math', code: 'MATH' })

    const res = await app.inject({
      method: 'GET', url: '/audit-logs?where[entity]=academicYears&limit=10',
      headers: authHeaders(ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(2)
    expect(body.rows.every((r) => r.entity === 'academicYears')).toBe(true)
  })

  it('rejects unknown filter fields', async () => {
    const res = await app.inject({
      method: 'GET', url: '/audit-logs?where[bogus]=1',
      headers: authHeaders(ownerToken),
    })
    expect(res.statusCode).toBe(400)
  })

  it('forbids non-admin readers', async () => {
    const { token: teacherToken } = await createUserAndToken(app, {
      email: 't@x.test', role: 'teacher',
    })
    const res = await app.inject({
      method: 'GET', url: '/audit-logs',
      headers: authHeaders(teacherToken),
    })
    expect(res.statusCode).toBe(403)
  })
})
