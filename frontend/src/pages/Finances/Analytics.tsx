import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/Card'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts'
import { CalendarDays, CreditCard, Info, PiggyBank, Receipt, UtensilsCrossed, Wallet } from 'lucide-react'
import type { PaymentMethod } from '../../lib/paymentMethod'
import type { LucideIcon } from 'lucide-react'
import { ChartPeriodSelector } from '../../components/ChartPeriodSelector'
import { useChartPeriod, getMonthsInQuarter } from '../../context/ChartPeriodContext'
import { useDemoData, DEMO_EXPENSES, DEMO_INCOME, DEMO_SCHEDULED_EXPENSES } from '../../context/DemoDataContext'
import { mergeExpensesWithScheduled, type MergedExpense } from '../../lib/expensesUtils'
import { useMonth, parseDate } from '../../context/MonthContext'
import { useFinanceCategories } from '../../context/FinanceCategoriesContext'
import { useFinanceListsQuery } from '../../hooks/useFinanceListsQuery'
import { useFinanceUsesApi } from '../../hooks/useFinanceUsesApi'
import { AnalyticsPageSkeleton } from '../../components/skeletons'
import { formatPln, formatPlnCompact, formatNumberPl } from '../../lib/currency'

function AnalyticsInsightTile({
  icon: Icon,
  eyebrow,
  body,
  accentBorder,
  iconClass,
}: {
  icon: LucideIcon
  eyebrow: string
  body: string
  accentBorder: string
  iconClass: string
}) {
  return (
    <div
      className={`rounded-xl border border-(--border) bg-(--bg-dark)/40 px-3 py-3 sm:px-4 sm:py-3.5 border-l-[3px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] ${accentBorder}`}
    >
      <div className="flex gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border)/70 bg-(--bg-card)/80"
          aria-hidden
        >
          <Icon className={`h-5 w-5 ${iconClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base text-(--text-muted) font-display mb-1">{eyebrow}</p>
          <p className="text-base text-(--text-primary) leading-snug">{body}</p>
        </div>
      </div>
    </div>
  )
}

function DonutTooltip(props: { active?: boolean; payload?: readonly unknown[]; total: number }) {
  const { active, payload, total } = props
  if (!active || !payload?.length) return null
  const item = payload[0] as { name?: string; value?: number; payload?: { kwota: number } } | undefined
  const kwota = item?.payload?.kwota ?? item?.value ?? 0
  const pct = total > 0 ? ((kwota / total) * 100).toFixed(0) : '0'
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <p className="font-medium text-base">{item?.name ?? ''}</p>
      <p className="text-sm text-(--accent)">
        {formatPln((item?.value ?? kwota ?? 0))} ({pct}%)
      </p>
    </div>
  )
}

export function Analytics() {
  const { t } = useTranslation('finances')
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 200 : 240
  const useApiFinance = useFinanceUsesApi()
  const { getColor } = useFinanceCategories()
  const demoData = useDemoData()
  const monthCtx = useMonth()
  const monthNames = t('analytics.monthShort', { returnObjects: true }) as string[]
  const dayNames = t('analytics.weekdayShort', { returnObjects: true }) as string[]
  const weekdayNarrative = t('analytics.weekdayNarrative', { returnObjects: true }) as string[]
  const {
    expenses: qExpenses,
    income: qIncome,
    scheduledExpenses: qScheduled,
    isLoading: financeLoading,
  } = useFinanceListsQuery()

  const selectedMonth = monthCtx?.selectedMonth ?? new Date().getMonth()
  const selectedYear = monthCtx?.selectedYear ?? new Date().getFullYear()
  const chartPeriod = useChartPeriod()

  const effectiveExpenses = useApiFinance ? qExpenses : (demoData?.expenses ?? DEMO_EXPENSES)
  const effectiveScheduled = useApiFinance ? qScheduled : (demoData?.scheduledExpenses ?? DEMO_SCHEDULED_EXPENSES)
  const effectiveIncome = useApiFinance ? qIncome : (demoData?.income ?? DEMO_INCOME)
  const loading = useApiFinance ? financeLoading : false

  type ChartRow = {
    label: string
    wydatki: number
    przychody: number
    bilans: number
    bilansNarastająco: number
  }

  const chartData = useMemo(() => {
    const chart: { label: string; wydatki: number; przychody: number; bilans: number }[] = []
    if (chartPeriod?.period.type === 'quarter') {
      const { quarter, year } = chartPeriod.period
      const months = getMonthsInQuarter(quarter, year)
      for (const { month: m, year: y } of months) {
        const monthExpenses = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === y
        })
        const merged = mergeExpensesWithScheduled(monthExpenses, effectiveScheduled, m, y)
        const wydatki = merged.reduce((s, e) => s + e.amount, 0)
        const przychody = effectiveIncome
          .filter((i) => {
            const { year: iy, month: im } = parseDate(i.date)
            return im === m && iy === y
          })
          .reduce((s, i) => s + i.amount, 0)
        chart.push({ label: `${monthNames[m]} ${y}`, wydatki, przychody, bilans: przychody - wydatki })
      }
    } else if (chartPeriod?.period.type === 'month') {
      const m = chartPeriod.period.month
      const y = chartPeriod.period.year
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const monthExpenses = effectiveExpenses.filter((e) => {
        const { year: ey, month: em } = parseDate(e.date)
        return em === m && ey === y
      })
      const merged = mergeExpensesWithScheduled(monthExpenses, effectiveScheduled, m, y)
      const monthIncome = effectiveIncome.filter((i) => {
        const { year: iy, month: im } = parseDate(i.date)
        return im === m && iy === y
      })
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const wydatki = merged.filter((e) => e.date === dayStr).reduce((s, e) => s + e.amount, 0)
        const przychody = monthIncome.filter((i) => i.date === dayStr).reduce((s, i) => s + i.amount, 0)
        chart.push({ label: String(d), wydatki, przychody, bilans: przychody - wydatki })
      }
    } else if (chartPeriod?.period.type === 'year') {
      const y = chartPeriod.period.year
      for (let m = 0; m < 12; m++) {
        const monthExpenses = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === y
        })
        const merged = mergeExpensesWithScheduled(monthExpenses, effectiveScheduled, m, y)
        const wydatki = merged.reduce((s, e) => s + e.amount, 0)
        const przychody = effectiveIncome
          .filter((i) => {
            const { year: iy, month: im } = parseDate(i.date)
            return im === m && iy === y
          })
          .reduce((s, i) => s + i.amount, 0)
        chart.push({ label: monthNames[m], wydatki, przychody, bilans: przychody - wydatki })
      }
    } else {
      const baseMonth = selectedMonth
      const baseYear = selectedYear
      for (let i = 4; i >= 0; i--) {
        const d = new Date(baseYear, baseMonth - i, 1)
        const mo = d.getMonth()
        const yr = d.getFullYear()
        const monthExpenses = effectiveExpenses.filter((e) => {
          const { year, month } = parseDate(e.date)
          return month === mo && year === yr
        })
        const merged = mergeExpensesWithScheduled(monthExpenses, effectiveScheduled, mo, yr)
        const wydatki = merged.reduce((s, e) => s + e.amount, 0)
        const przychody = effectiveIncome
          .filter((i) => {
            const { year, month } = parseDate(i.date)
            return month === mo && year === yr
          })
          .reduce((s, i) => s + i.amount, 0)
        chart.push({ label: `${monthNames[mo]} ${yr}`, wydatki, przychody, bilans: przychody - wydatki })
      }
    }
    let cum = 0
    return chart.map((row) => {
      cum += row.bilans
      return { ...row, bilansNarastająco: cum }
    }) as ChartRow[]
  }, [effectiveExpenses, effectiveScheduled, effectiveIncome, selectedMonth, selectedYear, chartPeriod, monthNames])

  const chartMonth = chartPeriod?.period.type === 'month' ? chartPeriod.period.month : selectedMonth
  const chartYear = chartPeriod?.period.type === 'month' ? chartPeriod.period.year : chartPeriod?.period.type === 'quarter' ? chartPeriod.period.year : chartPeriod?.period.type === 'year' ? chartPeriod.period.year : selectedYear

  const weekdayData = useMemo(() => {
    const byDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    if (chartPeriod?.period.type === 'quarter') {
      const { quarter, year } = chartPeriod.period
      const months = getMonthsInQuarter(quarter, year)
      for (const { month: m, year: y } of months) {
        const monthExp = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === y
        })
        const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, y)
        merged.forEach((e) => {
          const [ey, em, ed] = e.date.split('-').map(Number)
          const dayOfWeek = new Date(ey, em - 1, ed).getDay()
          byDay[dayOfWeek] = (byDay[dayOfWeek] || 0) + e.amount
        })
      }
    } else if (chartPeriod?.period.type === 'year') {
      const { year } = chartPeriod.period
      for (let m = 0; m < 12; m++) {
        const monthExp = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === year
        })
        const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, year)
        merged.forEach((e) => {
          const [ey, em, ed] = e.date.split('-').map(Number)
          const dayOfWeek = new Date(ey, em - 1, ed).getDay()
          byDay[dayOfWeek] = (byDay[dayOfWeek] || 0) + e.amount
        })
      }
    } else {
      const monthExp = effectiveExpenses.filter((e) => {
        const { year, month } = parseDate(e.date)
        return month === chartMonth && year === chartYear
      })
      const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, chartMonth, chartYear)
      merged.forEach((e) => {
        const [y, m, d] = e.date.split('-').map(Number)
        const dayOfWeek = new Date(y, m - 1, d).getDay()
        byDay[dayOfWeek] = (byDay[dayOfWeek] || 0) + e.amount
      })
    }
    return dayNames.map((name, i) => ({ dzień: name, kwota: byDay[i] ?? 0, idx: i }))
  }, [effectiveExpenses, effectiveScheduled, chartMonth, chartYear, chartPeriod, dayNames])

  const topExpenses = useMemo(() => {
    let mergedList: MergedExpense[]
    if (chartPeriod?.period.type === 'quarter' || chartPeriod?.period.type === 'year') {
      const months =
        chartPeriod.period.type === 'quarter'
          ? getMonthsInQuarter(chartPeriod.period.quarter, chartPeriod.period.year)
          : Array.from({ length: 12 }, (_, m) => ({ month: m, year: chartPeriod.period.year }))
      const allExp: MergedExpense[] = []
      for (const { month: m, year: y } of months) {
        const monthExp = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === y
        })
        allExp.push(...mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, y))
      }
      mergedList = allExp
    } else {
      const monthExp = effectiveExpenses.filter((e) => {
        const { year, month } = parseDate(e.date)
        return month === chartMonth && year === chartYear
      })
      mergedList = mergeExpensesWithScheduled(monthExp, effectiveScheduled, chartMonth, chartYear)
    }

    const byName = new Map<string, { sum: number; displayName: string }>()
    for (const e of mergedList) {
      const key = e.name.trim().toLowerCase()
      const prev = byName.get(key)
      if (prev) {
        prev.sum += e.amount
      } else {
        byName.set(key, { sum: e.amount, displayName: e.name.trim() })
      }
    }

    return [...byName.values()]
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 10)
      .map(({ sum, displayName }) => ({
        nazwa: displayName.length > 12 ? displayName.slice(0, 12) + '…' : displayName,
        kwota: sum,
        fullName: displayName,
      }))
  }, [effectiveExpenses, effectiveScheduled, chartMonth, chartYear, chartPeriod])

  const { categoryData, expensesTotal } = useMemo(() => {
    if (chartPeriod?.period.type === 'quarter' || chartPeriod?.period.type === 'year') {
      const months = chartPeriod.period.type === 'quarter'
        ? getMonthsInQuarter(chartPeriod.period.quarter, chartPeriod.period.year)
        : Array.from({ length: 12 }, (_, m) => ({ month: m, year: chartPeriod.period.year }))
      const byCategory: Record<string, number> = {}
      let total = 0
      for (const { month: m, year: y } of months) {
        const monthExp = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === y
        })
        const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, y)
        merged.forEach((e) => {
          byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
        })
        total += merged.reduce((s, e) => s + e.amount, 0)
      }
      return {
        categoryData: Object.entries(byCategory).map(([kategoria, kwota]) => ({ kategoria, kwota })),
        expensesTotal: total,
      }
    }
    const monthExp = effectiveExpenses.filter((e) => {
      const { year, month } = parseDate(e.date)
      return month === chartMonth && year === chartYear
    })
    const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, chartMonth, chartYear)
    const byCategory: Record<string, number> = {}
    merged.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
    })
    const categoryData = Object.entries(byCategory).map(([kategoria, kwota]) => ({ kategoria, kwota }))
    const expensesTotal = merged.reduce((s, e) => s + e.amount, 0)
    return { categoryData, expensesTotal }
  }, [effectiveExpenses, effectiveScheduled, chartMonth, chartYear, chartPeriod])

  const paymentBreakdown = useMemo(() => {
    type Row = { amount: number; paymentMethod?: PaymentMethod | null }

    const filterByPeriod = <T extends { date: string }>(rows: T[]): T[] => {
      if (chartPeriod?.period.type === 'quarter') {
        const months = getMonthsInQuarter(chartPeriod.period.quarter, chartPeriod.period.year)
        return rows.filter((row) => {
          const { year, month } = parseDate(row.date)
          return months.some((m) => m.month === month && m.year === year)
        })
      }
      if (chartPeriod?.period.type === 'year') {
        return rows.filter((row) => parseDate(row.date).year === chartPeriod.period.year)
      }
      return rows.filter((row) => {
        const { year, month } = parseDate(row.date)
        return month === chartMonth && year === chartYear
      })
    }

    const sumByMethod = (rows: Row[], method: PaymentMethod) =>
      rows.filter((r) => r.paymentMethod === method).reduce((s, r) => s + r.amount, 0)

    const periodExpenses = filterByPeriod(effectiveExpenses)
    const periodIncome = filterByPeriod(effectiveIncome)

    return {
      expenseCard: sumByMethod(periodExpenses, 'card'),
      expenseCash: sumByMethod(periodExpenses, 'cash'),
      incomeCard: sumByMethod(periodIncome, 'card'),
      incomeCash: sumByMethod(periodIncome, 'cash'),
      labeledCount:
        periodExpenses.filter((e) => e.paymentMethod).length +
        periodIncome.filter((i) => i.paymentMethod).length,
    }
  }, [effectiveExpenses, effectiveIncome, chartMonth, chartYear, chartPeriod])

  const insights = useMemo(() => {
    const monthExp = effectiveExpenses.filter((e) => {
      const { year, month } = parseDate(e.date)
      return month === chartMonth && year === chartYear
    })
    const prevMonth = chartMonth === 0 ? 11 : chartMonth - 1
    const prevYear = chartMonth === 0 ? chartYear - 1 : chartYear
    const prevExp = effectiveExpenses.filter((e) => {
      const { year, month } = parseDate(e.date)
      return month === prevMonth && year === prevYear
    })
    const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, chartMonth, chartYear)
    const mergedPrev = mergeExpensesWithScheduled(prevExp, effectiveScheduled, prevMonth, prevYear)
    const getCategorySum = (rows: typeof merged, category: string) =>
      rows.filter((r) => r.category.toLowerCase() === category.toLowerCase()).reduce((s, r) => s + r.amount, 0)

    const foodNow = getCategorySum(merged, 'Jedzenie')
    const foodPrev = getCategorySum(mergedPrev, 'Jedzenie')
    const foodChangePct = foodPrev > 0 ? ((foodNow - foodPrev) / foodPrev) * 100 : 0
    const biggestExpense = [...merged].sort((a, b) => b.amount - a.amount)[0]
    const topWeekday = [...weekdayData].sort((a, b) => b.kwota - a.kwota)[0]
    const totalIncome = effectiveIncome
      .filter((i) => {
        const { year, month } = parseDate(i.date)
        return month === chartMonth && year === chartYear
      })
      .reduce((s, i) => s + i.amount, 0)
    const fixedCosts = effectiveScheduled.filter((s) => s.active && !s.endedAt).reduce((s, item) => s + item.amount, 0)
    const fixedShare = totalIncome > 0 ? (fixedCosts / totalIncome) * 100 : 0

    let foodLine: string
    if (foodNow === 0 && foodPrev === 0) {
      foodLine = t('analytics.foodNoData')
    } else if (foodPrev <= 0 && foodNow > 0) {
      foodLine = t('analytics.foodThisMonthOnly', { amount: formatNumberPl(foodNow) })
    } else if (foodPrev > 0) {
      const absPct = Math.abs(foodChangePct)
      if (absPct < 0.5) {
        foodLine = t('analytics.foodSimilar')
      } else if (foodChangePct > 0) {
        foodLine = t('analytics.foodIncrease', { pct: absPct.toFixed(0) })
      } else {
        foodLine = t('analytics.foodDecrease', { pct: absPct.toFixed(0) })
      }
    } else {
      foodLine = t('analytics.foodPrevOnly')
    }

    const biggestLine = biggestExpense
      ? t('analytics.biggestLine', { name: biggestExpense.name, amount: formatNumberPl(biggestExpense.amount) })
      : t('analytics.biggestLineEmpty')

    const weekdayLine =
      topWeekday && topWeekday.kwota > 0
        ? t('analytics.weekdayLine', {
            weekday: weekdayNarrative[topWeekday.idx] ?? topWeekday.dzień,
            amount: formatNumberPl(topWeekday.kwota),
          })
        : t('analytics.weekdayLineEmpty')

    const fixedLine =
      totalIncome <= 0
        ? t('analytics.fixedLineNoIncome')
        : t('analytics.fixedLine', {
            fixed: formatNumberPl(fixedCosts),
            pct: fixedShare.toFixed(0),
            income: formatNumberPl(totalIncome),
          })

    return {
      foodLine,
      biggestLine,
      weekdayLine,
      fixedLine,
    }
  }, [effectiveExpenses, effectiveScheduled, effectiveIncome, chartMonth, chartYear, weekdayData, t, weekdayNarrative])

  if (loading) {
    return <AnalyticsPageSkeleton />
  }

  return (
    <div className="space-y-5">
      <div className="flex w-full min-w-0">
        {chartPeriod && <ChartPeriodSelector leadingLabel={t('analytics.periodLabel')} />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <Card title={t('analytics.insightsTitle')} className="border-(--accent)/20 lg:col-span-2 max-md:p-4">
          <p className="mb-4 text-base text-(--text-muted)">
            {isMobile
              ? t('analytics.insightsDescMobile')
              : t('analytics.insightsDescDesktop')
            }
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AnalyticsInsightTile
              icon={UtensilsCrossed}
              eyebrow={t('analytics.foodCategoryEyebrow')}
              body={insights.foodLine}
              accentBorder="border-l-(--warning)/65"
              iconClass="text-(--warning)"
            />
            <AnalyticsInsightTile
              icon={Receipt}
              eyebrow={t('analytics.biggestExpenseEyebrow')}
              body={insights.biggestLine}
              accentBorder="border-l-(--tx-expense)/60"
              iconClass="text-(--tx-expense)"
            />
            <AnalyticsInsightTile
              icon={CalendarDays}
              eyebrow={t('analytics.weekdayEyebrow')}
              body={insights.weekdayLine}
              accentBorder="border-l-(--accent)/60"
              iconClass="text-(--accent)"
            />
            <AnalyticsInsightTile
              icon={PiggyBank}
              eyebrow={t('analytics.fixedCostsEyebrow')}
              body={insights.fixedLine}
              accentBorder="border-l-(--positive)/55"
              iconClass="text-(--positive)"
            />
          </div>
        </Card>

        <Card title={t('analytics.cardVsCashTitle')} className="border-(--accent)/20 lg:col-span-2 max-md:p-4">
          <p className="mb-4 text-base text-(--text-muted)">
            {t('analytics.cardVsCashDesc')}
          </p>
          {paymentBreakdown.labeledCount === 0 ? (
            <p className="text-base text-(--text-muted)">
              {t('analytics.noLabeledTransactions')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AnalyticsInsightTile
                icon={CreditCard}
                eyebrow={t('analytics.expensesEyebrow', { method: t('transactions.card').toLowerCase() })}
                body={`${formatPln(paymentBreakdown.expenseCard)}`}
                accentBorder="border-l-(--tx-expense)/60"
                iconClass="text-(--tx-expense)"
              />
              <AnalyticsInsightTile
                icon={Wallet}
                eyebrow={t('analytics.expensesEyebrow', { method: t('transactions.cash').toLowerCase() })}
                body={`${formatPln(paymentBreakdown.expenseCash)}`}
                accentBorder="border-l-(--tx-expense)/40"
                iconClass="text-(--tx-expense)"
              />
              <AnalyticsInsightTile
                icon={CreditCard}
                eyebrow={t('analytics.incomeEyebrow', { method: t('transactions.card').toLowerCase() })}
                body={`${formatPln(paymentBreakdown.incomeCard)}`}
                accentBorder="border-l-(--positive)/55"
                iconClass="text-(--positive)"
              />
              <AnalyticsInsightTile
                icon={Wallet}
                eyebrow={t('analytics.incomeEyebrow', { method: t('transactions.cash').toLowerCase() })}
                body={`${formatPln(paymentBreakdown.incomeCash)}`}
                accentBorder="border-l-(--positive)/35"
                iconClass="text-(--positive)"
              />
            </div>
          )}
        </Card>

        <Card title={t('analytics.trendTitle')} className="max-md:p-4">
          <div className="chart-shell h-[200px] w-full min-h-[200px] sm:h-60">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorWydatki" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c98a9b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#c98a9b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPrzychody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#63b28f" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#63b28f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: isMobile ? 11 : 12 }} />
                {!isMobile && <YAxis stroke="var(--text-muted)" width={76} tickFormatter={(v: number) => formatPlnCompact(v)} />}
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined) => [value != null ? formatPln(value) : '', '']}
                />
                {!isMobile && <Legend />}
                <Area type="monotone" dataKey="wydatki" stroke="#c98a9b" strokeWidth={2} fillOpacity={1} fill="url(#colorWydatki)" name={t('overview.expenses')} activeDot={false} />
                <Area type="monotone" dataKey="przychody" stroke="#63b28f" strokeWidth={2} fillOpacity={1} fill="url(#colorPrzychody)" name={t('overview.income')} activeDot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('analytics.categoryChartTitle', {
          period: chartPeriod?.period.type === 'quarter'
            ? t('analytics.quarterPeriod', { quarter: chartPeriod.period.quarter, year: chartPeriod.period.year })
            : chartPeriod?.period.type === 'year'
              ? chartPeriod.period.year
              : `${monthNames[chartMonth]} ${chartYear}`
        })} className="max-md:p-4">
          <div className="chart-shell relative h-[220px] w-full min-h-[200px] sm:h-60">
            {categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={isMobile ? 220 : chartHeight}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="kwota"
                      nameKey="kategoria"
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 52 : 72}
                      outerRadius={isMobile ? 78 : 95}
                      paddingAngle={2}
                      stroke="var(--bg-card)"
                      strokeWidth={2}
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.kategoria} fill={getColor(entry.kategoria)} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => (
                        <DonutTooltip active={active} payload={payload} total={expensesTotal} />
                      )}
                      offset={70}
                    />
                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: '8px', fontSize: isMobile ? 11 : 12 }}
                      formatter={(value) => (
                        <span className="text-(--text-primary) text-sm font-medium">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-24 text-center">
                    <p className="text-base font-bold leading-tight text-(--accent) font-display sm:text-lg">
                      {formatPln(expensesTotal)}
                    </p>
                    <p className="mt-0.5 text-xs text-(--text-muted)">{t('analytics.totalShort')}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-base text-(--text-muted)">
                {t('analytics.noExpensesThisMonth')}
              </div>
            )}
          </div>
        </Card>

        <Card title={t('analytics.savingsTrendTitle')} className="max-md:p-4">
          <div className="mb-1 inline-flex items-center gap-1 text-sm text-(--text-muted)">
            <Info className="h-3.5 w-3.5" />
            <span title={t('analytics.savingsTrendTooltipTitle')}>{t('analytics.cumulativeBalanceOverTime')}</span>
          </div>
          <div className="chart-shell h-[200px] w-full min-h-[200px] sm:h-60">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBilans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82a7cf" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#82a7cf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: isMobile ? 11 : 12 }} />
                {!isMobile && <YAxis stroke="var(--text-muted)" width={76} tickFormatter={(v: number) => formatPlnCompact(v)} />}
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined, _n, item) => {
                    const raw = item as { payload?: ChartRow } | ChartRow | undefined
                    const payload =
                      raw && typeof raw === 'object' && 'payload' in raw && raw.payload
                        ? raw.payload
                        : (raw as ChartRow | undefined)
                    const okresowy = payload?.bilans
                    const suffix =
                      okresowy != null
                        ? t('analytics.inPeriod', { amount: `${okresowy >= 0 ? '+' : ''}${formatNumberPl(okresowy)}` })
                        : ''
                    return [value != null ? `${formatPln(value)}${suffix}` : '', t('analytics.cumulativeBalance')]
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bilansNarastająco"
                  stroke="#82a7cf"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBilans)"
                  name={t('analytics.cumulativeBalance')}
                  baseValue={0}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('analytics.weekdayChartTitle')} className="max-md:p-4">
          <p className="mb-1 text-sm text-(--text-muted)">
            {chartPeriod?.period.type === 'quarter' ? t('analytics.quarterPeriod', { quarter: chartPeriod.period.quarter, year: chartPeriod.period.year }) : chartPeriod?.period.type === 'year' ? chartPeriod.period.year : `${monthNames[chartMonth]} ${chartYear}`}
          </p>
          <div className="chart-shell h-[200px] w-full min-h-[200px] sm:h-60">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={weekdayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dzień" stroke="var(--text-muted)" />
                {!isMobile && <YAxis stroke="var(--text-muted)" width={76} tickFormatter={(v: number) => formatPlnCompact(v)} />}
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined) => [value != null ? formatPln(value) : '', t('overview.expenses')]}
                />
                <Bar dataKey="kwota" fill="#c98a9b" fillOpacity={0.8} radius={[4, 4, 0, 0]} name={t('overview.expenses')} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('analytics.top10Title')} className="max-md:p-4">
          <p className="mb-2 text-base text-(--text-muted)">
            {chartPeriod?.period.type === 'quarter' ? t('analytics.quarterPeriod', { quarter: chartPeriod.period.quarter, year: chartPeriod.period.year }) : chartPeriod?.period.type === 'year' ? chartPeriod.period.year : `${monthNames[chartMonth]} ${chartYear}`}
            {!isMobile && t('analytics.top10SameNamesNote')}
          </p>
          {topExpenses.length > 0 ? (
            isMobile ? (
              <ul className="space-y-2">
                {topExpenses.map((row) => (
                  <li
                    key={row.nazwa}
                    className="flex items-center justify-between gap-3 border-b border-(--border)/40 py-2 last:border-0"
                  >
                    <span className="min-w-0 truncate text-sm text-(--text-primary)">{row.fullName ?? row.nazwa}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-(--tx-expense)">
                      {formatPln(row.kwota)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
            <div className="chart-shell h-60 w-full min-h-[200px]">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={topExpenses} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" tickFormatter={(v: number) => formatPlnCompact(v)} />
                  <YAxis type="category" dataKey="nazwa" stroke="var(--text-muted)" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number | undefined, _name?: string, props?: { payload?: { fullName: string } }) => [
                      value != null ? formatPln(value) : '',
                      props?.payload?.fullName ?? '',
                    ]}
                    labelFormatter={() => ''}
                  />
                  <Bar dataKey="kwota" fill="#c98a9b" fillOpacity={0.8} radius={[0, 4, 4, 0]} name={t('transactions.colAmount')} activeBar={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )
          ) : (
            <div className="flex justify-center items-center h-48 text-base text-(--text-muted)">
              {t('analytics.noExpensesThisMonth')}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
