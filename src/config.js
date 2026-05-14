// Resolved server configuration. Read environment variables exactly once at
// import time so individual modules don't have to know about process.env.

const required = (name) => {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const optional = (name, fallback) => process.env[name] ?? fallback

const intOr = (name, fallback) => {
  const v = process.env[name]
  if (v == null || v === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`Env ${name} must be a number`)
  return n
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  port: intOr('PORT', 4000),
  host: optional('HOST', '0.0.0.0'),
  corsOrigin: optional('CORS_ORIGIN', '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },
  bcryptRounds: intOr('BCRYPT_ROUNDS', 10),
  storage: {
    driver: optional('STORAGE_DRIVER', 'local'),
    localDir: optional('STORAGE_LOCAL_DIR', './var/uploads'),
    publicBaseUrl: optional('PUBLIC_BASE_URL', `http://localhost:${intOr('PORT', 4000)}`),
  },
}

export default config
