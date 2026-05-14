// Single PrismaClient for the process. Importing this from anywhere returns
// the same instance, which is what Prisma recommends.

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export default prisma
