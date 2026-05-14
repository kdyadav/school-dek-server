// Generic CRUD factory tests. AcademicYear stands in for "ordinary entity";
// each behaviour exercised here is shared by every other registry table.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildTestApp, setupOwner, createUserAndToken, authHeaders } from './helpers/app.js'

let app
let ownerToken
beforeEach(async () => {
  app = await buildTestApp()
  ownerToken = (await setupOwner(app)).token
})
afterEach(async () => { await app?.close() })

const sampleYear = (over = {}) => ({
  name: '2025-26',
  startDate: '2025-06-01',
  endDate: '2026-05-31',
  isActive: true,
  ...over,
})

const post = (url, payload, token = ownerToken) =>
  app.inject({ method: 'POST', url, payload, headers: authHeaders(token) })
const get = (url, token = ownerToken) =>
  app.inject({ method: 'GET', url, headers: authHeaders(token) })
const put = (url, payload, token = ownerToken) =>
  app.inject({ method: 'PUT', url, payload, headers: authHeaders(token) })
const del = (url, token = ownerToken) =>
  app.inject({ method: 'DELETE', url, headers: authHeaders(token) })

describe('CRUD factory — happy path on /academicYears', () => {
  it('POST creates the row and returns 201 with id+uuid', async () => {
    const res = await post('/academicYears', sampleYear())
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toEqual(expect.any(Number))
    expect(body.uuid).toEqual(expect.any(String))
    expect(body.name).toBe('2025-26')
  })

  it('GET /:table lists rows, supports limit/offset and where filter', async () => {
    // Schema requires name length >= 2; use 4-char names so the rows actually persist.
    await post('/academicYears', sampleYear({ name: '2023', isActive: false }))
    await post('/academicYears', sampleYear({ name: '2024', isActive: true }))
    await post('/academicYears', sampleYear({ name: '2025', isActive: true }))

    const all = await get('/academicYears')
    expect(all.json()).toHaveLength(3)

    const active = await get('/academicYears?where[isActive]=true')
    expect(active.json().every((r) => r.isActive === true)).toBe(true)
    expect(active.json()).toHaveLength(2)

    const paged = await get('/academicYears?limit=1&offset=1')
    expect(paged.json()).toHaveLength(1)
  })

  it('GET /:table/count returns the total', async () => {
    await post('/academicYears', sampleYear({ name: '2023' }))
    await post('/academicYears', sampleYear({ name: '2024' }))
    const res = await get('/academicYears/count')
    expect(res.json()).toEqual({ count: 2 })
  })

  it('GET /:table/:id and /:table/:uuid both work', async () => {
    const created = (await post('/academicYears', sampleYear())).json()
    const byId = await get(`/academicYears/${created.id}`)
    const byUuid = await get(`/academicYears/${created.uuid}`)
    expect(byId.json().id).toBe(created.id)
    expect(byUuid.json().uuid).toBe(created.uuid)
  })

  it('PUT patches a single field and persists everything else', async () => {
    const created = (await post('/academicYears', sampleYear())).json()
    const res = await put(`/academicYears/${created.id}`, { name: '2025-26 (renamed)' })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('2025-26 (renamed)')
    expect(res.json().startDate).toBe('2025-06-01')
  })

  it('DELETE removes the row', async () => {
    const created = (await post('/academicYears', sampleYear())).json()
    const res = await del(`/academicYears/${created.id}`)
    expect(res.statusCode).toBe(200)
    const after = await get(`/academicYears/${created.id}`)
    expect(after.statusCode).toBe(404)
  })
})

describe('CRUD factory — sad paths', () => {
  it('returns 400 for an invalid create payload', async () => {
    const res = await post('/academicYears', { name: '', startDate: 'nope', endDate: 'nope' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('invalid_input')
  })

  it('rejects unknown where filters with 400', async () => {
    const res = await get('/academicYears?where[wat]=1')
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/wat/)
  })

  it('returns 404 on PUT/DELETE/GET of an unknown id', async () => {
    expect((await get('/academicYears/9999')).statusCode).toBe(404)
    expect((await put('/academicYears/9999', { name: 'x' })).statusCode).toBe(404)
    expect((await del('/academicYears/9999')).statusCode).toBe(404)
  })
})

describe('CRUD factory — auth + role gates', () => {
  it('401s when no bearer token is supplied', async () => {
    const res = await app.inject({ method: 'GET', url: '/academicYears' })
    expect(res.statusCode).toBe(401)
  })

  it('forbids a teacher from writing admin-only tables', async () => {
    const { token: teacherToken } = await createUserAndToken(app, {
      email: 't@x.test', role: 'teacher',
    })
    const res = await post('/academicYears', sampleYear(), teacherToken)
    expect(res.statusCode).toBe(403)
  })

  it('still lets a teacher write attendance (its allowed role)', async () => {
    // Set up a section + student so the FK constraints pass.
    const year = (await post('/academicYears', sampleYear())).json()
    const klass = (await post('/classes', { name: 'Grade 1', academicYearId: year.id })).json()
    const section = (await post('/sections', { classId: klass.id, name: 'A' })).json()
    const guardian = (await post('/guardians', {
      firstName: 'G', lastName: 'X', phone: '5551234567', relation: 'guardian',
    })).json()
    const student = (await post('/students', {
      admissionNo: 'ADM-1', firstName: 'S', lastName: 'X', dob: '2015-01-01',
      gender: 'male', guardianId: guardian.id, currentSectionId: section.id,
    })).json()

    const { token: teacherToken } = await createUserAndToken(app, {
      email: 't@x.test', role: 'teacher',
    })
    const res = await post('/attendance', {
      sectionId: section.id, studentId: student.id, date: '2025-09-01', status: 'present',
    }, teacherToken)
    expect(res.statusCode).toBe(201)
  })
})
