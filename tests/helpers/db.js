// Database helpers for the test suite. Scope: keep tests isolated by
// truncating every table between cases so order-dependence can't sneak in.

import { prisma } from '../../src/db.js'

// Order doesn't matter when using `TRUNCATE ... CASCADE` with `RESTART
// IDENTITY`. Listing the @@map names from prisma/schema.prisma keeps this
// resilient to model renames.
const TABLES = [
  'audit_logs',
  'school_profile',
  'announcements',
  'salary_payments',
  'payslips',
  'salary_structures',
  'payments',
  'invoices',
  'fee_structures',
  'exam_marks',
  'exams',
  'attendance',
  'timetable',
  'periods',
  'enrollments',
  'users',
  'teachers',
  'students',
  'guardians',
  'subjects',
  'sections',
  'classes',
  'academic_years',
]

export async function resetDatabase() {
  // Single statement so Postgres handles dependency order via CASCADE.
  const list = TABLES.map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

export async function disconnect() {
  await prisma.$disconnect()
}

export { prisma }
