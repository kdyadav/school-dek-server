// Upload route exercises @fastify/multipart + the local-disk storage
// driver. Build the multipart body by hand so we can keep this test
// dependency-free.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildTestApp, setupOwner, createUserAndToken, authHeaders } from './helpers/app.js'

let app
let ownerToken
beforeEach(async () => {
  app = await buildTestApp()
  ownerToken = (await setupOwner(app)).token
})
afterEach(async () => {
  await app?.close()
  // Wipe the per-test upload dir so successive runs don't accumulate junk.
  const dir = path.resolve(process.env.STORAGE_LOCAL_DIR || './var/uploads-test')
  fs.rmSync(dir, { recursive: true, force: true })
})

const BOUNDARY = '----skooldesktest'

function multipartImage({ filename = 'pixel.png', mimetype = 'image/png', bytes }) {
  // Minimum-viable multipart/form-data body with one `file` part. Built as
  // a Buffer so the binary image bytes round-trip cleanly.
  const head = Buffer.from(
    `--${BOUNDARY}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimetype}\r\n\r\n`,
    'utf8'
  )
  const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`, 'utf8')
  return Buffer.concat([head, bytes, tail])
}

const headers = (token) => ({
  ...authHeaders(token),
  'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
})

// 1×1 transparent PNG.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

describe('POST /files/image', () => {
  it('accepts a PNG and returns a /uploads URL pointing at the saved file', async () => {
    const res = await app.inject({
      method: 'POST', url: '/files/image',
      headers: headers(ownerToken),
      payload: multipartImage({ bytes: ONE_PIXEL_PNG }),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/)
    expect(body.mimetype).toBe('image/png')

    // The static handler should now serve the same bytes back.
    const fetched = await app.inject({ method: 'GET', url: body.url })
    expect(fetched.statusCode).toBe(200)
    expect(fetched.rawPayload.length).toBe(ONE_PIXEL_PNG.length)
  })

  it('rejects unsupported mime types with 415', async () => {
    const res = await app.inject({
      method: 'POST', url: '/files/image',
      headers: headers(ownerToken),
      payload: multipartImage({
        filename: 'evil.exe', mimetype: 'application/octet-stream',
        bytes: Buffer.from([0x4d, 0x5a]),
      }),
    })
    expect(res.statusCode).toBe(415)
  })

  it('forbids non-admin uploaders', async () => {
    const { token: teacherToken } = await createUserAndToken(app, {
      email: 't@x.test', role: 'teacher',
    })
    const res = await app.inject({
      method: 'POST', url: '/files/image',
      headers: headers(teacherToken),
      payload: multipartImage({ bytes: ONE_PIXEL_PNG }),
    })
    expect(res.statusCode).toBe(403)
  })

  it('401s without a bearer token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/files/image',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipartImage({ bytes: ONE_PIXEL_PNG }),
    })
    expect(res.statusCode).toBe(401)
  })
})
