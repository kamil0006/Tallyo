import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PaymentMethod } from '../lib/paymentMethod'
import { isPaymentMethod } from '../lib/paymentMethod'
import type { Currency } from '../lib/currency'

export interface DemoExpense {
  id: string
  name: string
  amount: number
  category: string
  date: string
  paymentMethod?: PaymentMethod
  note?: string | null
}

export interface DemoIncome {
  id: string
  source: string
  amount: number
  date: string
  recurring: boolean
  /** Same as Expense.category — shared finance categories */
  category: string
  paymentMethod?: PaymentMethod
  note?: string | null
}

export interface DemoScheduledExpense {
  id: string
  name: string
  /** Always in PLN — converted at the rate from the time of saving (demo mode does not auto-refresh rates). */
  amount: number
  currency?: Currency
  originalAmount?: number | null
  category: string
  dayOfMonth: number
  active: boolean
  paymentMethod?: PaymentMethod
  pausedUntil?: string | null
  reminderDaysBefore?: number | null
  note?: string | null
  /** End date (soft delete) — payments after this date are not generated. */
  endedAt?: string | null
  /** Payment dates (YYYY-MM-DD) removed by the user — not generated as payments. */
  skippedDates?: string[]
  /** When the recurring expense was added — not shown in months before this date. */
  createdAt?: string
}

export interface DemoNetWorth {
  cash: number
  bankAccount: number
  assets: number
}

export type NetWorthPositionKey = keyof DemoNetWorth

interface DemoDataContextType {
  expenses: DemoExpense[]
  income: DemoIncome[]
  scheduledExpenses: DemoScheduledExpense[]
  netWorth: DemoNetWorth
  addExpense: (e: Omit<DemoExpense, 'id'>) => void
  updateExpense: (id: string, updates: Partial<Omit<DemoExpense, 'id'>>) => void
  restoreExpense: (e: DemoExpense) => void
  deleteExpense: (id: string) => void
  addIncome: (i: Omit<DemoIncome, 'id'>) => void
  updateIncome: (id: string, updates: Partial<Omit<DemoIncome, 'id'>>) => void
  restoreIncome: (i: DemoIncome) => void
  deleteIncome: (id: string) => void
  addScheduledExpense: (e: Omit<DemoScheduledExpense, 'id'>) => void
  updateScheduledExpense: (id: string, e: Partial<DemoScheduledExpense>) => void
  deleteScheduledExpense: (id: string) => void
  skipScheduledOccurrence: (id: string, date: string) => void
  updateNetWorthPosition: (key: NetWorthPositionKey, delta: number) => void
}

const DemoDataContext = createContext<DemoDataContextType | null>(null)

function getDemoData(year: number) {
  const y = year.toString()
  const pad = (m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // One-off expenses only – Czynsz, Netflix, Spotify and Prąd live in recurring costs (scheduled)
  const expenses: DemoExpense[] = [
    { id: '1', name: 'Biedronka', amount: 85.5, category: 'Jedzenie', date: pad(3, 4) },
    { id: '2', name: 'Paliwo', amount: 200, category: 'Transport', date: pad(3, 3) },
    { id: '3', name: 'Kino', amount: 80, category: 'Rozrywka', date: pad(3, 15) },
    { id: '4', name: 'Restauracja', amount: 120, category: 'Jedzenie', date: pad(3, 8) },
    { id: '5', name: 'Lidl', amount: 95, category: 'Jedzenie', date: pad(3, 18) },
    { id: '6', name: 'Uber', amount: 35, category: 'Transport', date: pad(3, 22) },
    { id: '7', name: 'Lidl', amount: 120, category: 'Jedzenie', date: pad(2, 25) },
    { id: '8', name: 'Paliwo', amount: 220, category: 'Transport', date: pad(2, 10) },
    { id: '9', name: 'Kaufland', amount: 145, category: 'Jedzenie', date: pad(2, 12) },
    { id: '10', name: 'Gaz', amount: 95, category: 'Mieszkanie', date: pad(2, 15) },
    { id: '11', name: 'Bilet PKP', amount: 89, category: 'Transport', date: pad(2, 8) },
    { id: '12', name: 'Steam', amount: 60, category: 'Rozrywka', date: pad(2, 14) },
    { id: '13', name: 'Pizza', amount: 45, category: 'Jedzenie', date: pad(2, 28) },
    { id: '14', name: 'Kaufland', amount: 95, category: 'Jedzenie', date: pad(1, 12) },
    { id: '15', name: 'Benzyna', amount: 190, category: 'Transport', date: pad(1, 8) },
    { id: '16', name: 'Książki', amount: 45, category: 'Rozrywka', date: pad(1, 25) },
    { id: '17', name: 'Biedronka', amount: 72, category: 'Jedzenie', date: pad(1, 5) },
    { id: '18', name: 'Paliwo', amount: 210, category: 'Transport', date: pad(1, 18) },
    { id: '19', name: 'Obiad', amount: 65, category: 'Jedzenie', date: pad(1, 22) },
    { id: '20', name: 'Gaz', amount: 88, category: 'Mieszkanie', date: pad(1, 10) },
    { id: '21', name: 'Biedronka', amount: 90, category: 'Jedzenie', date: pad(4, 5) },
    { id: '22', name: 'Paliwo', amount: 195, category: 'Transport', date: pad(4, 12) },
    { id: '23', name: 'Lidl', amount: 110, category: 'Jedzenie', date: pad(5, 8) },
    { id: '24', name: 'Kaufland', amount: 130, category: 'Jedzenie', date: pad(6, 15) },
    { id: '25', name: 'Paliwo', amount: 205, category: 'Transport', date: pad(6, 10) },
    { id: '26', name: 'Biedronka', amount: 78, category: 'Jedzenie', date: pad(7, 7) },
    { id: '27', name: 'Lidl', amount: 95, category: 'Jedzenie', date: pad(8, 14) },
    { id: '28', name: 'Gaz', amount: 92, category: 'Mieszkanie', date: pad(8, 18) },
    { id: '29', name: 'Kaufland', amount: 140, category: 'Jedzenie', date: pad(9, 12) },
    { id: '30', name: 'Biedronka', amount: 88, category: 'Jedzenie', date: pad(10, 5) },
    { id: '31', name: 'Ogrzewanie', amount: 250, category: 'Mieszkanie', date: pad(10, 15) },
    { id: '32', name: 'Lidl', amount: 125, category: 'Jedzenie', date: pad(11, 20) },
    { id: '33', name: 'Prezenty', amount: 350, category: 'Rozrywka', date: pad(12, 22) },
    { id: '34', name: 'Biedronka', amount: 150, category: 'Jedzenie', date: pad(12, 28) },
  ]

  const income: DemoIncome[] = [
    { id: '1', source: 'Praca', amount: 4500, date: pad(3, 1), recurring: true },
    { id: '2', source: 'Freelance', amount: 300, date: pad(3, 15), recurring: false },
    { id: '3', source: 'Zwrot podatku', amount: 1200, date: pad(3, 20), recurring: false },
    { id: '4', source: 'Praca', amount: 4500, date: pad(2, 1), recurring: true },
    { id: '5', source: 'Sprzedaż', amount: 150, date: pad(2, 20), recurring: false },
    { id: '6', source: 'Freelance', amount: 450, date: pad(2, 10), recurring: false },
    { id: '7', source: 'Praca', amount: 4500, date: pad(1, 1), recurring: true },
    { id: '8', source: 'Premia', amount: 500, date: pad(1, 15), recurring: false },
    { id: '9', source: 'Freelance', amount: 280, date: pad(1, 25), recurring: false },
    { id: '10', source: 'Praca', amount: 4500, date: pad(4, 1), recurring: true },
    { id: '11', source: 'Praca', amount: 4500, date: pad(5, 1), recurring: true },
    { id: '12', source: 'Freelance', amount: 320, date: pad(5, 18), recurring: false },
    { id: '13', source: 'Praca', amount: 4500, date: pad(6, 1), recurring: true },
    { id: '14', source: 'Praca', amount: 4500, date: pad(7, 1), recurring: true },
    { id: '15', source: 'Premia', amount: 400, date: pad(7, 20), recurring: false },
    { id: '16', source: 'Praca', amount: 4500, date: pad(8, 1), recurring: true },
    { id: '17', source: 'Praca', amount: 4500, date: pad(9, 1), recurring: true },
    { id: '18', source: 'Freelance', amount: 280, date: pad(9, 25), recurring: false },
    { id: '19', source: 'Praca', amount: 4500, date: pad(10, 1), recurring: true },
    { id: '20', source: 'Praca', amount: 4500, date: pad(11, 1), recurring: true },
    { id: '21', source: 'Praca', amount: 4500, date: pad(12, 1), recurring: true },
    { id: '22', source: 'Premia świąteczna', amount: 800, date: pad(12, 15), recurring: false },
  ].map((row) => ({ ...row, category: '' }))

  return {
    expenses: expenses.map((e, i) => ({
      ...e,
      paymentMethod: (i % 2 === 0 ? 'card' : 'cash') as PaymentMethod,
    })),
    income: income.map((e, i) => ({
      ...e,
      paymentMethod: (i % 3 === 0 ? 'cash' : 'card') as PaymentMethod,
    })),
  }
}

const DEMO_SCHEDULED_EXPENSES: DemoScheduledExpense[] = [
  { id: 's1', name: 'Czynsz', amount: 1200, category: 'Mieszkanie', dayOfMonth: 1, active: true, paymentMethod: 'card', pausedUntil: null, reminderDaysBefore: 3 },
  { id: 's2', name: 'Netflix', amount: 55, category: 'Rozrywka', dayOfMonth: 2, active: true, paymentMethod: 'card', pausedUntil: null, reminderDaysBefore: 1 },
  { id: 's3', name: 'Spotify', amount: 23, category: 'Rozrywka', dayOfMonth: 5, active: true, paymentMethod: 'card', pausedUntil: null, reminderDaysBefore: 1 },
  { id: 's4', name: 'Prąd', amount: 185, category: 'Mieszkanie', dayOfMonth: 20, active: true, paymentMethod: 'cash', pausedUntil: null, reminderDaysBefore: 5 },
]

const currentYear = new Date().getFullYear()
const { expenses: DEMO_EXPENSES, income: DEMO_INCOME } = getDemoData(currentYear)

export const DEMO_NET_WORTH: DemoNetWorth = { cash: 800, bankAccount: 4200, assets: 12000 }

export { DEMO_EXPENSES, DEMO_INCOME, DEMO_SCHEDULED_EXPENSES }

const NET_WORTH_STORAGE_KEY = 'tallyo_net_worth'
const DEMO_EXPENSES_STORAGE_KEY = 'tallyo_demo_expenses_v1'
const DEMO_INCOME_STORAGE_KEY = 'tallyo_demo_income_v1'
const DEMO_SCHEDULED_STORAGE_KEY = 'tallyo_demo_scheduled_expenses_v1'

function isDemoExpenseRow(x: unknown): x is DemoExpense {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.amount === 'number' &&
    typeof o.category === 'string' &&
    typeof o.date === 'string' &&
    (o.paymentMethod === undefined || isPaymentMethod(o.paymentMethod))
  )
}

function isDemoIncomeRow(x: unknown): x is Omit<DemoIncome, 'category'> & { category?: string } {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.source === 'string' &&
    typeof o.amount === 'number' &&
    typeof o.date === 'string' &&
    typeof o.recurring === 'boolean' &&
    (o.category === undefined || typeof o.category === 'string') &&
    (o.paymentMethod === undefined || isPaymentMethod(o.paymentMethod))
  )
}

function isDemoScheduledRow(x: unknown): x is DemoScheduledExpense {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.amount === 'number' &&
    typeof o.category === 'string' &&
    typeof o.dayOfMonth === 'number' &&
    typeof o.active === 'boolean' &&
    (o.paymentMethod === undefined || isPaymentMethod(o.paymentMethod))
  )
}

function loadDemoExpenses(): DemoExpense[] {
  try {
    const raw = localStorage.getItem(DEMO_EXPENSES_STORAGE_KEY)
    if (!raw) return DEMO_EXPENSES
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEMO_EXPENSES
    const rows = parsed.filter(isDemoExpenseRow)
    if (parsed.length > 0 && rows.length === 0) return DEMO_EXPENSES
    return rows
  } catch {
    return DEMO_EXPENSES
  }
}

function loadDemoIncome(): DemoIncome[] {
  try {
    const raw = localStorage.getItem(DEMO_INCOME_STORAGE_KEY)
    if (!raw) return DEMO_INCOME
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEMO_INCOME
    const rows = parsed.filter(isDemoIncomeRow).map((r) => ({ ...r, category: r.category ?? '' }))
    if (parsed.length > 0 && rows.length === 0) return DEMO_INCOME
    return rows
  } catch {
    return DEMO_INCOME
  }
}

function loadDemoScheduled(): DemoScheduledExpense[] {
  try {
    const raw = localStorage.getItem(DEMO_SCHEDULED_STORAGE_KEY)
    if (!raw) return DEMO_SCHEDULED_EXPENSES
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEMO_SCHEDULED_EXPENSES
    const rows = parsed.filter(isDemoScheduledRow).map((x) => ({
      ...x,
      currency: x.currency ?? 'PLN',
      originalAmount: x.originalAmount ?? null,
      pausedUntil: x.pausedUntil ?? null,
      reminderDaysBefore: x.reminderDaysBefore ?? null,
    }))
    if (parsed.length > 0 && rows.length === 0) return DEMO_SCHEDULED_EXPENSES
    return rows
  } catch {
    return DEMO_SCHEDULED_EXPENSES
  }
}

function loadNetWorth(): DemoNetWorth {
  try {
    const s = localStorage.getItem(NET_WORTH_STORAGE_KEY)
    if (s) {
      const parsed = JSON.parse(s) as Partial<DemoNetWorth>
      return {
        cash: typeof parsed.cash === 'number' ? parsed.cash : DEMO_NET_WORTH.cash,
        bankAccount: typeof parsed.bankAccount === 'number' ? parsed.bankAccount : DEMO_NET_WORTH.bankAccount,
        assets: typeof parsed.assets === 'number' ? parsed.assets : DEMO_NET_WORTH.assets,
      }
    }
  } catch {
    /* ignore */
  }
  return DEMO_NET_WORTH
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<DemoExpense[]>(() => loadDemoExpenses())
  const [income, setIncome] = useState<DemoIncome[]>(() => loadDemoIncome())
  const [scheduledExpenses, setScheduledExpenses] = useState<DemoScheduledExpense[]>(() => loadDemoScheduled())
  const [netWorth, setNetWorth] = useState<DemoNetWorth>(loadNetWorth)

  const addExpense = (e: Omit<DemoExpense, 'id'>) => {
    setExpenses((prev) => {
      const next = [...prev, { ...e, id: Date.now().toString() }]
      try {
        localStorage.setItem(DEMO_EXPENSES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const updateExpense = (id: string, updates: Partial<Omit<DemoExpense, 'id'>>) => {
    setExpenses((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...updates } : x))
      try {
        localStorage.setItem(DEMO_EXPENSES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const restoreExpense = (expense: DemoExpense) => {
    setExpenses((prev) => {
      const next = [expense, ...prev.filter((x) => x.id !== expense.id)]
      try {
        localStorage.setItem(DEMO_EXPENSES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const deleteExpense = (id: string) => {
    setExpenses((prev) => {
      const next = prev.filter((x) => x.id !== id)
      try {
        localStorage.setItem(DEMO_EXPENSES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const addIncome = (i: Omit<DemoIncome, 'id'>) => {
    setIncome((prev) => {
      const next = [...prev, { ...i, id: Date.now().toString(), category: i.category ?? '' }]
      try {
        localStorage.setItem(DEMO_INCOME_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const updateIncome = (id: string, updates: Partial<Omit<DemoIncome, 'id'>>) => {
    setIncome((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...updates } : x))
      try {
        localStorage.setItem(DEMO_INCOME_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const restoreIncome = (incomeItem: DemoIncome) => {
    setIncome((prev) => {
      const next = [incomeItem, ...prev.filter((x) => x.id !== incomeItem.id)]
      try {
        localStorage.setItem(DEMO_INCOME_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const deleteIncome = (id: string) => {
    setIncome((prev) => {
      const next = prev.filter((x) => x.id !== id)
      try {
        localStorage.setItem(DEMO_INCOME_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const addScheduledExpense = (e: Omit<DemoScheduledExpense, 'id'>) => {
    setScheduledExpenses((prev) => {
      const next = [
        ...prev,
        {
          ...e,
          pausedUntil: e.pausedUntil ?? null,
          reminderDaysBefore: e.reminderDaysBefore ?? null,
          createdAt: e.createdAt ?? new Date().toISOString(),
          id: `s${Date.now()}`,
        },
      ]
      try {
        localStorage.setItem(DEMO_SCHEDULED_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const updateScheduledExpense = (id: string, updates: Partial<DemoScheduledExpense>) => {
    setScheduledExpenses((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...updates } : x))
      try {
        localStorage.setItem(DEMO_SCHEDULED_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const deleteScheduledExpense = (id: string) => {
    setScheduledExpenses((prev) => {
      const item = prev.find((x) => x.id === id)
      // First occurrence: the payment day in the month of creation (missing createdAt = the cost already has history).
      let hasPastOccurrence = true
      if (item?.createdAt) {
        const created = new Date(item.createdAt)
        const lastDay = new Date(created.getFullYear(), created.getMonth() + 1, 0).getDate()
        const firstOccurrence = new Date(
          created.getFullYear(),
          created.getMonth(),
          Math.min(item.dayOfMonth, lastDay),
          23, 59, 59, 999
        )
        hasPastOccurrence = firstOccurrence <= new Date()
      }
      // Soft delete keeps past payments in history; hard delete only when nothing was ever charged.
      const next = hasPastOccurrence
        ? prev.map((x) => (x.id === id ? { ...x, endedAt: new Date().toISOString() } : x))
        : prev.filter((x) => x.id !== id)
      try {
        localStorage.setItem(DEMO_SCHEDULED_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const skipScheduledOccurrence = (id: string, date: string) => {
    setScheduledExpenses((prev) => {
      const next = prev.map((x) =>
        x.id === id && !(x.skippedDates ?? []).includes(date)
          ? { ...x, skippedDates: [...(x.skippedDates ?? []), date] }
          : x
      )
      try {
        localStorage.setItem(DEMO_SCHEDULED_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const updateNetWorthPosition = (key: NetWorthPositionKey, delta: number) => {
    setNetWorth((prev) => {
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) }
      try {
        localStorage.setItem(NET_WORTH_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <DemoDataContext.Provider
      value={{
        expenses,
        income,
        scheduledExpenses,
        netWorth,
        addExpense,
        updateExpense,
        restoreExpense,
        deleteExpense,
        addIncome,
        updateIncome,
        restoreIncome,
        deleteIncome,
        addScheduledExpense,
        updateScheduledExpense,
        deleteScheduledExpense,
        skipScheduledOccurrence,
        updateNetWorthPosition,
      }}
    >
      {children}
    </DemoDataContext.Provider>
  )
}

export function useDemoData() {
  const ctx = useContext(DemoDataContext)
  return ctx
}
