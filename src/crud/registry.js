// Per-table CRUD configuration. Keep this file declarative — actual route
// wiring happens in src/crud/factory.js, which reads this registry.

import {
  academicYearSchema,
  classSchema,
  sectionSchema,
  subjectSchema,
  guardianSchema,
  studentSchema,
  teacherSchema,
  userSchema,
  enrollmentSchema,
  periodSchema,
  timetableEntrySchema,
  attendanceSchema,
  examSchema,
  examMarkSchema,
  feeStructureSchema,
  invoiceSchema,
  paymentSchema,
  announcementSchema,
  salaryStructureSchema,
  payslipSchema,
  salaryPaymentSchema,
} from '../schemas/index.js'

// Map: API table name (matches the previous Dexie table names used by the
// client) -> Prisma delegate name on PrismaClient.
const PRISMA_DELEGATES = {
  academicYears: 'academicYear',
  classes: 'class',
  sections: 'section',
  subjects: 'subject',
  students: 'student',
  guardians: 'guardian',
  teachers: 'teacher',
  users: 'user',
  enrollments: 'enrollment',
  periods: 'period',
  timetable: 'timetableEntry',
  attendance: 'attendance',
  exams: 'exam',
  examMarks: 'examMark',
  feeStructures: 'feeStructure',
  invoices: 'invoice',
  payments: 'payment',
  announcements: 'announcement',
  salaryStructures: 'salaryStructure',
  payslips: 'payslip',
  salaryPayments: 'salaryPayment',
}

const ANY_AUTH = []           // any authenticated user
const ADMIN = ['admin']       // admin (owner always passes via requireRole)
const TEACHERS = ['admin', 'teacher']

// JSON columns must be passed through to Prisma as-is; non-JSON columns
// shouldn't accidentally accept arbitrary objects from the client. The
// factory uses this list to know which fields to keep when serialising
// patches into Prisma `data`.
const JSON_FIELDS = {
  exams: ['subjects'],
  feeStructures: ['items'],
  invoices: ['items'],
  salaryStructures: ['components'],
  payslips: ['components'],
}

// Fields the server will accept in `?where[field]=value` filters. Anything
// else returns 400. Restricting this avoids accidentally letting clients
// filter on non-indexed columns.
const WHERE_FIELDS = {
  academicYears: ['isActive', 'name'],
  classes: ['academicYearId'],
  sections: ['classId', 'classTeacherId'],
  subjects: ['code'],
  students: ['admissionNo', 'currentSectionId', 'guardianId'],
  guardians: ['phone', 'email'],
  teachers: ['employeeNo', 'email'],
  users: ['email', 'role', 'linkedId'],
  enrollments: ['studentId', 'sectionId', 'academicYearId'],
  periods: [],
  timetable: ['sectionId', 'teacherId', 'subjectId', 'dayOfWeek', 'periodId'],
  attendance: ['sectionId', 'studentId', 'date', 'status'],
  exams: ['academicYearId', 'classId'],
  examMarks: ['examId', 'studentId', 'subjectId'],
  feeStructures: ['classId', 'academicYearId'],
  invoices: ['studentId', 'academicYearId', 'status'],
  payments: ['invoiceId'],
  announcements: ['audience', 'createdBy'],
  salaryStructures: ['teacherId'],
  payslips: ['teacherId', 'month', 'status'],
  salaryPayments: ['payslipId'],
}

export const REGISTRY = {
  academicYears:    { schema: academicYearSchema,    redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  classes:          { schema: classSchema,           redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  sections:         { schema: sectionSchema,         redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  subjects:         { schema: subjectSchema,         redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  students:         { schema: studentSchema,         redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  guardians:        { schema: guardianSchema,        redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  teachers:         { schema: teacherSchema,         redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  users:            { schema: userSchema,            redact: ['passwordHash'],  roles: { read: ADMIN,    write: ADMIN } },
  enrollments:      { schema: enrollmentSchema,      redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  periods:          { schema: periodSchema,          redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  timetable:        { schema: timetableEntrySchema,  redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  attendance:       { schema: attendanceSchema,      redact: [],                roles: { read: ANY_AUTH, write: TEACHERS } },
  exams:            { schema: examSchema,            redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  examMarks:        { schema: examMarkSchema,        redact: [],                roles: { read: ANY_AUTH, write: TEACHERS } },
  feeStructures:    { schema: feeStructureSchema,    redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  invoices:         { schema: invoiceSchema,         redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  payments:         { schema: paymentSchema,         redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  announcements:    { schema: announcementSchema,    redact: [],                roles: { read: ANY_AUTH, write: TEACHERS } },
  salaryStructures: { schema: salaryStructureSchema, redact: [],                roles: { read: ADMIN,    write: ADMIN } },
  payslips:         { schema: payslipSchema,         redact: [],                roles: { read: ANY_AUTH, write: ADMIN } },
  salaryPayments:   { schema: salaryPaymentSchema,   redact: [],                roles: { read: ADMIN,    write: ADMIN } },
}

export const TABLES = Object.keys(REGISTRY)

export function delegateFor(table) {
  return PRISMA_DELEGATES[table]
}

export function jsonFieldsFor(table) {
  return JSON_FIELDS[table] || []
}

export function allowedWhereFor(table) {
  return WHERE_FIELDS[table] || []
}
