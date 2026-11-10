import { z } from 'zod'
import { amountHistorySchema } from './scheduledAmountHistory.js'

/** Validates data uploaded during backup restore — permissive about free text,
 * but strict about the types and fields that drive app logic (enums, IDs). */

const id = z.string().min(1).max(64)
const dateVal = z.coerce.date()
const nullableDate = z.coerce.date().nullable()
const paymentMethod = z.enum(['card', 'cash']).nullable().optional()

/** Upper bound for skipped payments of one recurring cost (about 50 years of monthly payments). */
export const MAX_SKIPPED_DATES = 600

export const expenseCategoryBackupSchema = z.object({
  id,
  name: z.string().min(1).max(50),
  color: z.string().max(20),
  createdAt: dateVal,
})

export const expenseBackupSchema = z.object({
  id,
  name: z.string().min(1).max(500),
  amount: z.number(),
  category: z.string().max(100),
  date: dateVal,
  paymentMethod,
  note: z.string().max(2000).nullable().optional(),
  createdAt: dateVal,
})

export const scheduledExpenseBackupSchema = z.object({
  id,
  name: z.string().min(1).max(500),
  amount: z.number(),
  currency: z.enum(['PLN', 'USD', 'EUR']).default('PLN'),
  originalAmount: z.number().nullable().optional(),
  category: z.string().max(100),
  dayOfMonth: z.number().int().min(1).max(31),
  active: z.boolean(),
  paymentMethod,
  pausedUntil: nullableDate.optional(),
  reminderDaysBefore: z.number().int().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  /** Soft-delete marker — without it, restored backups would revive deleted recurring costs. */
  endedAt: nullableDate.optional(),
  /** Payments removed by the user — without it, restored backups would revive them. */
  skippedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(MAX_SKIPPED_DATES).optional(),
  /** Earlier amounts — without it, restored backups would rewrite past payments with the current price. */
  amountHistory: amountHistorySchema.optional(),
  createdAt: dateVal,
})

export const incomeBackupSchema = z.object({
  id,
  source: z.string().min(1).max(500),
  amount: z.number(),
  date: dateVal,
  recurring: z.boolean(),
  category: z.string().max(100),
  paymentMethod,
  note: z.string().max(2000).nullable().optional(),
  createdAt: dateVal,
})

export const netWorthAccountBackupSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  kind: z.enum(['asset', 'liability']),
  balance: z.number(),
  iconKey: z.string().max(48).nullable().optional(),
  accentKey: z.enum(['cyan', 'green', 'magenta', 'amber', 'rose', 'violet']).nullable().optional(),
  createdAt: dateVal,
  updatedAt: dateVal,
})

export const netWorthAdjustmentBackupSchema = z.object({
  id,
  accountId: id,
  amount: z.number(),
  description: z.string().max(200).nullable().optional(),
  createdAt: dateVal,
})

export const todoBackupSchema = z.object({
  id,
  text: z.string().min(1).max(2000),
  done: z.boolean(),
  createdAt: dateVal,
  dueDate: nullableDate.optional(),
  dueTime: z.string().max(10).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  category: z.string().max(48),
  archivedAt: nullableDate.optional(),
  noteId: z.string().max(64).nullable().optional(),
  linkedEventId: z.string().max(64).nullable().optional(),
})

export const eventBackupSchema = z.object({
  id,
  title: z.string().min(1).max(300),
  date: dateVal,
  time: z.string().max(10).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  linkedTodoId: z.string().max(64).nullable().optional(),
  createdAt: dateVal,
})

export const habitBackupSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  category: z.string().max(48).nullable().optional(),
  color: z.string().max(16).nullable().optional(),
  scheduleType: z.enum(['daily', 'weekdays', 'weekly', 'monthly']),
  scheduleDays: z.array(z.number().int().min(0).max(6)),
  weeklyTarget: z.number().int().nullable().optional(),
  monthlyTarget: z.number().int().nullable().optional(),
  unit: z.string().max(32).nullable().optional(),
  targetPerDay: z.number().nullable().optional(),
  createdAt: dateVal,
  archivedAt: nullableDate.optional(),
})

export const habitCheckInBackupSchema = z.object({
  id,
  habitId: id,
  date: dateVal,
  status: z.enum(['done', 'missed', 'skipped']),
  value: z.number().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  createdAt: dateVal,
})

export const goalBackupSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  target: z.number(),
  current: z.number(),
  unit: z.string().max(50).nullable().optional(),
  createdAt: dateVal,
})

export const noteBackupSchema = z.object({
  id,
  type: z.enum(['inbox', 'idea', 'reference']),
  content: z.string().max(50_000),
  tags: z.array(z.string().max(64)).max(64),
  title: z.string().max(500).nullable().optional(),
  pinned: z.boolean(),
  archivedAt: nullableDate.optional(),
  ideaStatus: z.enum(['nowy', 'do_sprawdzenia', 'w_realizacji', 'zrobiony', 'odrzucony']),
  referenceKind: z.enum(['link', 'ksiazka', 'artykul', 'wideo', 'cytat', 'inne']),
  referenceUrl: z.string().max(2048).nullable().optional(),
  referenceSource: z.string().max(500).nullable().optional(),
  createdAt: dateVal,
  updatedAt: dateVal,
})

export const learningSessionBackupSchema = z.object({
  id,
  date: z.string().max(32),
  minutes: z.number().int().min(0),
  topic: z.string().min(1).max(300),
  type: z.enum(['kurs', 'ksiazka', 'projekt', 'praktyka', 'powtorka', 'inne']),
  category: z.string().max(100).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  courseId: z.string().max(64).nullable().optional(),
  projectId: z.string().max(64).nullable().optional(),
  bookId: z.string().max(64).nullable().optional(),
  createdAt: dateVal,
})

export const courseBackupSchema = z.object({
  id,
  name: z.string().min(1).max(300),
  platform: z.string().max(200).nullable().optional(),
  platformUrl: z.string().max(2000).nullable().optional(),
  progress: z.number().int().min(0).max(100),
  status: z.enum(['w_trakcie', 'ukonczony', 'zaplanowany']),
  startedAt: z.string().max(32).nullable().optional(),
  completedAt: z.string().max(32).nullable().optional(),
  nextLesson: z.string().max(500).nullable().optional(),
  createdAt: dateVal,
})

export const projectBackupSchema = z.object({
  id,
  name: z.string().min(1).max(300),
  description: z.string().max(5000).nullable().optional(),
  tech: z.string().max(500).nullable().optional(),
  status: z.enum(['pomysl', 'w_trakcie', 'mvp', 'ukonczony', 'porzucony']),
  url: z.string().max(2000).nullable().optional(),
  githubUrl: z.string().max(2000).nullable().optional(),
  nextStep: z.string().max(500).nullable().optional(),
  priority: z.enum(['niski', 'sredni', 'wysoki']).nullable().optional(),
  createdAt: dateVal,
})

export const bookBackupSchema = z.object({
  id,
  title: z.string().min(1).max(300),
  author: z.string().max(200).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(['chce_przeczytac', 'czytam', 'przeczytane']),
  finishedAt: z.string().max(32).nullable().optional(),
  startedAt: z.string().max(32).nullable().optional(),
  rating: z.number().int().min(0).max(5).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  keyTakeaway: z.string().max(2000).nullable().optional(),
  createdAt: dateVal,
})

export const certificationBackupSchema = z.object({
  id,
  name: z.string().min(1).max(300),
  issuer: z.string().min(1).max(200),
  date: z.string().max(32),
  url: z.string().max(2000).nullable().optional(),
  expiryDate: z.string().max(32).nullable().optional(),
  verificationUrl: z.string().max(2000).nullable().optional(),
  renewalReminderDays: z.number().int().nullable().optional(),
  createdAt: dateVal,
})

export const learningSettingsBackupSchema = z.object({
  weeklyGoalMinutes: z.number().int().min(1),
  sessionCategories: z.array(z.string().max(100)).max(100),
  bookCategories: z.array(z.string().max(100)).max(100),
})

export const backupDataSchema = z.object({
  expenseCategories: z.array(expenseCategoryBackupSchema).max(2000),
  expenses: z.array(expenseBackupSchema).max(50_000),
  scheduledExpenses: z.array(scheduledExpenseBackupSchema).max(2000),
  income: z.array(incomeBackupSchema).max(20_000),
  netWorthAccounts: z.array(netWorthAccountBackupSchema).max(2000),
  netWorthAdjustments: z.array(netWorthAdjustmentBackupSchema).max(20_000),
  todos: z.array(todoBackupSchema).max(50_000),
  events: z.array(eventBackupSchema).max(50_000),
  habits: z.array(habitBackupSchema).max(2000),
  habitCheckIns: z.array(habitCheckInBackupSchema).max(200_000),
  goals: z.array(goalBackupSchema).max(2000),
  notes: z.array(noteBackupSchema).max(50_000),
  learningSessions: z.array(learningSessionBackupSchema).max(50_000),
  courses: z.array(courseBackupSchema).max(2000),
  projects: z.array(projectBackupSchema).max(2000),
  books: z.array(bookBackupSchema).max(20_000),
  certifications: z.array(certificationBackupSchema).max(2000),
  learningSettings: learningSettingsBackupSchema.nullable(),
})

export const backupFileSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  data: backupDataSchema,
})

export type BackupFile = z.infer<typeof backupFileSchema>
