import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { RecurringModal, type RecurringFormPayload } from '../../components/RecurringModal'
import { TransactionNoteModal } from '../../components/TransactionNoteModal'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarClock, Pause, Pencil, Play, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useDemoData, DEMO_SCHEDULED_EXPENSES } from '../../context/DemoDataContext'
import { useFinanceCategories } from '../../context/FinanceCategoriesContext'
import { scheduledExpensesApi } from '../../lib/api'
import { useFinanceListsQuery } from '../../hooks/useFinanceListsQuery'
import { useFinanceUsesApi } from '../../hooks/useFinanceUsesApi'
import { FinanceListPageSkeleton } from '../../components/skeletons'
import { invalidateFinanceQueries } from '../../lib/invalidateFinanceQueries'
import { PaymentMethodBadge } from '../../components/finance/PaymentMethodPicker'
import type { ScheduledExpenseRow } from '../../lib/financeTypes'
import type { PaymentMethod } from '../../lib/paymentMethod'
import { formatCurrencyAmount, type Currency, formatPln, formatNumberPl } from '../../lib/currency'

/** Next payment date (same logic as the existing date preview). */
function getNextPaymentDate(dayOfMonth: number): Date {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const target = new Date(y, m, Math.min(dayOfMonth, new Date(y, m + 1, 0).getDate()))
  if (target < now) {
    return new Date(y, m + 1, Math.min(dayOfMonth, new Date(y, m + 2, 0).getDate()))
  }
  return target
}

type RecurringSortBy = 'payment' | 'amount' | 'category'

export function Recurring() {
  const { t, i18n } = useTranslation('finances')
  const { user } = useAuth()
  const useApiFinance = useFinanceUsesApi()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  const demoData = useDemoData()
  const { categories, getColor, addCategory, deleteCategory } = useFinanceCategories()
  const [recurringModalOpen, setRecurringModalOpen] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<ScheduledExpenseRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduledExpenseRow | null>(null)
  const [noteTarget, setNoteTarget] = useState<ScheduledExpenseRow | null>(null)
  const [sortBy, setSortBy] = useState<RecurringSortBy>('payment')

  const closeRecurringModal = () => {
    setRecurringModalOpen(false)
    setEditingRecurring(null)
  }
  const { scheduledExpenses: qScheduled, isLoading: financeLoading } = useFinanceListsQuery()
  const loading = useApiFinance ? financeLoading : false

  const allScheduledRaw = useApiFinance ? qScheduled : (demoData?.scheduledExpenses ?? DEMO_SCHEDULED_EXPENSES)
  // Ended (soft-deleted) costs are hidden from the management list — they live only in transaction history
  const allScheduled = useMemo(() => allScheduledRaw.filter((s) => !s.endedAt), [allScheduledRaw])
  const total = allScheduled.reduce((s, e) => s + e.amount, 0)
  const annualTotal = total * 12

  const nextPaymentLabel = (dayOfMonth: number) =>
    getNextPaymentDate(dayOfMonth).toLocaleDateString(i18n.language === 'pl' ? 'pl-PL' : 'en-US')

  const sortedScheduled = useMemo(() => {
    const list = [...allScheduled]
    list.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      if (sortBy === 'payment')
        return (
          getNextPaymentDate(a.dayOfMonth).getTime() - getNextPaymentDate(b.dayOfMonth).getTime() ||
          a.name.localeCompare(b.name, 'pl')
        )
      if (sortBy === 'amount')
        return b.amount - a.amount || a.name.localeCompare(b.name, 'pl')
      return a.category.localeCompare(b.category, 'pl') || a.name.localeCompare(b.name, 'pl')
    })
    return list
  }, [allScheduled, sortBy])

  const sortButtonClass = (key: RecurringSortBy) =>
    `rounded-lg border px-3 py-2 text-sm font-display transition-colors ${
      sortBy === key
        ? 'border-(--warning)/45 bg-(--warning)/15 text-(--warning)'
        : 'border-(--border) bg-(--bg-dark) text-(--text-muted) hover:border-(--warning)/25 hover:text-(--text-primary)'
    }`

  const handleAdd = async (data: RecurringFormPayload) => {
    const { convertedAmount, ...rest } = data
    if (!useApiFinance && demoData) {
      demoData.addScheduledExpense({
        ...rest,
        amount: convertedAmount ?? data.amount,
        originalAmount: data.currency === 'PLN' ? null : data.amount,
        active: true,
        pausedUntil: null,
        reminderDaysBefore: null,
      })
    } else {
      await scheduledExpensesApi.create(rest)
      await invalidateFinanceQueries(queryClient, userId)
    }
    closeRecurringModal()
  }

  const handleDelete = async (id: string) => {
    if (!useApiFinance && demoData) {
      demoData.deleteScheduledExpense(id)
    } else {
      await scheduledExpensesApi.delete(id)
      await invalidateFinanceQueries(queryClient, userId)
    }
  }

  const runConfirmedDelete = () => {
    const target = deleteTarget
    setDeleteTarget(null)
    if (!target) return
    if (editingRecurring?.id === target.id) closeRecurringModal()
    void handleDelete(target.id)
  }

  const handleUpdate = async (
    id: string,
    updates: {
      active?: boolean
      pausedUntil?: string | null
      reminderDaysBefore?: number | null
      name?: string
      amount?: number
      currency?: Currency
      originalAmount?: number | null
      category?: string
      dayOfMonth?: number
      paymentMethod?: PaymentMethod
      note?: string | null
      amountEffectiveFrom?: string
    }
  ) => {
    if (!useApiFinance && demoData) {
      const { amountEffectiveFrom, ...demoUpdates } = updates
      demoData.updateScheduledExpense(id, demoUpdates, { amountEffectiveFrom })
    } else {
      // originalAmount is server-derived from amount+currency; not part of the update endpoint's contract
      const { originalAmount, ...apiUpdates } = updates
      void originalAmount
      await scheduledExpensesApi.update(id, apiUpdates)
      await invalidateFinanceQueries(queryClient, userId)
    }
  }

  const handleSaveNote = async (id: string, note: string) => {
    await handleUpdate(id, { note: note.trim() ? note.trim() : null })
  }

  if (loading) {
    return <FinanceListPageSkeleton rows={5} />
  }

  return (
    <div className="space-y-5">
      <Card className="border-(--warning)/20 max-md:p-4">
        <p className="text-base text-(--text-muted)">{t('recurring.monthlyTotal')}</p>
        <p className="mt-1 text-2xl font-bold font-display text-(--warning)">
          {formatPln(total)}
        </p>
        <p className="mt-1 text-sm text-(--text-muted) sm:text-base">{t('recurring.annually', { amount: formatNumberPl(annualTotal) })}</p>
      </Card>

      <Card title={t('recurring.title')} className="max-md:p-4">
        <p className="mb-4 text-base text-(--text-muted)">
          {t('recurring.description')}
        </p>
        <label className="mb-4 flex flex-col gap-1.5 md:hidden">
          <span className="text-base text-(--text-muted)">{t('recurring.sortLabel')}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as RecurringSortBy)}
            className="min-h-11 rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--warning)/50 focus:outline-none"
          >
            <option value="payment">{t('recurring.sortPayment')}</option>
            <option value="amount">{t('recurring.sortAmount')}</option>
            <option value="category">{t('recurring.sortCategory')}</option>
          </select>
        </label>
        <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
          <span className="text-base text-(--text-muted)">{t('recurring.sortLabel')}:</span>
          <button type="button" className={sortButtonClass('payment')} onClick={() => setSortBy('payment')}>
            {t('recurring.sortPayment')}
          </button>
          <button type="button" className={sortButtonClass('amount')} onClick={() => setSortBy('amount')}>
            {t('recurring.sortAmount')}
          </button>
          <button type="button" className={sortButtonClass('category')} onClick={() => setSortBy('category')}>
            {t('recurring.sortCategory')}
          </button>
        </div>
        <div className="mb-4 space-y-3">
          <AnimatePresence>
            {sortedScheduled.map((s) => {
              const color = getColor(s.category)
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col gap-3 rounded-lg border border-(--border) bg-(--bg-dark) p-3.5 transition-colors hover:border-(--warning)/20 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-3"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className="mt-1.5 h-3 w-3 shrink-0 rounded-full sm:mt-2"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-(--text-primary)">{s.name}</p>
                      <p className="text-sm text-(--text-muted) sm:text-base">
                        {s.category} · {t('overview.dayOfMonth', { day: s.dayOfMonth })}
                        {s.paymentMethod ? (
                          <span className="ml-2">
                            <PaymentMethodBadge method={s.paymentMethod} />
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1.5 font-mono text-lg tabular-nums leading-none text-(--warning)">
                        {s.currency && s.currency !== 'PLN' && s.originalAmount != null ? (
                          <>
                            −{formatCurrencyAmount(s.originalAmount, s.currency)}{' '}
                            <span className="text-sm font-sans font-normal text-(--text-muted)">
                              {t('recurring.convertedBadge', { amount: formatNumberPl(s.amount) })}
                            </span>
                          </>
                        ) : (
                          <>−{formatPln(s.amount)}</>
                        )}{' '}
                        <span className="text-sm font-sans font-normal text-(--text-muted)">{t('recurring.perMonth')}</span>
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm text-(--text-muted)">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        {t('recurring.next', { date: nextPaymentLabel(s.dayOfMonth) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-(--border)/50 pt-2.5 sm:flex-none sm:border-0 sm:pt-0">
                    <button
                      type="button"
                      onClick={() =>
                        void handleUpdate(s.id, { active: !s.active, pausedUntil: null })
                      }
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg-card) px-3 text-sm text-(--text-primary) font-display shadow-sm hover:border-(--accent)/45 hover:bg-(--accent)/12 hover:text-(--accent) transition-colors"
                      title={s.active ? t('recurring.pauseTitle') : t('recurring.resumeTitle')}
                    >
                      {s.active ? <Pause className="h-4 w-4 shrink-0" /> : <Play className="h-4 w-4 shrink-0" />}
                      <span>{s.active ? t('recurring.pause') : t('recurring.resume')}</span>
                    </button>
                    <div
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg-card) px-2.5"
                      title={t('recurring.reminderTitle')}
                    >
                      <span className="whitespace-nowrap text-base text-(--text-muted)">{t('recurring.reminderLabel')}</span>
                      <input
                        type="number"
                        min={0}
                        max={31}
                        value={s.reminderDaysBefore ?? ''}
                        onChange={(e) =>
                          void handleUpdate(s.id, {
                            reminderDaysBefore: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="no-spinners h-7 w-10 rounded bg-(--bg-dark) border border-(--border) px-1 text-center text-base text-(--text-primary) focus:border-(--accent) focus:outline-none"
                        aria-label={t('recurring.reminderDaysAria')}
                      />
                      <span className="whitespace-nowrap text-base text-(--text-muted)">{t('recurring.reminderDaysSuffix')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNoteTarget(s)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-(--text-muted) hover:bg-(--warning)/10 hover:text-(--warning) transition-colors"
                      title={t('transactions.viewNote')}
                    >
                      <StickyNote className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecurring(s)
                        setRecurringModalOpen(true)
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-(--text-muted) hover:bg-(--warning)/10 hover:text-(--warning) transition-colors"
                      title={t('common:edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(s)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-(--text-muted) hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title={t('common:delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingRecurring(null)
            setRecurringModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--warning)/15 text-(--warning) border border-(--warning)/40 font-display hover:bg-(--warning)/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('recurring.addRecurring')}
        </button>

        <RecurringModal
          isOpen={recurringModalOpen}
          onClose={closeRecurringModal}
          onSubmit={handleAdd}
          onUpdate={async (id, data) => {
            const { convertedAmount, ...rest } = data
            if (!useApiFinance && demoData) {
              // Demo mode has no backend to compute the rate — we save the already-converted amount.
              await handleUpdate(id, {
                ...rest,
                amount: convertedAmount ?? data.amount,
                originalAmount: data.currency === 'PLN' ? null : data.amount,
              })
            } else {
              // The API converts from the raw amount in `currency` itself — we don't send an already-converted amount here.
              await handleUpdate(id, rest)
            }
          }}
          editing={
            editingRecurring
              ? {
                  id: editingRecurring.id,
                  name: editingRecurring.name,
                  amount: editingRecurring.amount,
                  currency: editingRecurring.currency,
                  originalAmount: editingRecurring.originalAmount,
                  category: editingRecurring.category,
                  dayOfMonth: editingRecurring.dayOfMonth,
                  paymentMethod: editingRecurring.paymentMethod,
                  note: editingRecurring.note,
                }
              : null
          }
          categories={categories}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
        />

        <ConfirmDialog
          isOpen={deleteTarget != null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={runConfirmedDelete}
          title={t('recurring.deleteConfirmTitle')}
          description={t('recurring.deleteConfirmDescription')}
          emphasis={deleteTarget?.name}
          variant="danger"
          confirmLabel={t('common:delete')}
          cancelLabel={t('common:cancel')}
        />

        <TransactionNoteModal
          isOpen={noteTarget != null}
          onClose={() => setNoteTarget(null)}
          title={noteTarget?.name ?? ''}
          initialNote={noteTarget?.note ?? ''}
          onSave={(note) => (noteTarget ? handleSaveNote(noteTarget.id, note) : undefined)}
        />
      </Card>
    </div>
  )
}
