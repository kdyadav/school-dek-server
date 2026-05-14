// Authorisation helpers used by route modules. `request.jwtVerify()` is
// provided by @fastify/jwt; on success it populates `request.user` with the
// decoded token payload (we sign { id, uuid, email, role, name, linkedId }).

export async function requireAuth(request, reply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.code(401).send({ error: 'unauthorized' })
  }
}

/** Build a Fastify preHandler that requires the request user to be in `roles`.
 *  `owner` always passes regardless of `roles`. */
export function requireRole(...roles) {
  const allowed = new Set(roles)
  return async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    const role = request.user?.role
    if (role === 'owner') return
    if (!allowed.has(role)) {
      return reply.code(403).send({ error: 'forbidden', requiredRoles: [...allowed] })
    }
  }
}
