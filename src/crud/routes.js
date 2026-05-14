// Mounts every entry of the CRUD registry plus the singleton schoolProfile
// routes. Called once from src/app.js.

import { REGISTRY } from './registry.js'
import { registerCrudRoutes } from './factory.js'
import { registerSchoolProfileRoutes } from './schoolProfile.js'

export async function registerCrud(fastify) {
  for (const [table, entry] of Object.entries(REGISTRY)) {
    registerCrudRoutes(fastify, table, entry)
  }
  await registerSchoolProfileRoutes(fastify)
}
