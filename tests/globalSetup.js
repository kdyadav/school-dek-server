// Vitest globalSetup — runs once per `vitest run`, before any worker starts.
// Pushes the Prisma schema at the test database so the suite doesn't depend
// on the user having run `prisma migrate dev` separately.

import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default async function setup() {
  // Prefer .env.test; fall back to .env so a developer who already has a
  // dev database with 'test' in the name doesn't need a separate file.
  loadEnv({ path: path.resolve(__dirname, '../.env.test'), override: true })

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is unset. Copy server/.env.test.example to server/.env.test.')
  }
  if (!/test/i.test(process.env.DATABASE_URL)) {
    throw new Error(
      `Refusing to push schema: DATABASE_URL must point at a database whose name contains 'test'. Got: ${process.env.DATABASE_URL}`
    )
  }

  // db push (rather than `migrate deploy`) keeps the test DB in sync with
  // schema.prisma without needing a committed migration history.
  const cwd = path.resolve(__dirname, '..')
  const result = spawnSync(
    'npx',
    ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
    { cwd, env: process.env, stdio: 'inherit' }
  )
  if (result.status !== 0) {
    throw new Error('prisma db push failed; check that the test database exists and is reachable.')
  }
}
