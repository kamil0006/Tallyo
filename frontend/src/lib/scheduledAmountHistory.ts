import type { Currency } from './currency'

/** Same limit as the backend. */
export const MAX_AMOUNT_HISTORY = 120

/** An earlier amount of a recurring cost — payments on or before `until` were charged this amount. */
export interface AmountHistoryEntry {
  until: string
  /** Amount in PLN. */
  amount: number
  currency?: Currency
  originalAmount?: number | null
}

interface WithAmounts {
  amount: number
  currency?: Currency
  originalAmount?: number | null
  amountHistory?: AmountHistoryEntry[] | null
}

type AmountSnapshot = Omit<AmountHistoryEntry, 'until'>

function sortedHistory(s: WithAmounts): AmountHistoryEntry[] {
  return Array.isArray(s.amountHistory) ? [...s.amountHistory].sort((a, b) => a.until.localeCompare(b.until)) : []
}

/** Amount that was in force for a payment on `date` (YYYY-MM-DD). */
export function amountAt(s: WithAmounts, date: string): AmountSnapshot {
  const entry = sortedHistory(s).find((e) => e.until >= date)
  if (entry) {
    return { amount: entry.amount, currency: entry.currency ?? 'PLN', originalAmount: entry.originalAmount ?? null }
  }
  return { amount: s.amount, currency: s.currency ?? 'PLN', originalAmount: s.originalAmount ?? null }
}

export function dayBefore(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** History after the amount changes from `effectiveFrom` on — payments before that day keep what they were charged. */
export function recordAmountChange(s: WithAmounts, effectiveFrom: string): AmountHistoryEntry[] {
  const until = dayBefore(effectiveFrom)
  const previous = amountAt(s, until)
  const kept = sortedHistory(s).filter((e) => e.until < until)
  return [...kept, { until, ...previous }].slice(-MAX_AMOUNT_HISTORY)
}

export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
