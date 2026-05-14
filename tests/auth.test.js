// Auth surface: /auth/setup, /auth/login, /auth/me, /auth/logout, /auth/needs-setup.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildTestApp, setupOwner, authHeaders } from './helpers/app.js'
import { prisma } from './helpers/db.js'

let app
beforeEach(async () => { app = await buildTestApp() })
afterEach(async () => { await app?.close() })

describe('GET /auth/needs-setup', () => {
  it('returns true when no users exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/needs-setup' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ needsSetup: true })
  })

  it('returns false once an owner has been created', async () => {
    await setupOwner(app)
    const res = await app.inject({ method: 'GET', url: '/auth/needs-setup' })
    expect(res.json()).toEqual({ needsSetup: false })
  })
})

describe('POST /auth/setup', () => {
  it('creates the first owner and returns a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/setup',
      payload: { name: 'Alice', email: 'alice@school.test', password: 'secret-1234' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toEqual(expect.any(String))
    expect(body.user).toMatchObject({ email: 'alice@school.test', role: 'owner', name: 'Alice' })
    expect(body.user).not.toHaveProperty('passwordHash')
  })

  it('refuses with 409 once any user exists', async () => {
    await setupOwner(app)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/setup',
      payload: { name: 'B', email: 'b@x.test', password: 'secret-1234' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('already_initialised')
  })

  it('rejects payloads that fail Zod validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/setup',
      payload: { name: '', email: 'not-an-email', password: 'short' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('invalid_input')
  })
})

describe('POST /auth/login', () => {
  it('returns a token with the right credentials', async () => {
    await setupOwner(app, { email: 'a@x.test', password: 'pw-12345678' })
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'a@x.test', password: 'pw-12345678' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.email).toBe('a@x.test')
  })

  it('rejects an unknown email', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'nobody@x.test', password: 'whatever-1' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a wrong password', async () => {
    await setupOwner(app, { email: 'a@x.test', password: 'pw-12345678' })
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'a@x.test', password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('records auth events in the audit log', async () => {
    await setupOwner(app, { email: 'a@x.test', password: 'pw-12345678' })
    await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'a@x.test', password: 'pw-12345678' },
    })
    await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'a@x.test', password: 'nope' },
    })
    const rows = await prisma.auditLog.findMany({ where: { entity: 'auth' }, orderBy: { id: 'asc' } })
    const actions = rows.map((r) => r.action)
    expect(actions).toEqual(expect.arrayContaining(['auth.register_success', 'auth.login_success', 'auth.login_failed']))
  })
})

describe('GET /auth/me', () => {
  it('401s without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns the current user when authenticated', async () => {
    const { token, user } = await setupOwner(app)
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: authHeaders(token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().user).toMatchObject({ email: user.email, role: 'owner' })
  })

  it('401s if the user behind the token has been deleted', async () => {
    const { token, user } = await setupOwner(app)
    await prisma.user.delete({ where: { id: user.id } })
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: authHeaders(token) })
    expect(res.statusCode).toBe(401)
  })
})
