import { api } from './client'
import type { PaymentMethod } from '../paymentMethod'
import type { Currency } from '../currency'
import type { AmountHistoryEntry } from '../scheduledAmountHistory'

type ExpenseDto = {
  id: string
  name: string
  amount: number
  category: string
  date: string
  paymentMethod?: PaymentMethod | null
  note?: string | null
}

type IncomeDto = {
  id: string
  source: string
  amount: number
  date: string
  recurring: boolean
  category: string
  paymentMethod?: PaymentMethod | null
  note?: string | null
}

export const expensesApi = {
  getAll: () => api<ExpenseDto[]>('/expenses'),
  create: (data: { name: string; amount: number; category: string; date: string; paymentMethod: PaymentMethod; note?: string | null }) =>
    api<ExpenseDto>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: { name?: string; amount?: number; category?: string; date?: string; paymentMethod?: PaymentMethod; note?: string | null },
  ) => api<ExpenseDto>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/expenses/${id}`, { method: 'DELETE' }),
}

export const expenseCategoriesApi = {
  getAll: () =>
    api<{ id: string; name: string; color: string }[]>('/expense-categories'),
  create: (data: { name: string; color: string }) =>
    api<{ id: string; name: string; color: string }>('/expense-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; color?: string }) =>
    api<{ id: string; name: string; color: string }>(`/expense-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => api(`/expense-categories/${id}`, { method: 'DELETE' }),
}

type ScheduledExpenseDto = {
  id: string
  name: string
  amount: number
  currency: Currency
  originalAmount?: number | null
  category: string
  dayOfMonth: number
  active: boolean
  paymentMethod?: PaymentMethod | null
  pausedUntil?: string | null
  reminderDaysBefore?: number | null
  note?: string | null
  endedAt?: string | null
  /** Payment dates (YYYY-MM-DD) removed by the user — not generated as payments. */
  skippedDates?: string[]
  /** Earlier amounts — payments before a price change keep what was charged. */
  amountHistory?: AmountHistoryEntry[] | null
  createdAt?: string
}

export const scheduledExpensesApi = {
  getAll: () => api<ScheduledExpenseDto[]>('/scheduled-expenses'),
  create: (data: {
    name: string
    amount: number
    currency?: Currency
    category: string
    dayOfMonth: number
    paymentMethod: PaymentMethod
    note?: string | null
  }) => api<ScheduledExpenseDto>('/scheduled-expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      name?: string
      amount?: number
      currency?: Currency
      category?: string
      dayOfMonth?: number
      active?: boolean
      paymentMethod?: PaymentMethod
      pausedUntil?: string | null
      reminderDaysBefore?: number | null
      note?: string | null
      /** First payment date (YYYY-MM-DD) that uses the new amount; earlier payments keep the old one. */
      amountEffectiveFrom?: string
    }
  ) => api<ScheduledExpenseDto>(`/scheduled-expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/scheduled-expenses/${id}`, { method: 'DELETE' }),
  /** Removes a single payment of a recurring cost (e.g. one that was never actually paid). */
  skipOccurrence: (id: string, date: string) =>
    api<ScheduledExpenseDto>(`/scheduled-expenses/${id}/skip-occurrence`, { method: 'POST', body: JSON.stringify({ date }) }),
  /** Edits a single payment only: it becomes a regular expense; the recurring cost itself stays unchanged. */
  editOccurrence: (
    id: string,
    data: {
      occurrenceDate: string
      name: string
      amount: number
      category: string
      date: string
      paymentMethod: PaymentMethod
      note?: string | null
    }
  ) => api<ExpenseDto>(`/scheduled-expenses/${id}/edit-occurrence`, { method: 'POST', body: JSON.stringify(data) }),
}

export const incomeApi = {
  getAll: () => api<IncomeDto[]>('/income'),
  create: (data: {
    source: string
    amount: number
    date: string
    recurring?: boolean
    category?: string
    paymentMethod: PaymentMethod
    note?: string | null
  }) => api<IncomeDto>('/income', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      source?: string
      amount?: number
      date?: string
      recurring?: boolean
      category?: string
      paymentMethod?: PaymentMethod
      note?: string | null
    },
  ) => api<IncomeDto>(`/income/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/income/${id}`, { method: 'DELETE' }),
}

export type NetWorthAccountDto = {
  id: string
  name: string
  kind: 'asset' | 'liability'
  balance: number
  iconKey?: string | null
  accentKey?: string | null
  createdAt: string
  updatedAt: string
}

export type NetWorthAdjustmentDto = {
  id: string
  accountId: string
  amount: number
  description: string | null
  createdAt: string
  account: { id: string; name: string; kind: 'asset' | 'liability' }
}

export const netWorthApi = {
  getAccounts: () => api<NetWorthAccountDto[]>('/net-worth/accounts'),
  createAccount: (data: {
    name: string
    kind: 'asset' | 'liability'
    balance: number
    iconKey?: string | null
    accentKey?: string | null
  }) =>
    api<NetWorthAccountDto>('/net-worth/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (
    id: string,
    data: Partial<{
      name: string
      kind: 'asset' | 'liability'
      balance: number
      iconKey?: string | null
      accentKey?: string | null
    }>
  ) =>
    api<NetWorthAccountDto>(`/net-worth/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: string) => api<void>(`/net-worth/accounts/${id}`, { method: 'DELETE' }),
  getAdjustments: () => api<NetWorthAdjustmentDto[]>('/net-worth/adjustments'),
  createAdjustment: (data: { accountId: string; amount: number; description?: string }) =>
    api<{ adjustment: NetWorthAdjustmentDto; account: NetWorthAccountDto }>('/net-worth/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAdjustment: (id: string, data: { description?: string; amount?: number }) =>
    api<NetWorthAdjustmentDto>(`/net-worth/adjustments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteAdjustment: (id: string) => api<void>(`/net-worth/adjustments/${id}`, { method: 'DELETE' }),
}
