// Build the Fastify app. Kept separate from src/index.js so tests can call
// buildApp() and use fastify.inject() without binding a real port.

import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import qs from 'qs'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { config } from './config.js'
import { registerAuth, authPlugin } from './auth/routes.js'
import { registerCrud } from './crud/routes.js'
import { registerAuditRoutes } from './audit/routes.js'
import { registerUploadRoutes } from './storage/routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger ?? { level: process.env.LOG_LEVEL || 'info' },
    bodyLimit: 8 * 1024 * 1024, // 8 MB; covers JSON payloads incl. small inline images
    // qs handles the ?where[field]=value bracket syntax that Node's default
    // querystring parser leaves flat. depth=5 is generous; arrayLimit prevents
    // sparse-array DoS via ?x[9999]=… payloads.
    routerOptions: {
      querystringParser: (str) => qs.parse(str, { depth: 5, arrayLimit: 100 }),
    },
  })

  await app.register(cors, {
    origin: config.corsOrigin.includes('*') ? true : config.corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
  await app.register(multipart, {
    limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB cap on uploaded images
  })

  // Static serving for locally-stored uploads (dev / single-host prod).
  if (config.storage.driver === 'local') {
    const root = path.resolve(config.storage.localDir)
    fs.mkdirSync(root, { recursive: true })
    await app.register(fastifyStatic, {
      root,
      prefix: '/uploads/',
      decorateReply: false,
    })
  }

  // JWT verifier + request.user decoration (no route-level enforcement here).
  await app.register(authPlugin)

  app.get('/health', async () => ({ ok: true }))

  await app.register(registerAuth, { prefix: '/auth' })
  await app.register(registerAuditRoutes, { prefix: '/audit-logs' })
  // Mounted at /files (the /uploads prefix is reserved for serving static
  // files written by these routes).
  await app.register(registerUploadRoutes, { prefix: '/files' })
  await registerCrud(app)

  return app
}

export default buildApp
