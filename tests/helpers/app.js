// App + auth helpers shared by every test file. Keeps each test focused on
// the assertion rather than the boilerplate of registering Fastify and
// minting a JWT.

import { buildApp } from '../../src/app.js'
import { prisma } from '../../src/db.js'
import bcrypt from 'bcryptjs'

export async function buildTestApp() {
  // logger:false silences pino in tests; ready() ensures plugins (jwt,
  // multipart, static) are registered before the first inject().
  const app = await buildApp({ logger: false })
  await app.ready()
  return app
}

const DEFAULT_OWNER = {
  name: 'Test Owner',
  email: 'owner@test.local',
  password: 'owner-password-1',
}

/** Hit /auth/setup to create the first owner. Returns { app, token, user }. */
export async function setupOwner(app, overrides = {}) {
  const body = { ...DEFAULT_OWNER, ...overrides }
  const res = await app.inject({ method: 'POST', url: '/auth/setup', payload: body })
  if (res.statusCode !== 200) {
    throw new Error(`setupOwner failed: ${res.statusCode} ${res.body}`)
  }
  const json = res.json()
  return { token: json.token, user: json.user }
}

/** Insert a user directly (bypasses /auth/setup which only allows the first
 *  user). Returns a signed JWT plus the public user shape. */
export async function createUserAndToken(app, { email, role, name = null, password = 'pw-1234567' }) {
  const passwordHash = bcrypt.hashSync(password, 4)
  const user = await prisma.user.create({
    data: { email, passwordHash, role, name: name ?? email.split('@')[0] },
  })
  const publicUser = {
    id: user.id,
    uuid: user.uuid,
    email: user.email,
    role: user.role,
    name: user.name,
    linkedId: user.linkedId,
  }
  const token = app.jwt.sign(publicUser, { expiresIn: '1h' })
  return { token, user: publicUser }
}

/** Convenience: returns headers with the bearer token set. */
export function authHeaders(token, extra = {}) {
  return { authorization: `Bearer ${token}`, ...extra }
}
