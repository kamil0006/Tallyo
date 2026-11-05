import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../components/Card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { motion, useReducedMotion } from 'framer-motion'
import { dashboardContainerVariants, getDashboardTileVariants } from '../lib/dashboardMotion'
import { useNavigate } from 'react-router-dom'
import { useFinanceCategories } from '../context/FinanceCategoriesContext'
import { useDemoData, DEMO_EXPENSES, DEMO_INCOME, DEMO_SCHEDULED_EXPENSES } from '../context/DemoDataContext'
import { useMonth } from '../context/MonthContext'
import { useEvents } from '../context/EventsContext'
import { useTodos } from '../context/TodosContext'
import { useHabits } from '../context/HabitsContext'
import { useNotes } from '../context/NotesContext'
import { MonthSelector } from '../components/MonthSelector'
import { ChartPeriodSelector } from '../components/ChartPeriodSelector'
import { useChartPeriod } from '../context/ChartPeriodContext'
import { useFinanceListsQuery } from '../hooks/useFinanceListsQuery'
import { useFinanceUsesApi } from '../hooks/useFinanceUsesApi'
import { useDashboardFinance } from '../hooks/useDashboardFinance'
import { DashboardSkeleton } from '../components/skeletons'
import { buildTransactionsDrilldownSearch } from '../lib/buildDrilldownSearch'
import { DashboardQuickStats } from '../components/dashboard/DashboardQuickStats'
import { DashboardQuickLinks } from '../components/dashboard/DashboardQuickLinks'
import { AiWeeklyReport } from '../components/dashboard/AiWeeklyReport'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatPln, formatPlnCompact, formatNumberPl, formatNumberCompactPl } from '../lib/currency'

function DonutTooltip(props: { active?: boolean; payload?: readonly unknown[]; total: number }) {
  const { active, payload, total } = props
  if (!active || !payload?.length) return null
  const item = payload[0] as { name?: string; value?: number; payload?: { kwota: number } } | undefined
  const kwota = item?.payload?.kwota ?? item?.value ?? 0
  const pct = total > 0 ? ((kwota / total) * 100).toFixed(0) : '0'
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: '#0f0f18',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <p className="font-medium text-base">{item?.name ?? ''}</p>
      <p className="text-sm text-(--accent)">
        {formatPln((item?.value ?? kwota ?? 0))} ({pct}%)
      </p>
    </motion.div>
  )
}

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth()


/** KPI tile amount: font scales with the tile width, so big sums never overflow
 *  or break mid-number. Phones show whole złoty to keep it readable. */
function KpiAmount({ value, sign = false }: { value: number; sign?: boolean }) {
  const prefix = sign && Math.round(value * 100) > 0 ? '+' : ''
  const short = Math.abs(value) >= 1_000_000 ? formatNumberCompactPl(value) : formatNumberPl(Math.round(value))
  return (
    <span className="block tabular-nums">
      <span className="whitespace-nowrap text-[clamp(0.8rem,18cqi,1rem)] sm:hidden">{prefix}{short}</span>
      <span className="hidden whitespace-nowrap text-[clamp(0.75rem,15cqi,1.5rem)] sm:inline">{prefix}{formatNumberPl(value)}</span>{' '}
      <span className="whitespace-nowrap text-xs sm:text-base">zł</span>
    </span>
  )
}

export function Dashboard() {
  const { t, i18n } = useTranslation('dashboard')
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const useApiFinance = useFinanceUsesApi()
  const monthNames = useMemo(() => {
    const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'
    return Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleDateString(locale, { month: 'short' }))
  }, [i18n.language])
  const demoData = useDemoData()
  const { getColor: getCategoryColor } = useFinanceCategories()
  const {
    expenses: qExpenses,
    income: qIncome,
    scheduledExpenses: qScheduled,
    isLoading: financeLoading,
  } = useFinanceListsQuery()
  const monthCtx = useMonth()
  const { todos, loading: todosLoading } = useTodos()
  const { habits, goals } = useHabits()
  const notesCtx = useNotes()
  const isMobile = useIsMobile()

  const notesCount = notesCtx?.notes.filter((n) => !n.archivedAt).length ?? 0
  const todoCount = todosLoading ? 0 : todos.filter((t) => !t.done).length
  const selectedMonth = monthCtx?.selectedMonth ?? currentMonth
  const selectedYear = monthCtx?.selectedYear ?? currentYear
  const chartPeriod = useChartPeriod()
  const { events } = useEvents()

  const effectiveExpenses = useApiFinance ? qExpenses : (demoData?.expenses ?? DEMO_EXPENSES)
  const effectiveScheduled = useApiFinance ? qScheduled : (demoData?.scheduledExpenses ?? DEMO_SCHEDULED_EXPENSES)
  const effectiveIncome = useApiFinance ? qIncome : (demoData?.income ?? DEMO_INCOME)
  const loading = useApiFinance ? financeLoading : false

  const { chartFilteredData, kpiPeriodLabel, emptyCategoryPeriod, chartData } = useDashboardFinance(
    effectiveExpenses,
    effectiveScheduled,
    effectiveIncome,
    selectedMonth,
    selectedYear,
    chartPeriod,
    i18n.language
  )

  const emptyCategoryMessage =
    emptyCategoryPeriod.type === 'year'
      ? t('emptyExpensesYear', { year: emptyCategoryPeriod.year })
      : emptyCategoryPeriod.type === 'quarter'
        ? t('emptyExpensesQuarter', { quarter: emptyCategoryPeriod.quarter, year: emptyCategoryPeriod.year })
        : emptyCategoryPeriod.type === 'month'
          ? t('emptyExpensesMonth', { month: emptyCategoryPeriod.month, year: emptyCategoryPeriod.year })
          : t('emptyExpensesDefault')

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return events
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
  }, [events])

  const todayStr = new Date().toISOString().split('T')[0]
  const habitsToday = useMemo(() => {
    const total = habits.length
    const done = habits.filter((h) => h.checkIns.some((c) => c.date === todayStr)).length
    return { done, total }
  }, [habits, todayStr])

  const handleCategoryPieClick = (data: unknown) => {
    if (!data || typeof data !== 'object') return
    const d = data as Record<string, unknown>
    // Recharts v3 spreads original data fields to top level; v2 put them in payload
    const kategoria =
      (typeof d.kategoria === 'string' ? d.kategoria : undefined) ??
      (d.payload && typeof d.payload === 'object' && typeof (d.payload as Record<string, unknown>).kategoria === 'string'
        ? (d.payload as Record<string, unknown>).kategoria as string
        : undefined) ??
      (typeof d.name === 'string' ? d.name : undefined)
    if (!kategoria) return
    const qs = buildTransactionsDrilldownSearch(
      kategoria,
      chartPeriod,
      selectedMonth,
      selectedYear
    )
    navigate(`/finances/transactions?${qs}`)
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <motion.div
      className="space-y-6 lg:space-y-10"
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={getDashboardTileVariants(reduceMotion, 0)}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-(--text-primary) font-display tracking-wider">
            {t('title')}
          </h1>
          <p className="text-sm sm:text-base text-(--text-muted) mt-1 font-display tracking-wide">
            {!useApiFinance ? t('demoData') : t('subtitle')}
          </p>
        </div>
        <MonthSelector />
      </motion.div>

      {/* KPI cards – always 3 side by side */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <motion.div variants={getDashboardTileVariants(reduceMotion, 1)} className="min-w-0">
          <Card
            animateEntrance={false}
            className="border-(--positive)/20 max-md:p-4 hover:border-(--positive)/40"
          >
            <p className="truncate text-sm text-(--text-muted) font-display">{t('income')}</p>
            <p className="truncate text-sm text-(--text-muted) font-display">{kpiPeriodLabel}</p>
            <p className="@container mt-1 font-bold font-display leading-tight text-(--positive)">
              <KpiAmount value={chartFilteredData.incomeTotal} />
            </p>
          </Card>
        </motion.div>
        <motion.div variants={getDashboardTileVariants(reduceMotion, 2)} className="min-w-0">
          <Card
            animateEntrance={false}
            className="border-(--tx-expense)/20 max-md:p-4 hover:border-(--tx-expense)/40"
          >
            <p className="truncate text-sm text-(--text-muted) font-display">{t('expenses')}</p>
            <p className="truncate text-sm text-(--text-muted) font-display">{kpiPeriodLabel}</p>
            <p className="@container mt-1 font-bold font-display leading-tight text-(--tx-expense)">
              <KpiAmount value={chartFilteredData.expensesTotal} />
            </p>
          </Card>
        </motion.div>
        <motion.div variants={getDashboardTileVariants(reduceMotion, 3)} className="min-w-0">
          <Card
            animateEntrance={false}
            className={`max-md:p-4 ${
              chartFilteredData.balance >= 0
                ? 'border-(--accent)/20 hover:border-(--accent)/40'
                : 'border-[#e74c3c]/30 hover:border-[#e74c3c]/50'
            }`}
          >
            <p className="truncate text-sm text-(--text-muted) font-display">{t('balance')}</p>
            <p className="truncate text-sm text-(--text-muted) font-display">{kpiPeriodLabel}</p>
            <p
              className={`@container mt-1 font-bold font-display leading-tight ${
                chartFilteredData.balance >= 0
                  ? 'text-(--accent)'
                  : 'text-[#e74c3c]'
              }`}
            >
              <KpiAmount value={chartFilteredData.balance} sign />
            </p>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <motion.div variants={getDashboardTileVariants(reduceMotion, 4)} className="min-w-0 flex">
          <Card
            animateEntrance={false}
            className="flex h-full min-h-0 w-full flex-col max-md:p-4"
            title={t('expensesVsIncome')}
            action={chartPeriod ? <ChartPeriodSelector /> : undefined}
          >
          <div className="flex min-h-0 w-full flex-1 flex-col justify-end">
            <div className="w-full shrink-0 h-[200px] sm:h-[280px] [&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 6, right: isMobile ? 4 : 8, bottom: 10, left: isMobile ? 0 : 4 }}
              >
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
                <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: isMobile ? 10 : 12 }} />
                {!isMobile && (
                  <YAxis stroke="var(--text-muted)" width={76} tickFormatter={(v: number) => formatPlnCompact(v)} />
                )}
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined) => [value != null ? formatPln(value) : '', '']}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="wydatki"
                  stroke="#c98a9b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWydatki)"
                  name={t('expenses')}
                />
                <Area
                  type="monotone"
                  dataKey="przychody"
                  stroke="#63b28f"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPrzychody)"
                  name={t('income')}
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
        </Card>
        </motion.div>
        <motion.div variants={getDashboardTileVariants(reduceMotion, 5)} className="min-w-0 flex">
          <Card
            animateEntrance={false}
            className="flex h-full min-h-0 w-full flex-col max-md:p-4"
            title={t('expensesByCategory', {
              period:
                chartPeriod?.period.type === 'quarter'
                  ? `Q${chartPeriod.period.quarter} ${chartPeriod.period.year}`
                  : chartPeriod?.period.type === 'year'
                    ? chartPeriod.period.year
                    : chartPeriod?.period.type === 'month'
                      ? `${monthNames[chartPeriod.period.month]} ${chartPeriod.period.year}`
                      : `${monthNames[selectedMonth]} ${selectedYear}`,
            })}
          action={chartPeriod ? <ChartPeriodSelector /> : undefined}
        >
          {!isMobile && (
            <p className="mb-3 shrink-0 text-sm text-(--text-muted) font-display tracking-wide">
              {t('clickCategoryHint')}
            </p>
          )}
          <div className="relative w-full shrink-0 h-[200px] sm:h-[280px] [&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
            {chartFilteredData.categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                  <Pie
                    data={chartFilteredData.categoryData}
                    dataKey="kwota"
                    nameKey="kategoria"
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 52 : 72}
                    outerRadius={isMobile ? 72 : 95}
                    paddingAngle={2}
                    stroke="var(--bg-card)"
                    strokeWidth={2}
                    cursor={isMobile ? 'default' : 'pointer'}
                    onClick={isMobile ? undefined : handleCategoryPieClick}
                  >
                    {chartFilteredData.categoryData.map((entry) => (
                      <Cell key={entry.kategoria} fill={getCategoryColor(entry.kategoria)} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => (
                      <DonutTooltip active={active} payload={payload} total={chartFilteredData.expensesTotal} />
                    )}
                    offset={isMobile ? 30 : 70}
                    cursor={{ fill: 'rgba(130,167,207,0.06)' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: '8px' }}
                    formatter={(value) => (
                      <span className="text-(--text-primary) text-xs sm:text-sm font-medium">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center w-28 sm:w-32">
                    <p className="text-sm sm:text-lg font-bold text-(--accent) font-display leading-tight">
                      <span className="whitespace-nowrap">{formatNumberPl(chartFilteredData.expensesTotal)}</span> zł
                    </p>
                    <p className="text-xs text-(--text-muted) font-display mt-0.5">{t('total')}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-base text-(--text-muted)">
                {emptyCategoryMessage}
              </div>
            )}
          </div>
        </Card>
        </motion.div>
      </div>

      {/* Asystent AI – raport tygodniowy */}
      <motion.div variants={getDashboardTileVariants(reduceMotion, 6)} className="min-w-0">
        <AiWeeklyReport />
      </motion.div>

      {/* Upcoming events + Quick stats – extended grid */}
      <DashboardQuickStats
        upcomingEvents={upcomingEvents}
        todoCount={todoCount}
        goals={goals}
        habitsToday={habitsToday}
        reduceMotion={reduceMotion}
      />

      {/* Szybkie linki */}
      <DashboardQuickLinks notesCount={notesCount} habitsCount={habits.length} reduceMotion={reduceMotion} />
    </motion.div>
  )
}
