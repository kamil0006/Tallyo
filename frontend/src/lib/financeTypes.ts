import type { PaymentMethod } from './paymentMethod'
import type { Currency } from './currency'
import type { AmountHistoryEntry } from './scheduledAmountHistory'

export type ExpenseRow = {
  id: string
  name: string
  amount: number
  category: string
  date: string
  paymentMethod?: PaymentMethod | null
  note?: string | null
}
export type IncomeRow = {
  id: string
  source: string
  amount: number
  date: string
  recurring: boolean
  category?: string
  paymentMethod?: PaymentMethod | null
  note?: string | null
}
export type ScheduledExpenseRow = {
  id: string
  name: string
  /** Always in PLN — converted at the current rate when currency != PLN. */
  amount: number
  currency?: Currency
  /** Amount in the `currency` currency when currency != PLN. */
  originalAmount?: number | null
  category: string
  dayOfMonth: number
  active: boolean
  paymentMethod?: PaymentMethod | null
  pausedUntil?: string | null
  reminderDaysBefore?: number | null
  note?: string | null
  /** End date (soft delete) — payments after this date are not generated. */
  endedAt?: string | null
  /** Payment dates (YYYY-MM-DD) removed by the user — not generated as payments. */
  skippedDates?: string[]
  /** Earlier amounts — payments before a price change keep what was charged. */
  amountHistory?: AmountHistoryEntry[] | null
  createdAt?: string
}
