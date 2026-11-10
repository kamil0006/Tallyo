import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mergeExpensesWithScheduled, type MergedExpense, type ScheduledExpenseLike } from '../lib/expensesUtils'
import { useMonth, inMonth, parseDate } from '../context/MonthContext'
import { EXPENSE_CATEGORY_NONE } from '../lib/expenseCategoryConstants'
import type { PaymentMethod } from '../lib/paymentMethod'

export type FilterType = 'all' | 'income' | 'expense'

export interface Transaction {
  id: string
  date: string
  name: string
  category: string
  amount: number
  type: 'income' | 'expense'
  paymentMethod?: PaymentMethod | null
  isScheduled?: boolean
  scheduledId?: string
  currency?: string
  originalAmount?: number | null
  note?: string | null
}

const FALLBACK_MONTH_NAMES = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

/** Today's local date in YYYY-MM-DD format (for string comparisons with transaction dates). */
function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A virtual transaction from a recurring expense should appear only on the payment day, not earlier. */
function excludeFutureScheduled(tx: Transaction[]): Transaction[] {
  const today = todayDateStr()
  return tx.filter((t) => !(t.isScheduled && t.date > today))
}

export interface UseTransactionsListParams {
  effectiveExpenses: {
    id: string
    name: string
    amount: number
    category: string
    date: string
    paymentMethod?: PaymentMethod | null
    note?: string | null
  }[]
  effectiveScheduled: ScheduledExpenseLike[]
  effectiveIncome: {
    id: string
    source: string
    amount: number
    date: string
    recurring: boolean
    category?: string
    paymentMethod?: PaymentMethod | null
    note?: string | null
  }[]
  selectedMonth: number
  selectedYear: number
  loading: boolean
  monthCtx: ReturnType<typeof useMonth>
}

function buildTransactionsForDateRange(
  effectiveExpenses: Parameters<typeof mergeExpensesWithScheduled>[0],
  effectiveScheduled: Parameters<typeof mergeExpensesWithScheduled>[1],
  effectiveIncome: {
    id: string
    source: string
    amount: number
    date: string
    recurring: boolean
    category?: string
    paymentMethod?: PaymentMethod | null
    note?: string | null
  }[],
  from: string,
  to: string
): Transaction[] {
  const fromD = new Date(from + 'T12:00:00')
  const toD = new Date(to + 'T12:00:00')
  const months: { m: number; y: number }[] = []
  const cur = new Date(fromD.getFullYear(), fromD.getMonth(), 1)
  const end = new Date(toD.getFullYear(), toD.getMonth(), 1)
  while (cur <= end) {
    months.push({ m: cur.getMonth(), y: cur.getFullYear() })
    cur.setMonth(cur.getMonth() + 1)
  }
  const merged: MergedExpense[] = []
  for (const { m, y } of months) {
    const monthExp = effectiveExpenses.filter((e) => {
      const { year: ey, month: em } = parseDate(e.date)
      return em === m && ey === y
    })
    merged.push(...mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, y))
  }
  const inRange = (d: string) => d >= from && d <= to
  const mergedInRange = merged.filter((e) => inRange(e.date))
  const monthInc = effectiveIncome.filter((i) => inRange(i.date))

  const expenseTx: Transaction[] = mergedInRange.map((e) => {
    const raw = effectiveExpenses.find((x) => x.id === e.id)
    return {
      id: e.id,
      date: e.date,
      name: e.name,
      category: e.category,
      amount: -e.amount,
      type: 'expense' as const,
      paymentMethod: raw?.paymentMethod ?? e.paymentMethod ?? null,
      isScheduled: e.isScheduled,
      scheduledId: e.scheduledId,
      currency: e.currency,
      originalAmount: e.originalAmount,
      note: raw?.note ?? e.note ?? null,
    }
  })

  const incomeTx: Transaction[] = monthInc.map((i) => ({
    id: i.id,
    date: i.date,
    name: i.source,
    category: i.category ?? EXPENSE_CATEGORY_NONE,
    amount: i.amount,
    type: 'income' as const,
    paymentMethod: i.paymentMethod ?? null,
    note: i.note,
  }))

  return [...excludeFutureScheduled(expenseTx), ...incomeTx].sort((a, b) => b.date.localeCompare(a.date))
}

/** Parsed query: date range and/or drill category come from URL, not duplicated in React state. */
function parseTransactionSearchParams(searchParams: URLSearchParams) {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const catRaw = searchParams.get('category')
  const m = searchParams.get('month')
  const y = searchParams.get('year')
  const category = catRaw ? decodeURIComponent(catRaw) : null

  if (from && to) {
    return {
      dateRange: { from, to } as { from: string; to: string },
      drillCategory: category,
      monthFromUrl: null as { month: number; year: number } | null,
    }
  }
  if (m !== null && y !== null) {
    return {
      dateRange: null,
      drillCategory: category,
      monthFromUrl: { month: Number(m), year: Number(y) },
    }
  }
  return {
    dateRange: null,
    drillCategory: null,
    monthFromUrl: null,
  }
}

export function useTransactionsList(params: UseTransactionsListParams) {
  const {
    effectiveExpenses,
    effectiveScheduled,
    effectiveIncome,
    selectedMonth,
    selectedYear,
    loading,
    monthCtx,
  } = params

  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState<FilterType>('all')
  const wasLoadingRef = useRef(loading)

  const { dateRange, drillCategory, monthFromUrl } = useMemo(
    () => parseTransactionSearchParams(searchParams),
    [searchParams]
  )

  const monthFromUrlKey = monthFromUrl ? `${monthFromUrl.month}-${monthFromUrl.year}` : ''

  useEffect(() => {
    if (!monthCtx || !monthFromUrlKey) return
    const [mStr, yStr] = monthFromUrlKey.split('-')
    monthCtx.setSelectedMonth(Number(mStr))
    monthCtx.setSelectedYear(Number(yStr))
  }, [monthCtx, monthFromUrlKey])

  const transactions = useMemo((): Transaction[] => {
    if (dateRange) {
      return buildTransactionsForDateRange(
        effectiveExpenses,
        effectiveScheduled,
        effectiveIncome,
        dateRange.from,
        dateRange.to
      )
    }
    const monthExp = effectiveExpenses.filter((e) => inMonth(e.date, selectedMonth, selectedYear))
    const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, selectedMonth, selectedYear)
    const monthInc = effectiveIncome.filter((i) => inMonth(i.date, selectedMonth, selectedYear))

    const expenseTx: Transaction[] = merged.map((e) => {
      const raw = effectiveExpenses.find((x) => x.id === e.id)
      return {
        id: e.id,
        date: e.date,
        name: e.name,
        category: e.category,
        amount: -e.amount,
        type: 'expense' as const,
        paymentMethod: raw?.paymentMethod ?? e.paymentMethod ?? null,
        isScheduled: e.isScheduled,
        scheduledId: e.scheduledId,
        currency: e.currency,
        originalAmount: e.originalAmount,
        note: raw?.note ?? e.note ?? null,
      }
    })

    const incomeTx: Transaction[] = monthInc.map((i) => ({
      id: i.id,
      date: i.date,
      name: i.source,
      category: i.category ?? EXPENSE_CATEGORY_NONE,
      amount: i.amount,
      type: 'income' as const,
      paymentMethod: i.paymentMethod ?? null,
      note: i.note,
    }))

    return [...excludeFutureScheduled(expenseTx), ...incomeTx].sort((a, b) => b.date.localeCompare(a.date))
  }, [effectiveExpenses, effectiveScheduled, effectiveIncome, selectedMonth, selectedYear, dateRange])

  const typeFilter: FilterType = drillCategory ? 'expense' : filter

  const filteredTransactions = useMemo(() => {
    let list = transactions
    if (drillCategory) {
      list = list.filter((t) => t.category === drillCategory)
    }
    if (typeFilter === 'income') return list.filter((t) => t.type === 'income')
    if (typeFilter === 'expense') return list.filter((t) => t.type === 'expense')
    return list
  }, [transactions, typeFilter, drillCategory])

  useEffect(() => {
    if (!searchParams.get('category')) setFilter('all')
  }, [selectedMonth, selectedYear, searchParams])

  useEffect(() => {
    if (wasLoadingRef.current && !loading && !searchParams.get('category')) {
      setFilter('all')
    }
    wasLoadingRef.current = loading
  }, [loading, searchParams])

  const clearDrilldown = () => {
    setSearchParams({})
    setFilter('all')
  }

  const periodLabel = dateRange
    ? `${dateRange.from} — ${dateRange.to}`
    : `${(monthCtx?.monthNames ?? FALLBACK_MONTH_NAMES)[selectedMonth]} ${selectedYear}`

  /** Which tab should look selected (drill z URL wymusza „Wydatki”). */
  const tabFilter: FilterType = drillCategory ? 'expense' : filter

  return {
    transactions,
    filteredTransactions,
    filter,
    setFilter,
    tabFilter,
    typeFilter,
    drillCategory,
    dateRange,
    clearDrilldown,
    periodLabel,
  }
}
