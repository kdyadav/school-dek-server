// Local-disk implementation of the upload backend. The S3 driver mentioned
// in .env.example is intentionally not implemented yet — only `local` is
// supported in this phase.

import fs from 'node:fs'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'

import { config } from '../config.js'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'])

const extFor = (mimetype, fallback = 'bin') => {
  switch (mimetype) {
    case 'image/png': return 'png'
    case 'image/jpeg': return 'jpg'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
    case 'image/svg+xml': return 'svg'
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon': return 'ico'
    default: return fallback
  }
}

export function isAllowedImageMime(mimetype) {
  return ALLOWED_MIME.has(mimetype)
}

/**
 * Persist a Multipart file part to disk. Returns the public URL the client
 * should use to load it back, plus the absolute on-disk path.
 */
export async function saveLocal(filePart) {
  const dir = path.resolve(config.storage.localDir)
  fs.mkdirSync(dir, { recursive: true })

  const ext = extFor(filePart.mimetype)
  const filename = `${uuidv4()}.${ext}`
  const absPath = path.join(dir, filename)

  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(absPath)
    filePart.file.pipe(ws)
    ws.on('finish', resolve)
    ws.on('error', reject)
    filePart.file.on('error', reject)
  })

  if (filePart.file.truncated) {
    fs.unlinkSync(absPath)
    const err = new Error('file too large')
    err.statusCode = 413
    throw err
  }

  return {
    url: `/uploads/${filename}`,
    absoluteUrl: `${config.storage.publicBaseUrl.replace(/\/$/, '')}/uploads/${filename}`,
    path: absPath,
    mimetype: filePart.mimetype,
    filename,
  }
}
