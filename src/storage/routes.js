// File-upload endpoint. Mounted at /files (see app.js) — static serving of
// the produced URLs lives at /uploads via @fastify/static.

import { config } from '../config.js'
import { requireRole } from '../auth/middleware.js'
import { saveLocal, isAllowedImageMime } from './local.js'

export async function registerUploadRoutes(fastify) {
  // Only admins (and owners via requireRole) can upload assets.
  fastify.post('/image', { preHandler: requireRole('admin') }, async (request, reply) => {
    if (config.storage.driver !== 'local') {
      return reply.code(501).send({ error: 'storage_driver_not_implemented', driver: config.storage.driver })
    }

    const part = await request.file()
    if (!part) return reply.code(400).send({ error: 'no_file' })

    if (!isAllowedImageMime(part.mimetype)) {
      return reply.code(415).send({ error: 'unsupported_media_type', mimetype: part.mimetype })
    }

    try {
      const saved = await saveLocal(part)
      return { url: saved.url, absoluteUrl: saved.absoluteUrl, mimetype: saved.mimetype }
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: 'upload_failed', message: err.message })
    }
  })
}
