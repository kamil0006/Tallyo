import { z } from 'zod'

/** How many earlier amounts a recurring cost keeps (10 years of monthly changes). */
export const MAX_AMOUNT_HISTORY = 120

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const amountHistoryEntrySchema = z.object({
  /** Last payment date (inclusive) that used this amount. */
  until: isoDate,
  /** Amount in PLN. */
  amount: z.number(),
  currency: z.enum(['PLN', 'USD', 'EUR']).default('PLN'),
  originalAmount: z.number().nullable().default(null),
})

export const amountHistorySchema = z.array(amountHistoryEntrySchema).max(MAX_AMOUNT_HISTORY)

export type AmountHistoryEntry = z.infer<typeof amountHistoryEntrySchema>

type AmountSnapshot = Omit<AmountHistoryEntry, 'until'>

interface WithAmounts {
  amount: number
  currency: string
  originalAmount: number | null
  amountHistory: unknown
}

/** Reads the stored history; anything malformed is treated as no history. */
export function parseAmountHistory(value: unknown): AmountHistoryEntry[] {
  const parsed = amountHistorySchema.safeParse(value)
  return parsed.success ? [...parsed.data].sort((a, b) => a.until.localeCompare(b.until)) : []
}

/** Amount that was in force for a payment on `date`. */
export function amountAt(s: WithAmounts, date: string): AmountSnapshot {
  const entry = parseAmountHistory(s.amountHistory).find((e) => e.until >= date)
  if (entry) return { amount: entry.amount, currency: entry.currency, originalAmount: entry.originalAmount }
  return {
    amount: s.amount,
    currency: s.currency as AmountSnapshot['currency'],
    originalAmount: s.originalAmount,
  }
}

export function dayBefore(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d - 1))
  return date.toISOString().slice(0, 10)
}

/** History after the amount changes from `effectiveFrom` on: payments before that day keep what they were charged. */
export function recordAmountChange(s: WithAmounts, effectiveFrom: string): AmountHistoryEntry[] {
  const until = dayBefore(effectiveFrom)
  const previous = amountAt(s, until)
  const kept = parseAmountHistory(s.amountHistory).filter((e) => e.until < until)
  return [...kept, { until, ...previous }].slice(-MAX_AMOUNT_HISTORY)
}

export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
