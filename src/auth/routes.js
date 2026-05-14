// Auth surface. Three concerns live here:
//  1. authPlugin — registers @fastify/jwt and exposes a tryUser() helper that
//     reads the bearer token without 401-ing if it's missing.
//  2. registerAuth — /auth/setup, /auth/login, /auth/logout, /auth/me
//  3. Audit emission for login/setup/logout, mirroring the previous client
//     behaviour in src/stores/auth.js.

import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { config } from '../config.js'
import { prisma } from '../db.js'
import { recordAudit } from '../audit/logger.js'

const ROLES = ['owner', 'admin', 'teacher', 'student', 'parent']

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const setupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

const toPublicUser = (u) => ({
  id: u.id,
  uuid: u.uuid,
  email: u.email,
  role: u.role,
  name: u.name || u.email.split('@')[0],
  linkedId: u.linkedId ?? null,
})

const signToken = (fastify, user) =>
  fastify.jwt.sign(toPublicUser(user), { expiresIn: config.jwt.expiresIn })


// ── Plugin: JWT verifier (mounted once at app level) ────────────────────────

export const authPlugin = fp(async function (fastify) {
  await fastify.register(jwt, { secret: config.jwt.secret })

  // Same as request.jwtVerify() but never throws — useful for routes that
  // want the actor when present (e.g. the audit middleware) without
  // requiring auth.
  fastify.decorateRequest('tryUser', async function () {
    try {
      await this.jwtVerify()
      return this.user
    } catch {
      return null
    }
  })
})

// ── Routes ──────────────────────────────────────────────────────────────────

export async function registerAuth(fastify) {
  // POST /auth/setup — create the first owner. Refuses if any user exists.
  fastify.post('/setup', async (request, reply) => {
    const parsed = setupSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues })

    const existing = await prisma.user.count()
    if (existing > 0) {
      await recordAudit({
        entity: 'auth',
        action: 'auth.register_failed',
        meta: { email: parsed.data.email, reason: 'already_initialised' },
      })
      return reply.code(409).send({ error: 'already_initialised' })
    }

    const passwordHash = bcrypt.hashSync(parsed.data.password, config.bcryptRounds)
    const user = await prisma.user.create({
      data: { email: parsed.data.email, passwordHash, role: 'owner', name: parsed.data.name },
    })

    await recordAudit({
      entity: 'auth',
      action: 'auth.register_success',
      entityId: user.id,
      entityUuid: user.uuid,
      actor: { id: user.id, role: user.role, name: user.name },
      meta: { email: user.email, role: user.role },
    })

    const token = signToken(fastify, user)
    return reply.send({ token, user: toPublicUser(user) })
  })

  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues })

    const { email, password } = parsed.data
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      await recordAudit({ entity: 'auth', action: 'auth.login_failed', meta: { email, reason: 'unknown_user' } })
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    const ok = bcrypt.compareSync(password, user.passwordHash)
    if (!ok) {
      await recordAudit({ entity: 'auth', action: 'auth.login_failed', meta: { email, reason: 'bad_password' } })
      return reply.code(401).send({ error: 'invalid_credentials' })
    }

    await recordAudit({
      entity: 'auth',
      action: 'auth.login_success',
      entityId: user.id,
      entityUuid: user.uuid,
      actor: { id: user.id, role: user.role, name: user.name },
      meta: { email, role: user.role },
    })

    const token = signToken(fastify, user)
    return reply.send({ token, user: toPublicUser(user) })
  })

  // POST /auth/logout — server-side it's just an audit event; the client
  // discards the token.
  fastify.post('/logout', async (request, reply) => {
    const u = await request.tryUser()
    if (u) {
      await recordAudit({
        entity: 'auth',
        action: 'auth.logout',
        entityId: u.id,
        entityUuid: u.uuid,
        actor: { id: u.id, role: u.role, name: u.name },
        meta: { email: u.email, role: u.role },
      })
    }
    return reply.send({ ok: true })
  })

  // GET /auth/me — used by the SPA to rehydrate after page reload.
  fastify.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    // Re-fetch so a stale token doesn't expose a deleted user.
    const fresh = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!fresh) return reply.code(401).send({ error: 'unauthorized' })
    return reply.send({ user: toPublicUser(fresh) })
  })

  // GET /auth/needs-setup — public, used by the SPA to decide whether to
  // redirect to /setup.
  fastify.get('/needs-setup', async () => {
    const count = await prisma.user.count()
    return { needsSetup: count === 0 }
  })
}

export { ROLES }
