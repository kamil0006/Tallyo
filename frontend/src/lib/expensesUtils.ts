import type { PaymentMethod } from './paymentMethod'
import type { Currency } from './currency'
import { amountAt, type AmountHistoryEntry } from './scheduledAmountHistory'

export interface ExpenseLike {
  id: string
  name: string
  amount: number
  category: string
  date: string
  paymentMethod?: PaymentMethod | null
  note?: string | null
}

export interface ScheduledExpenseLike {
  id: string
  name: string
  amount: number
  currency?: Currency
  originalAmount?: number | null
  /** Earlier amounts — payments before a price change keep what was charged. */
  amountHistory?: AmountHistoryEntry[] | null
  category: string
  dayOfMonth: number
  active: boolean
  paymentMethod?: PaymentMethod | null
  pausedUntil?: string | null
  note?: string | null
  /** End date (soft delete) — payments after this date are not generated; earlier ones remain. */
  endedAt?: string | null
  /** Payment dates (YYYY-MM-DD) removed by the user — not generated as payments. */
  skippedDates?: string[]
  /** When the recurring expense was added — not shown in months before this date. */
  createdAt?: string | Date
}

export interface MergedExpense extends ExpenseLike {
  isScheduled?: boolean
  scheduledId?: string
  currency?: string
  originalAmount?: number | null
}

/** Is the recurring cost ended (soft-deleted) before the given occurrence date (YYYY-MM-DD)? */
function isEndedBefore(s: ScheduledExpenseLike, date: string): boolean {
  if (!s.endedAt) return false
  return date > s.endedAt.slice(0, 10)
}

/** Was this single payment removed by the user? */
function isSkipped(s: ScheduledExpenseLike, date: string): boolean {
  return s.skippedDates?.includes(date) ?? false
}

/** Merges expenses with scheduled ones – generates virtual expenses for a given month.
 * Skips expenses that overlap with scheduled ones (same name, same day of month).
 * Ended recurring costs (endedAt) generate occurrences only up to their end date.
 * Payments removed by the user (skippedDates) are not generated. */
export function mergeExpensesWithScheduled<E extends ExpenseLike, S extends ScheduledExpenseLike>(
  expenses: E[],
  scheduled: S[],
  month: number,
  year: number
): MergedExpense[] {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  const real: MergedExpense[] = expenses
    .filter((e) => {
      const day = parseInt(e.date.split('-')[2], 10)
      const nameLower = e.name.toLowerCase()
      const matchingScheduled = scheduled.find(
        (s) =>
          s.active &&
          s.name.toLowerCase() === nameLower &&
          s.dayOfMonth === day &&
          !isEndedBefore(s, e.date) &&
          !isSkipped(s, e.date)
      )
      return !matchingScheduled
    })
    .map((e) => ({
      ...e,
      isScheduled: false,
    }))

  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)

  const virtual: MergedExpense[] = scheduled
    .filter((s) => {
      if (!s.active) return false
      if (!s.createdAt) return true
      const created = new Date(s.createdAt)
      return isNaN(created.getTime()) || created <= monthEnd
    })
    .reduce<MergedExpense[]>((acc, s) => {
      const day = Math.min(s.dayOfMonth, lastDay)
      const date = `${year}-${pad(month + 1)}-${pad(day)}`
      if (s.pausedUntil && s.pausedUntil >= date) return acc
      if (isEndedBefore(s, date)) return acc
      if (isSkipped(s, date)) return acc
      const charged = amountAt(s, date)
      acc.push({
        id: `scheduled-${s.id}-${date}`,
        name: s.name,
        amount: charged.amount,
        currency: charged.currency,
        originalAmount: charged.originalAmount ?? null,
        category: s.category,
        date,
        paymentMethod: s.paymentMethod ?? null,
        note: s.note ?? null,
        isScheduled: true,
        scheduledId: s.id,
      })
      return acc
    }, [])

  return [...real, ...virtual].sort((a, b) => a.date.localeCompare(b.date))
}
