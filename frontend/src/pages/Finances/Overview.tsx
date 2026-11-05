import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/Card'
import { MonthSelector } from '../../components/MonthSelector'
import { Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { TransactionModal } from '../../components/TransactionModal'
import { RecurringModal, type RecurringFormPayload } from '../../components/RecurringModal'
import { useAuth } from '../../context/AuthContext'
import { useDemoData, DEMO_EXPENSES, DEMO_INCOME, DEMO_SCHEDULED_EXPENSES } from '../../context/DemoDataContext'
import { mergeExpensesWithScheduled } from '../../lib/expensesUtils'
import { useMonth, inMonth } from '../../context/MonthContext'
import { useFinanceListsQuery } from '../../hooks/useFinanceListsQuery'
import { useFinanceUsesApi } from '../../hooks/useFinanceUsesApi'
import { useFinanceCategories } from '../../context/FinanceCategoriesContext'
import { useFinanceTransactionSubmit, type TransactionFormData } from '../../hooks/useFinanceTransactionSubmit'
import { invalidateFinanceQueries } from '../../lib/invalidateFinanceQueries'
import { scheduledExpensesApi } from '../../lib/api'
import { OverviewSkeleton } from '../../components/skeletons'
import {
  getOverviewTileVariants,
  overviewPageContainerVariants,
} from '../../lib/layoutSectionMotion'
import { formatPln } from '../../lib/currency'

export function Overview() {
  const { t, i18n } = useTranslation('finances')
  const monthNames = useMemo(() => {
    const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'
    return Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleDateString(locale, { month: 'long' }))
  }, [i18n.language])
  const { user } = useAuth()
  const useApiFinance = useFinanceUsesApi()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()
  const demoData = useDemoData()
  const userId = user?.id ?? ''
  const { categories: finCats, addCategory, deleteCategory, getLabel } = useFinanceCategories()
  const { submit: submitTransaction } = useFinanceTransactionSubmit()
  const monthCtx = useMonth()
  const [txType, setTxType] = useState<'income' | 'expense'>('expense')
  const [showTxModal, setShowTxModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const {
    expenses: qExpenses,
    income: qIncome,
    scheduledExpenses: qScheduled,
    isLoading: financeLoading,
  } = useFinanceListsQuery()

  const selectedMonth = monthCtx?.selectedMonth ?? new Date().getMonth()
  const selectedYear = monthCtx?.selectedYear ?? new Date().getFullYear()

  const effectiveExpenses = useApiFinance ? qExpenses : (demoData?.expenses ?? DEMO_EXPENSES)
  const effectiveScheduled = useApiFinance ? qScheduled : (demoData?.scheduledExpenses ?? DEMO_SCHEDULED_EXPENSES)
  const effectiveIncome = useApiFinance ? qIncome : (demoData?.income ?? DEMO_INCOME)
  const loading = useApiFinance ? financeLoading : false

  const {
    currentTotal,
    previousTotal,
    changePercent,
    currentIncomeForTrend,
    currentExpensesForTrend,
    previousIncomeForTrend,
    previousExpensesForTrend,
  } = useMemo(() => {
    const monthExp = effectiveExpenses.filter((e) => inMonth(e.date, selectedMonth, selectedYear))
    const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, selectedMonth, selectedYear)
    const monthInc = effectiveIncome.filter((i) => inMonth(i.date, selectedMonth, selectedYear))
    const currentExpenses = merged.reduce((s, e) => s + e.amount, 0)
    const currentIncome = monthInc.reduce((s, i) => s + i.amount, 0)
    const currentTotal = currentIncome - currentExpenses

    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear
    const prevMonthExp = effectiveExpenses.filter((e) => inMonth(e.date, prevMonth, prevYear))
    const prevMerged = mergeExpensesWithScheduled(prevMonthExp, effectiveScheduled, prevMonth, prevYear)
    const prevMonthInc = effectiveIncome.filter((i) => inMonth(i.date, prevMonth, prevYear))
    const prevExpenses = prevMerged.reduce((s, e) => s + e.amount, 0)
    const prevIncome = prevMonthInc.reduce((s, i) => s + i.amount, 0)
    const previousTotal = prevIncome - prevExpenses

    const changePercent = previousTotal !== 0
      ? (((currentTotal - previousTotal) / Math.abs(previousTotal)) * 100).toFixed(0)
      : currentTotal > 0 ? '100' : '0'

    return {
      currentTotal,
      previousTotal,
      changePercent: Number(changePercent),
      currentIncomeForTrend: currentIncome,
      currentExpensesForTrend: currentExpenses,
      previousIncomeForTrend: prevIncome,
      previousExpensesForTrend: prevExpenses,
    }
  }, [effectiveExpenses, effectiveScheduled, effectiveIncome, selectedMonth, selectedYear])

  const { expensesTotal, incomeTotal } = useMemo(() => {
    const monthExp = effectiveExpenses.filter((e) => inMonth(e.date, selectedMonth, selectedYear))
    const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, selectedMonth, selectedYear)
    const monthInc = effectiveIncome.filter((i) => inMonth(i.date, selectedMonth, selectedYear))
    return {
      expensesTotal: merged.reduce((s, e) => s + e.amount, 0),
      incomeTotal: monthInc.reduce((s, i) => s + i.amount, 0),
    }
  }, [effectiveExpenses, effectiveScheduled, effectiveIncome, selectedMonth, selectedYear])

  const monthDays = useMemo(() => new Date(selectedYear, selectedMonth + 1, 0).getDate(), [selectedMonth, selectedYear])
  const todayDay = new Date().getDate()
  const daysLeft = Math.max(1, monthDays - (selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear() ? todayDay : 0))
  const availableUntilMonthEnd = incomeTotal - expensesTotal
  const dailyBudget = availableUntilMonthEnd / daysLeft

  const topExpenseCategory = useMemo(() => {
    const monthExp = effectiveExpenses.filter((e) => inMonth(e.date, selectedMonth, selectedYear))
    const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, selectedMonth, selectedYear)
    const byCategory = new Map<string, number>()
    merged.forEach((row) => byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount))
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]
    if (!top) return { category: t('overview.noData'), amount: 0 }
    return { category: getLabel(top[0]), amount: top[1] }
  }, [effectiveExpenses, effectiveScheduled, selectedMonth, selectedYear, getLabel, t])

  const upcomingRecurring = useMemo(() => {
    const now = new Date()
    const currentDay = now.getDate()
    return effectiveScheduled
      .filter((s) => s.active && !s.endedAt)
      .map((s) => ({
        ...s,
        nextDay: s.dayOfMonth >= currentDay ? s.dayOfMonth : s.dayOfMonth,
        isNextMonth: s.dayOfMonth < currentDay,
      }))
      .sort((a, b) => a.nextDay - b.nextDay)
      .slice(0, 4)
  }, [effectiveScheduled])

  const categoriesForModal = finCats.map((c) => ({ id: c.id, name: c.name, label: c.label, color: c.color }))

  const handleTxSubmit = async (data: TransactionFormData) => {
    await submitTransaction(txType, data)
    setShowTxModal(false)
  }

  const handleRecurringSubmit = async (data: RecurringFormPayload) => {
    if (!useApiFinance && demoData) {
      demoData.addScheduledExpense({ ...data, active: true, pausedUntil: null, reminderDaysBefore: null })
    } else {
      await scheduledExpensesApi.create(data)
      await invalidateFinanceQueries(queryClient, userId)
    }
    setShowRecurringModal(false)
  }

  if (loading) {
    return <OverviewSkeleton />
  }

  const prevMonthName = monthNames[selectedMonth === 0 ? 11 : selectedMonth - 1]
  const currMonthName = monthNames[selectedMonth]
  const balanceDeltaZloty = currentTotal - previousTotal

  return (
    <motion.div
      className="space-y-5"
      variants={overviewPageContainerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={getOverviewTileVariants(reduceMotion, 0)} className="w-full min-w-0 sm:flex sm:justify-end">
        <MonthSelector />
      </motion.div>

      <motion.div variants={getOverviewTileVariants(reduceMotion, 2)} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card className="border-(--positive)/20" animateEntrance={false}>
          <p className="text-base text-(--text-muted)">{t('overview.income')}</p>
          <p className="mt-1 text-2xl font-bold font-display text-(--positive)">
            {formatPln(incomeTotal)}
          </p>
        </Card>
        <Card className="border-(--tx-expense)/20" animateEntrance={false}>
          <p className="text-base text-(--text-muted)">{t('overview.expenses')}</p>
          <p className="mt-1 text-2xl font-bold font-display text-(--tx-expense)">
            {formatPln(expensesTotal)}
          </p>
        </Card>
        <Card className={currentTotal >= 0 ? 'border-(--accent)/20' : 'border-[#e74c3c]/30'} animateEntrance={false}>
          <p className="text-base text-(--text-muted)">{t('overview.balance')}</p>
          <p
            className={`mt-1 text-2xl font-bold font-display ${
              currentTotal >= 0 ? 'text-(--accent)' : 'text-[#e74c3c]'
            }`}
          >
            {currentTotal >= 0 ? '+' : ''}{formatPln(currentTotal)}
          </p>
        </Card>
      </motion.div>

      <motion.div variants={getOverviewTileVariants(reduceMotion, 1)} className="min-w-0">
        <Card className="@container border-(--accent)/20 max-md:p-4 md:p-7!" animateEntrance={false}>
          <p className="mb-4 text-base text-(--text-muted) md:mb-6">{t('overview.monthlyTrend')}</p>
          <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-3 @3xl:gap-8">
            <div className="min-w-0 space-y-4 @3xl:border-r @3xl:border-(--border) @3xl:pr-8">
              <p className="text-sm font-semibold text-(--text-primary) font-display">{currMonthName}</p>
              <div>
                <p className="text-base text-(--text-muted)">{t('overview.balance')}</p>
                <p
                  className={`mt-1 text-2xl font-bold font-display tabular-nums @5xl:text-3xl ${
                    currentTotal >= 0 ? 'text-(--accent)' : 'text-[#e74c3c]'
                  }`}
                >
                  {currentTotal >= 0 ? '+' : ''}
                  {formatPln(currentTotal)}
                </p>
              </div>
              <dl className="space-y-3 border-t border-(--border) pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-(--text-muted)">{t('overview.income')}</dt>
                  <dd className="text-right text-lg font-semibold tabular-nums text-(--positive)">
                    {formatPln(currentIncomeForTrend)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-(--text-muted)">{t('overview.expenses')}</dt>
                  <dd className="text-right text-lg font-semibold tabular-nums text-(--tx-expense)">
                    {formatPln(currentExpensesForTrend)}
                  </dd>
                </div>
              </dl>
              <p className="md:hidden rounded-lg border border-(--border)/60 bg-(--bg-dark)/40 px-3 py-2 text-sm text-(--text-muted)">
                {t('overview.vsPrevMonth', { month: prevMonthName })}{' '}
                <span className={changePercent >= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'}>
                  {changePercent >= 0 ? '+' : ''}
                  {changePercent}%
                </span>{' '}
                ({balanceDeltaZloty >= 0 ? '+' : ''}
                {formatPln(balanceDeltaZloty)})
              </p>
            </div>
            <div className="hidden min-w-0 space-y-4 md:block @3xl:border-r @3xl:border-(--border) @3xl:pr-8">
              <p className="text-sm font-semibold text-(--text-primary) font-display">{prevMonthName}</p>
              <div>
                <p className="text-base text-(--text-muted)">{t('overview.balance')}</p>
                <p
                  className={`mt-1 text-2xl font-bold font-display tabular-nums @5xl:text-3xl ${
                    previousTotal >= 0 ? 'text-(--text-primary)' : 'text-[#e74c3c]'
                  }`}
                >
                  {previousTotal >= 0 ? '+' : ''}
                  {formatPln(previousTotal)}
                </p>
              </div>
              <dl className="space-y-3 border-t border-(--border) pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-(--text-muted)">{t('overview.income')}</dt>
                  <dd className="text-right text-lg font-semibold tabular-nums text-(--positive)">
                    {formatPln(previousIncomeForTrend)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-(--text-muted)">{t('overview.expenses')}</dt>
                  <dd className="text-right text-lg font-semibold tabular-nums text-(--tx-expense)">
                    {formatPln(previousExpensesForTrend)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="hidden min-w-0 space-y-4 md:block">
              <p className="text-sm font-semibold text-(--text-primary) font-display">{t('overview.comparison')}</p>
              <div>
                <p className="text-base text-(--text-muted)">{t('overview.balanceChange')}</p>
                <p
                  className={`mt-1 text-2xl font-bold font-display tabular-nums @5xl:text-3xl ${
                    changePercent >= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'
                  }`}
                >
                  {changePercent >= 0 ? '+' : ''}
                  {changePercent}%
                </p>
              </div>
              <dl className="space-y-3 border-t border-(--border) pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-(--text-muted)">{t('overview.differenceAmount')}</dt>
                  <dd
                    className={`text-right text-lg font-semibold tabular-nums font-display ${
                      balanceDeltaZloty >= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'
                    }`}
                  >
                    {balanceDeltaZloty >= 0 ? '+' : ''}
                    {formatPln(balanceDeltaZloty)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-(--text-muted)">{t('overview.incomeChange')}</dt>
                  <dd
                    className={`text-right text-base font-medium tabular-nums ${
                      currentIncomeForTrend - previousIncomeForTrend >= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'
                    }`}
                  >
                    {currentIncomeForTrend - previousIncomeForTrend >= 0 ? '+' : ''}
                    {formatPln((currentIncomeForTrend - previousIncomeForTrend))}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-(--text-muted)">{t('overview.expensesChange')}</dt>
                  <dd
                    className={`text-right text-base font-medium tabular-nums ${
                      currentExpensesForTrend - previousExpensesForTrend <= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'
                    }`}
                  >
                    {currentExpensesForTrend - previousExpensesForTrend >= 0 ? '+' : ''}
                    {formatPln((currentExpensesForTrend - previousExpensesForTrend))}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={getOverviewTileVariants(reduceMotion, 3)} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card className="border-(--accent)/20" animateEntrance={false}>
          <p className="text-base text-(--text-muted)">{t('overview.availableUntilMonthEnd')}</p>
          <p className={`text-2xl font-bold mt-1 font-display ${availableUntilMonthEnd >= 0 ? 'text-(--accent)' : 'text-[#e74c3c]'}`}>
            {formatPln(availableUntilMonthEnd)}
          </p>
        </Card>
        <Card className="border-(--warning)/20" animateEntrance={false}>
          <p className="text-base text-(--text-muted)">{t('overview.dailyBudget')}</p>
          <p className={`text-2xl font-bold mt-1 font-display ${dailyBudget >= 0 ? 'text-(--warning)' : 'text-[#e74c3c]'}`}>
            {formatPln(Math.round(dailyBudget))}
          </p>
        </Card>
        <Card className="border-(--tx-expense)/20" animateEntrance={false}>
          <p className="text-base text-(--text-muted)">{t('overview.topCategory')}</p>
          <p className="text-lg font-bold text-(--tx-expense) mt-1 font-display">{topExpenseCategory.category}</p>
          <p className="text-sm text-(--text-muted) mt-1">{formatPln(topExpenseCategory.amount)}</p>
        </Card>
      </motion.div>

      <motion.div variants={getOverviewTileVariants(reduceMotion, 4)} className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <Card className="border-(--warning)/20 max-md:p-4" animateEntrance={false}>
          <p className="mb-2 text-base text-(--text-muted)">{t('overview.upcomingRecurring')}</p>
          <div className="space-y-2">
            {upcomingRecurring.length === 0 && <p className="text-base text-(--text-muted)">{t('overview.noActiveRecurring')}</p>}
            {upcomingRecurring.map((item) => (
              <div key={item.id} className="flex flex-col gap-0.5 border-b border-(--border)/40 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-(--text-primary)">
                  {item.name} · {t('overview.dayOfMonth', { day: item.dayOfMonth })}
                  {item.isNextMonth ? ` ${t('overview.nextMonthSuffix')}` : ''}
                </span>
                <span className="font-mono text-sm tabular-nums text-(--warning)">
                  {formatPln(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-(--border) max-md:p-4 md:p-7!" animateEntrance={false}>
          <p className="mb-4 text-base text-(--text-muted) md:mb-5">{t('overview.quickActions')}</p>
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setTxType('expense')
                setShowTxModal(true)
              }}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-(--tx-expense)/40 bg-(--tx-expense)/15 px-3 py-2.5 text-sm font-medium text-(--tx-expense) sm:gap-1.5 sm:px-2 sm:py-2 sm:text-xs"
            >
              <Plus className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
              <span className="truncate">{t('overview.quickActionExpense')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTxType('income')
                setShowTxModal(true)
              }}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-(--positive)/40 bg-(--positive)/15 px-3 py-2.5 text-sm font-medium text-(--positive) sm:gap-1.5 sm:px-2 sm:py-2 sm:text-xs"
            >
              <Plus className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
              <span className="truncate">{t('overview.quickActionIncome')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRecurringModal(true)}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-(--warning)/40 bg-(--warning)/15 px-3 py-2.5 text-sm font-medium text-(--warning) sm:gap-1.5 sm:px-2 sm:py-2 sm:text-xs"
            >
              <Plus className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
              <span className="truncate">{t('overview.quickActionRecurring')}</span>
            </button>
          </div>
        </Card>
      </motion.div>

      <TransactionModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        onSubmit={handleTxSubmit}
        type={txType}
        categories={categoriesForModal}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
      />

      <RecurringModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onSubmit={handleRecurringSubmit}
        categories={categoriesForModal}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
      />
    </motion.div>
  )
}
