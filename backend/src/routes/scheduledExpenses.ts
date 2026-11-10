import { Router } from 'express'
import { z } from 'zod'
import { getAuthUser } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import {
  decryptExpenseRow,
  decryptScheduledExpenseRow,
  decryptScheduledExpenseRows,
  encryptExpenseWrite,
  encryptScheduledExpenseWrite,
} from '../lib/financeFields.js'
import { MAX_SKIPPED_DATES } from '../lib/backupSchemas.js'
import { convertToPln, getExchangeRate, isForeignCurrency, type Currency } from '../lib/exchangeRates.js'
import { recordAmountChange, todayIso } from '../lib/scheduledAmountHistory.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const paymentMethodSchema = z.enum(['card', 'cash'])
const currencySchema = z.enum(['PLN', 'USD', 'EUR'])

const createSchema = z.object({
  name: z.string().min(1).max(500),
  /** Amount in the `currency` currency (for PLN this is also the final amount). */
  amount: z.number().positive(),
  currency: currencySchema.default('PLN'),
  category: z.string().max(100),
  dayOfMonth: z.number().min(1).max(31),
  paymentMethod: paymentMethodSchema,
  note: z.string().max(2000).nullable().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  amount: z.number().positive().optional(),
  currency: currencySchema.optional(),
  category: z.string().max(100).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  active: z.boolean().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  pausedUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
  reminderDaysBefore: z.number().int().min(0).max(31).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  /** First payment date that uses the new amount; earlier payments keep the old one. Defaults to today. */
  amountEffectiveFrom: isoDate.optional(),
})

/** Converts an amount entered in a given currency into the pair (amount in PLN, originalAmount). */
async function resolveAmounts(amount: number, currency: Currency): Promise<{ amount: number; originalAmount: number | null; currency: Currency }> {
  if (currency === 'PLN') return { amount, originalAmount: null, currency }
  const pln = await convertToPln(amount, currency)
  return { amount: pln, originalAmount: amount, currency }
}

/** Refreshes PLN amounts for foreign-currency items at the current rate (on GET). */
async function refreshForeignAmounts<
  T extends { id: string; amount: number; currency: string; originalAmount: number | null }
>(items: T[]): Promise<T[]> {
  const foreignCurrencies = Array.from(
    new Set(items.filter((i) => isForeignCurrency(i.currency) && i.originalAmount != null).map((i) => i.currency))
  ) as ('USD' | 'EUR')[]
  if (foreignCurrencies.length === 0) return items

  const rates = await Promise.all(foreignCurrencies.map((c) => getExchangeRate(c)))
  const rateByCode = new Map(foreignCurrencies.map((c, i) => [c, rates[i]]))

  const updates: { id: string; amount: number }[] = []
  const refreshed = items.map((item) => {
    if (!isForeignCurrency(item.currency) || item.originalAmount == null) return item
    const rate = rateByCode.get(item.currency)
    if (!rate) return item
    const freshAmount = Math.round(item.originalAmount * rate * 100) / 100
    if (freshAmount === item.amount) return item
    updates.push({ id: item.id, amount: freshAmount })
    return { ...item, amount: freshAmount }
  })

  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) => prisma.scheduledExpense.update({ where: { id: u.id }, data: { amount: u.amount } }))
    ).catch((e) => console.error('Nie udało się zapisać odświeżonych kwot walutowych:', e))
  }

  return refreshed
}

export const scheduledExpensesRouter = Router()

scheduledExpensesRouter.get('/', async (req, res) => {
  const userId = getAuthUser(req).userId
  const items = await prisma.scheduledExpense.findMany({
    where: { userId },
    orderBy: { dayOfMonth: 'asc' },
  })
  const refreshed = await refreshForeignAmounts(items)
  res.json(decryptScheduledExpenseRows(refreshed))
})

scheduledExpensesRouter.post('/', async (req, res) => {
  const userId = getAuthUser(req).userId
  const data = createSchema.parse(req.body)
  const enc = encryptScheduledExpenseWrite({ name: data.name, note: data.note })
  const resolved = await resolveAmounts(data.amount, data.currency)
  const item = await prisma.scheduledExpense.create({
    data: {
      userId,
      name: enc.name!,
      amount: resolved.amount,
      currency: resolved.currency,
      originalAmount: resolved.originalAmount,
      category: data.category,
      dayOfMonth: data.dayOfMonth,
      paymentMethod: data.paymentMethod,
      note: enc.note ?? null,
    },
  })
  res.status(201).json(decryptScheduledExpenseRow(item))
})

scheduledExpensesRouter.patch('/:id', async (req, res) => {
  const userId = getAuthUser(req).userId
  const { id } = req.params
  const data = updateSchema.parse(req.body)
  const existing = await prisma.scheduledExpense.findFirst({ where: { id, userId } })
  if (!existing) return res.status(404).json({ error: 'Nie znaleziono' })
  const enc = encryptScheduledExpenseWrite({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.note !== undefined ? { note: data.note } : {}),
  })

  let amountUpdate: { amount: number; currency: string; originalAmount: number | null } | null = null
  if (data.amount !== undefined || data.currency !== undefined) {
    const currency = (data.currency ?? existing.currency) as Currency
    const rawAmount = data.amount ?? existing.originalAmount ?? existing.amount
    amountUpdate = await resolveAmounts(rawAmount, currency)
  }

  // A new price applies from a given day on — payments that were already charged keep their amount.
  const amountChanged =
    amountUpdate !== null &&
    (amountUpdate.currency !== existing.currency ||
      (amountUpdate.currency === 'PLN'
        ? amountUpdate.amount !== existing.amount
        : amountUpdate.originalAmount !== existing.originalAmount))
  const amountHistory = amountChanged
    ? recordAmountChange(existing, data.amountEffectiveFrom ?? todayIso())
    : undefined

  const updated = await prisma.scheduledExpense.update({
    where: { id },
    data: {
      ...(enc.name !== undefined ? { name: enc.name } : {}),
      ...(amountUpdate
        ? { amount: amountUpdate.amount, currency: amountUpdate.currency, originalAmount: amountUpdate.originalAmount }
        : {}),
      ...(amountHistory !== undefined ? { amountHistory } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth } : {}),
      ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.pausedUntil !== undefined
        ? { pausedUntil: data.pausedUntil ? new Date(data.pausedUntil) : null }
        : {}),
      ...(data.reminderDaysBefore !== undefined ? { reminderDaysBefore: data.reminderDaysBefore } : {}),
      ...(enc.note !== undefined ? { note: enc.note } : {}),
    },
  })
  res.json(decryptScheduledExpenseRow(updated))
})

const skipOccurrenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** Removes a single payment (occurrence) of a recurring cost — e.g. one that was never actually paid.
 * The cost itself and its other payments stay untouched. */
scheduledExpensesRouter.post('/:id/skip-occurrence', async (req, res) => {
  const userId = getAuthUser(req).userId
  const { id } = req.params
  const { date } = skipOccurrenceSchema.parse(req.body)
  const existing = await prisma.scheduledExpense.findFirst({ where: { id, userId } })
  if (!existing) return res.status(404).json({ error: 'Nie znaleziono' })
  if (existing.skippedDates.includes(date)) return res.json(decryptScheduledExpenseRow(existing))
  if (existing.skippedDates.length >= MAX_SKIPPED_DATES) {
    return res.status(400).json({ error: 'TOO_MANY_SKIPPED_DATES' })
  }
  const updated = await prisma.scheduledExpense.update({
    where: { id },
    data: { skippedDates: { push: date } },
  })
  res.json(decryptScheduledExpenseRow(updated))
})

const editOccurrenceSchema = z.object({
  /** Date of the payment being edited, as generated by the recurring cost. */
  occurrenceDate: isoDate,
  name: z.string().min(1).max(500),
  amount: z.number().positive(),
  category: z.string().max(100),
  date: isoDate,
  paymentMethod: paymentMethodSchema,
  note: z.string().max(2000).nullable().optional(),
})

/** Edits a single payment of a recurring cost: it becomes a regular expense and the recurring cost
 * stops generating that date. The recurring cost's own amount and other payments stay untouched. */
scheduledExpensesRouter.post('/:id/edit-occurrence', async (req, res) => {
  const userId = getAuthUser(req).userId
  const { id } = req.params
  const data = editOccurrenceSchema.parse(req.body)
  const existing = await prisma.scheduledExpense.findFirst({ where: { id, userId } })
  if (!existing) return res.status(404).json({ error: 'Nie znaleziono' })
  const alreadySkipped = existing.skippedDates.includes(data.occurrenceDate)
  if (!alreadySkipped && existing.skippedDates.length >= MAX_SKIPPED_DATES) {
    return res.status(400).json({ error: 'TOO_MANY_SKIPPED_DATES' })
  }
  const enc = encryptExpenseWrite({ name: data.name, note: data.note ?? null })
  const [expense] = await prisma.$transaction([
    prisma.expense.create({
      data: {
        userId,
        name: enc.name!,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
        paymentMethod: data.paymentMethod,
        note: enc.note ?? null,
      },
    }),
    ...(alreadySkipped
      ? []
      : [prisma.scheduledExpense.update({ where: { id }, data: { skippedDates: { push: data.occurrenceDate } } })]),
  ])
  res.status(201).json(decryptExpenseRow(expense))
})

scheduledExpensesRouter.delete('/:id', async (req, res) => {
  const userId = getAuthUser(req).userId
  const { id } = req.params
  const existing = await prisma.scheduledExpense.findFirst({ where: { id, userId } })
  if (!existing) return res.status(204).send()

  // First occurrence: the payment day in the month of creation.
  const created = existing.createdAt
  const lastDayOfCreatedMonth = new Date(created.getFullYear(), created.getMonth() + 1, 0).getDate()
  const firstOccurrence = new Date(
    created.getFullYear(),
    created.getMonth(),
    Math.min(existing.dayOfMonth, lastDayOfCreatedMonth),
    23, 59, 59, 999
  )

  if (firstOccurrence > new Date()) {
    // The cost has not generated any payment yet — safe to hard-delete.
    await prisma.scheduledExpense.delete({ where: { id } })
  } else {
    // Soft delete: past payments stay in history, future ones are no longer generated.
    await prisma.scheduledExpense.update({ where: { id }, data: { endedAt: new Date() } })
  }
  res.status(204).send()
})
