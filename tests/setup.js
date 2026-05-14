// Per-process test setup. Loads .env.test if present so the suite hits a
// throwaway database, never the dev/prod one. Also resets every table
// before each test to keep cases independent.
import 'dotenv/config'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, afterAll } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.resolve(__dirname, '../.env.test'), override: true })

if (!process.env.DATABASE_URL?.includes('test')) {
  // Hard guard against running the suite against the dev DB.
  throw new Error(
    `Refusing to run tests: DATABASE_URL must point at a database whose name contains 'test'. Got: ${process.env.DATABASE_URL || '(unset)'}`
  )
}

// Lazy import so the env-var guard above runs first.
const { resetDatabase, disconnect } = await import('./helpers/db.js')

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnect()
})
