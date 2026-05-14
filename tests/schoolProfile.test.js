// School profile is the only "singleton" entity. Validate that it returns
// null before init, accepts an upsert from admins, and rejects bad payloads.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildTestApp, setupOwner, createUserAndToken, authHeaders } from './helpers/app.js'

let app
let ownerToken
beforeEach(async () => {
  app = await buildTestApp()
  ownerToken = (await setupOwner(app)).token
})
afterEach(async () => { await app?.close() })

const validProfile = (over = {}) => ({
  schoolName: 'Test Academy',
  shortName: 'TA',
  contact: { addressLines: ['1 Main St'], phone: '555', email: 'hi@ta.test', officeHours: '9-5' },
  social: [],
  nav: [],
  primaryColor: '#4f46e5',
  ...over,
})

describe('GET /schoolProfile', () => {
  it('returns null before any profile is saved', async () => {
    const res = await app.inject({ method: 'GET', url: '/schoolProfile', headers: authHeaders(ownerToken) })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('null')
  })

  it('401s without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/schoolProfile' })
    expect(res.statusCode).toBe(401)
  })
})

describe('PUT /schoolProfile', () => {
  it('creates the singleton on first PUT and returns it on next GET', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/schoolProfile',
      headers: authHeaders(ownerToken),
      payload: validProfile(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().schoolName).toBe('Test Academy')

    const after = await app.inject({ method: 'GET', url: '/schoolProfile', headers: authHeaders(ownerToken) })
    expect(after.json().shortName).toBe('TA')
  })

  it('updates an existing profile and persists unchanged fields', async () => {
    await app.inject({
      method: 'PUT', url: '/schoolProfile',
      headers: authHeaders(ownerToken),
      payload: validProfile(),
    })
    const res = await app.inject({
      method: 'PUT', url: '/schoolProfile',
      headers: authHeaders(ownerToken),
      payload: { schoolName: 'Renamed Academy' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().schoolName).toBe('Renamed Academy')
    expect(res.json().shortName).toBe('TA') // unchanged
  })

  it('rejects bad payloads', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/schoolProfile',
      headers: authHeaders(ownerToken),
      payload: { schoolName: '', shortName: 'X', primaryColor: 'not-a-color' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('invalid_input')
  })

  it('forbids non-admin writers', async () => {
    const { token: teacherToken } = await createUserAndToken(app, {
      email: 't@x.test', role: 'teacher',
    })
    const res = await app.inject({
      method: 'PUT', url: '/schoolProfile',
      headers: authHeaders(teacherToken),
      payload: validProfile(),
    })
    expect(res.statusCode).toBe(403)
  })
})
