import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '../../components/Card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { Banknote, CreditCard, BarChart3, Pencil, Undo2, Plus, ChevronDown, ChevronUp, TrendingUp, Trash2 } from 'lucide-react'
import { ChartPeriodSelector } from '../../components/ChartPeriodSelector'
import { useChartPeriod, getMonthsInQuarter } from '../../context/ChartPeriodContext'
import { NetWorthAdjustModal } from '../../components/NetWorthAdjustModal'
import { NetWorthAccountCreateModal } from '../../components/NetWorthAccountCreateModal'
import { NetWorthCorrectionModal, type NetWorthCorrectionAccountRef } from '../../components/NetWorthCorrectionModal'
import { NetWorthAdjustmentEditModal } from '../../components/NetWorthAdjustmentEditModal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { getNetWorthAccountIcon, getNetWorthAccountIconKey } from '../../lib/netWorthAccountIcons'
import { getNwAssetAccentClasses, normalizeNwAssetAccentKey } from '../../lib/netWorthAssetAccent'
import { useAuth } from '../../context/AuthContext'
import { useDemoData, DEMO_EXPENSES, DEMO_INCOME, DEMO_SCHEDULED_EXPENSES, DEMO_NET_WORTH } from '../../context/DemoDataContext'
import type { NetWorthPositionKey } from '../../context/DemoDataContext'
import { mergeExpensesWithScheduled } from '../../lib/expensesUtils'
import { useMonth, parseDate } from '../../context/MonthContext'
import { useFinanceListsQuery } from '../../hooks/useFinanceListsQuery'
import { useFinanceUsesApi } from '../../hooks/useFinanceUsesApi'
import { netWorthApi, type NetWorthAccountDto, type NetWorthAdjustmentDto } from '../../lib/api/financeApi'
import { queryKeys } from '../../lib/queryKeys'
import { NetWorthPageSkeleton } from '../../components/skeletons'
import { useIsMobile } from '../../hooks/useIsMobile'
import { safeRandomId } from '../../lib/safeId'

const DEMO_NW_LIAB_KEY = 'tallyo_demo_nw_liabilities_v1'
const DEMO_NW_LOG_KEY = 'tallyo_demo_nw_adjustment_log_v1'
const DEMO_NW_CUSTOM_ASSETS_KEY = 'tallyo_demo_nw_custom_assets_v1'
const NW_HISTORY_COLLAPSED_KEY = 'tallyo_nw_history_collapsed'

const DEMO_DETAIL_PLACEHOLDER = '—'

// Stable reference so useMemo hooks keyed on `apiAccounts` don't recompute every
// render while the query is still loading (netWorthAccountsQuery.data ?? [] would
// otherwise allocate a new empty array on each render).
const EMPTY_NET_WORTH_ACCOUNTS: NetWorthAccountDto[] = []

type DemoLiability = { id: string; name: string; balance: number; iconKey?: string; accentKey?: string }

type DemoAdjUndo =
  | { type: 'position'; key: NetWorthPositionKey }
  | { type: 'liability'; id: string }
  | { type: 'demoAsset'; id: string }

type DemoAdjLog = {
  id: string
  at: string
  headline: string
  detail: string
  amount: number
  undo?: DemoAdjUndo
}

function inferDemoUndo(
  row: DemoAdjLog,
  demoLiabilities: DemoLiability[],
  demoCustomAssets: DemoLiability[],
  positionLabels: Record<NetWorthPositionKey, string>
): DemoAdjUndo | null {
  const m = row.headline.match(/^(.+?)\s*\(zobowiązanie\)\s*$/i)
  if (m) {
    const name = m[1].trim()
    const li = demoLiabilities.find((l) => l.name === name)
    if (li) return { type: 'liability', id: li.id }
    return null
  }
  const key = (Object.keys(positionLabels) as NetWorthPositionKey[]).find(
    (k) => positionLabels[k] === row.headline.trim()
  )
  if (key) return { type: 'position', key }
  const da = demoCustomAssets.find((a) => a.name === row.headline.trim())
  if (da) return { type: 'demoAsset', id: da.id }
  return null
}

function loadDemoLiabilities(): DemoLiability[] {
  try {
    const s = localStorage.getItem(DEMO_NW_LIAB_KEY)
    if (!s) return []
    const p = JSON.parse(s) as unknown
    if (!Array.isArray(p)) return []
    return p.filter((x): x is DemoLiability => {
      if (x == null || typeof x !== 'object') return false
      const o = x as DemoLiability & { iconKey?: unknown; accentKey?: unknown }
      if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.balance !== 'number') return false
      if (o.iconKey != null && typeof o.iconKey !== 'string') return false
      if (o.accentKey != null && typeof o.accentKey !== 'string') return false
      return true
    })
  } catch {
    return []
  }
}

function loadDemoCustomAssets(): DemoLiability[] {
  try {
    const s = localStorage.getItem(DEMO_NW_CUSTOM_ASSETS_KEY)
    if (!s) return []
    const p = JSON.parse(s) as unknown
    if (!Array.isArray(p)) return []
    return p.filter((x): x is DemoLiability => {
      if (x == null || typeof x !== 'object') return false
      const o = x as DemoLiability & { iconKey?: unknown; accentKey?: unknown }
      if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.balance !== 'number') return false
      if (o.iconKey != null && typeof o.iconKey !== 'string') return false
      if (o.accentKey != null && typeof o.accentKey !== 'string') return false
      return true
    })
  } catch {
    return []
  }
}

function loadDemoAdjLog(): DemoAdjLog[] {
  try {
    const s = localStorage.getItem(DEMO_NW_LOG_KEY)
    if (!s) return []
    const p = JSON.parse(s) as unknown
    if (!Array.isArray(p)) return []
    return p.filter(
      (x): x is DemoAdjLog =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as DemoAdjLog).id === 'string' &&
        typeof (x as DemoAdjLog).at === 'string' &&
        typeof (x as DemoAdjLog).headline === 'string' &&
        typeof (x as DemoAdjLog).detail === 'string' &&
        typeof (x as DemoAdjLog).amount === 'number'
    )
  } catch {
    return []
  }
}

const POSITION_CONFIG: {
  key: NetWorthPositionKey
  icon: typeof Banknote
  borderClass: string
  iconClass: string
  balanceClass: string
  rowAccentClass: string
}[] = [
  {
    key: 'cash',
    icon: Banknote,
    borderClass: 'border-(--positive)/20',
    iconClass: 'text-(--positive)',
    balanceClass: 'text-(--positive)',
    rowAccentClass: 'border-l-[3px] border-l-(--positive)/60 bg-(--positive)/5',
  },
  {
    key: 'bankAccount',
    icon: CreditCard,
    borderClass: 'border-(--accent)/20',
    iconClass: 'text-(--accent)',
    balanceClass: 'text-(--accent)',
    rowAccentClass: 'border-l-[3px] border-l-(--accent)/60 bg-(--accent)/5',
  },
  {
    key: 'assets',
    icon: BarChart3,
    borderClass: 'border-(--accent-2)/20',
    iconClass: 'text-(--accent-2)',
    balanceClass: 'text-(--accent-2)',
    rowAccentClass: 'border-l-[3px] border-l-(--accent-2)/55 bg-(--accent-2)/5',
  },
]

export function FinancesNetWorth() {
  const { t, i18n } = useTranslation('finances')
  const dateLocale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'
  const monthNames = t('netWorth.monthShort', { returnObjects: true }) as string[]
  const positionLabels = useMemo<Record<NetWorthPositionKey, string>>(() => ({
    cash: t('netWorth.position.cash'),
    bankAccount: t('netWorth.position.bankAccount'),
    assets: t('netWorth.position.assets'),
  }), [t])
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 200 : 240
  const { user } = useAuth()
  const useApiFinance = useFinanceUsesApi()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  const demoData = useDemoData()
  const monthCtx = useMonth()
  const {
    expenses: qExpenses,
    income: qIncome,
    scheduledExpenses: qScheduled,
  } = useFinanceListsQuery()
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<NetWorthPositionKey | null>(null)
  const [undoInfo, setUndoInfo] = useState<{
    delta: number
    logId: string
    undo: DemoAdjUndo
  } | null>(null)
  const [accountCreateKind, setAccountCreateKind] = useState<'asset' | 'liability' | null>(null)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionRef, setCorrectionRef] = useState<NetWorthCorrectionAccountRef | null>(null)
  const [correctionBalance, setCorrectionBalance] = useState(0)

  const [demoLiabilities, setDemoLiabilities] = useState<DemoLiability[]>(loadDemoLiabilities)
  const [demoCustomAssets, setDemoCustomAssets] = useState<DemoLiability[]>(loadDemoCustomAssets)
  const [demoAdjLog, setDemoAdjLog] = useState<DemoAdjLog[]>(loadDemoAdjLog)
  const [historyCollapsed, setHistoryCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem(NW_HISTORY_COLLAPSED_KEY)
      if (v === '0') return false
      if (v === '1') return true
      return true
    } catch {
      return true
    }
  })
  const [adjustmentEdit, setAdjustmentEdit] = useState<
    | { mode: 'api'; row: NetWorthAdjustmentDto }
    | { mode: 'demo'; row: DemoAdjLog }
    | null
  >(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    description: string
    variant: 'danger' | 'neutral'
    confirmLabel: string
    onConfirm: () => void | Promise<void>
  } | null>(null)
  const [alertDialog, setAlertDialog] = useState<{ title: string; description: string } | null>(null)

  const toggleHistoryCollapsed = () => {
    setHistoryCollapsed((v) => {
      const n = !v
      try {
        localStorage.setItem(NW_HISTORY_COLLAPSED_KEY, n ? '1' : '0')
      } catch {
        /* ignore */
      }
      return n
    })
  }

  useEffect(() => {
    if (useApiFinance) return
    try {
      localStorage.setItem(DEMO_NW_LIAB_KEY, JSON.stringify(demoLiabilities))
    } catch {
      /* ignore */
    }
  }, [demoLiabilities, useApiFinance])

  useEffect(() => {
    if (useApiFinance) return
    try {
      localStorage.setItem(DEMO_NW_CUSTOM_ASSETS_KEY, JSON.stringify(demoCustomAssets))
    } catch {
      /* ignore */
    }
  }, [demoCustomAssets, useApiFinance])

  useEffect(() => {
    if (useApiFinance) return
    try {
      localStorage.setItem(DEMO_NW_LOG_KEY, JSON.stringify(demoAdjLog))
    } catch {
      /* ignore */
    }
  }, [demoAdjLog, useApiFinance])

  const netWorthAccountsQuery = useQuery<NetWorthAccountDto[]>({
    queryKey: queryKeys.netWorthAccounts(userId),
    queryFn: netWorthApi.getAccounts,
    enabled: useApiFinance && !!userId,
  })
  const netWorthAdjustmentsQuery = useQuery<NetWorthAdjustmentDto[]>({
    queryKey: queryKeys.netWorthAdjustments(userId),
    queryFn: netWorthApi.getAdjustments,
    enabled: useApiFinance && !!userId,
  })
  const addAccountMutation = useMutation<
    NetWorthAccountDto,
    Error,
    { name: string; kind: 'asset' | 'liability'; balance: number; iconKey?: string | null; accentKey?: string | null }
  >({
    mutationFn: netWorthApi.createAccount,
    onSuccess: (created) => {
      queryClient.setQueryData<NetWorthAccountDto[]>(queryKeys.netWorthAccounts(userId), (prev) => [
        ...(prev ?? []),
        created,
      ])
    },
  })
  const addAdjustmentMutation = useMutation<
    { adjustment: NetWorthAdjustmentDto; account: NetWorthAccountDto },
    Error,
    { accountId: string; amount: number; description?: string }
  >({
    mutationFn: netWorthApi.createAdjustment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAccounts(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAdjustments(userId) }),
      ])
    },
  })
  const updateAccountMutation = useMutation<
    NetWorthAccountDto,
    Error,
    { id: string } & Partial<{ iconKey: string | null; accentKey: string | null }>
  >({
    mutationFn: ({ id, ...body }) => netWorthApi.updateAccount(id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAccounts(userId) })
    },
  })

  const patchAdjustmentMutation = useMutation<
    NetWorthAdjustmentDto,
    Error,
    { id: string; description?: string; amount?: number }
  >({
    mutationFn: ({ id, ...body }) => netWorthApi.updateAdjustment(id, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAdjustments(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAccounts(userId) }),
      ])
    },
  })

  const deleteAdjustmentMutation = useMutation<void, Error, string>({
    mutationFn: (id) => netWorthApi.deleteAdjustment(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAdjustments(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAccounts(userId) }),
      ])
    },
  })

  const deleteAccountMutation = useMutation<void, Error, string>({
    mutationFn: (id) => netWorthApi.deleteAccount(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAccounts(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.netWorthAdjustments(userId) }),
      ])
    },
  })

  const selectedMonth = monthCtx?.selectedMonth ?? new Date().getMonth()
  const selectedYear = monthCtx?.selectedYear ?? new Date().getFullYear()
  const chartPeriod = useChartPeriod()

  const effectiveExpenses = useApiFinance ? qExpenses : (demoData?.expenses ?? DEMO_EXPENSES)
  const effectiveScheduled = useApiFinance ? qScheduled : (demoData?.scheduledExpenses ?? DEMO_SCHEDULED_EXPENSES)
  const effectiveIncome = useApiFinance ? qIncome : (demoData?.income ?? DEMO_INCOME)
  const netWorthPositions = demoData?.netWorth ?? DEMO_NET_WORTH

  const apiAccounts = netWorthAccountsQuery.data ?? EMPTY_NET_WORTH_ACCOUNTS
  const assetAccounts = useMemo(() => apiAccounts.filter((a) => a.kind === 'asset'), [apiAccounts])
  const liabilityAccounts = useMemo(() => apiAccounts.filter((a) => a.kind === 'liability'), [apiAccounts])

  const { cumulativeSavings, trendData, periodIncomeTotal, periodExpenseTotal, periodSavingsRate } = useMemo(() => {
    let cumulative = 0
    let periodIncomeTotal = 0
    let periodExpenseTotal = 0
    const trend: { label: string; wartość: number; bilans: number }[] = []

    if (chartPeriod?.period.type === 'quarter') {
      const { quarter, year } = chartPeriod.period
      const months = getMonthsInQuarter(quarter, year)
      for (const { month: m, year: y } of months) {
        const monthExp = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === y
        })
        const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, y)
        const wydatki = merged.reduce((s, e) => s + e.amount, 0)
        const przychody = effectiveIncome
          .filter((i) => {
            const { year: iy, month: im } = parseDate(i.date)
            return im === m && iy === y
          })
          .reduce((s, i) => s + i.amount, 0)
        periodIncomeTotal += przychody
        periodExpenseTotal += wydatki
        const bilans = przychody - wydatki
        cumulative += bilans
        trend.push({ label: `${monthNames[m]} ${y}`, wartość: cumulative, bilans })
      }
    } else if (chartPeriod?.period.type === 'year') {
      const y = chartPeriod.period.year
      for (let m = 0; m < 12; m++) {
        const monthExp = effectiveExpenses.filter((e) => {
          const { year: ey, month: em } = parseDate(e.date)
          return em === m && ey === y
        })
        const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, y)
        const wydatki = merged.reduce((s, e) => s + e.amount, 0)
        const przychody = effectiveIncome
          .filter((i) => {
            const { year: iy, month: im } = parseDate(i.date)
            return im === m && iy === y
          })
          .reduce((s, i) => s + i.amount, 0)
        periodIncomeTotal += przychody
        periodExpenseTotal += wydatki
        const bilans = przychody - wydatki
        cumulative += bilans
        trend.push({ label: monthNames[m], wartość: cumulative, bilans })
      }
    } else if (chartPeriod?.period.type === 'month') {
      const m = chartPeriod.period.month
      const y = chartPeriod.period.year
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const monthExp = effectiveExpenses.filter((e) => {
        const { year: ey, month: em } = parseDate(e.date)
        return em === m && ey === y
      })
      const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, m, y)
      const monthIncome = effectiveIncome.filter((i) => {
        const { year: iy, month: im } = parseDate(i.date)
        return im === m && iy === y
      })
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const wydatki = merged.filter((e) => e.date === dayStr).reduce((s, e) => s + e.amount, 0)
        const przychody = monthIncome.filter((i) => i.date === dayStr).reduce((s, i) => s + i.amount, 0)
        periodIncomeTotal += przychody
        periodExpenseTotal += wydatki
        const bilans = przychody - wydatki
        cumulative += bilans
        trend.push({ label: String(d), wartość: cumulative, bilans })
      }
    } else {
      const baseMonth = selectedMonth
      const baseYear = selectedYear
      for (let i = 4; i >= 0; i--) {
        const d = new Date(baseYear, baseMonth - i, 1)
        const mo = d.getMonth()
        const yr = d.getFullYear()
        const monthExp = effectiveExpenses.filter((e) => {
          const { year, month } = parseDate(e.date)
          return month === mo && year === yr
        })
        const merged = mergeExpensesWithScheduled(monthExp, effectiveScheduled, mo, yr)
        const wydatki = merged.reduce((s, e) => s + e.amount, 0)
        const przychody = effectiveIncome
          .filter((i) => {
            const { year, month } = parseDate(i.date)
            return month === mo && year === yr
          })
          .reduce((s, i) => s + i.amount, 0)
        periodIncomeTotal += przychody
        periodExpenseTotal += wydatki
        const bilans = przychody - wydatki
        cumulative += bilans
        trend.push({ label: `${monthNames[mo]} ${yr}`, wartość: cumulative, bilans })
      }
    }

    const periodSavingsRate = periodIncomeTotal > 0 ? ((periodIncomeTotal - periodExpenseTotal) / periodIncomeTotal) * 100 : 0
    return {
      cumulativeSavings: cumulative,
      trendData: trend,
      periodIncomeTotal,
      periodExpenseTotal,
      periodSavingsRate,
    }
  }, [effectiveExpenses, effectiveScheduled, effectiveIncome, selectedMonth, selectedYear, chartPeriod, monthNames])

  const assetsTotal = useMemo(() => {
    if (useApiFinance) return assetAccounts.reduce((s, a) => s + a.balance, 0)
    return (
      netWorthPositions.cash +
      netWorthPositions.bankAccount +
      netWorthPositions.assets +
      demoCustomAssets.reduce((s, a) => s + a.balance, 0)
    )
  }, [useApiFinance, assetAccounts, netWorthPositions, demoCustomAssets])

  const liabilitiesTotal = useMemo(() => {
    if (useApiFinance) return liabilityAccounts.reduce((s, a) => s + a.balance, 0)
    return demoLiabilities.reduce((s, l) => s + l.balance, 0)
  }, [useApiFinance, liabilityAccounts, demoLiabilities])

  const accountsNetWorth = useMemo(() => {
    if (useApiFinance) {
      return apiAccounts.reduce((sum, acc) => {
        if (acc.kind === 'liability') return sum - acc.balance
        return sum + acc.balance
      }, 0)
    }
    const assetsSum =
      netWorthPositions.cash +
      netWorthPositions.bankAccount +
      netWorthPositions.assets +
      demoCustomAssets.reduce((s, a) => s + a.balance, 0)
    const liabSum = demoLiabilities.reduce((s, l) => s + l.balance, 0)
    return assetsSum - liabSum
  }, [useApiFinance, apiAccounts, netWorthPositions, demoLiabilities, demoCustomAssets])

  const cumulativePeriodLabel = useMemo(() => {
    if (!chartPeriod) return `${monthNames[selectedMonth]} ${selectedYear}`
    if (chartPeriod.period.type === 'year') return t('netWorth.yearPeriod', { year: chartPeriod.period.year })
    if (chartPeriod.period.type === 'quarter') return t('netWorth.quarterPeriod', { quarter: chartPeriod.period.quarter, year: chartPeriod.period.year })
    return `${monthNames[chartPeriod.period.month]} ${chartPeriod.period.year}`
  }, [chartPeriod, selectedMonth, selectedYear, monthNames, t])

  const pulseDemoDelta = (undo: DemoAdjUndo, delta: number) => {
    if (undo.type === 'position') {
      demoData?.updateNetWorthPosition(undo.key, delta)
    } else if (undo.type === 'liability') {
      setDemoLiabilities((prev) =>
        prev.map((l) => (l.id === undo.id ? { ...l, balance: Math.max(0, l.balance + delta) } : l))
      )
    } else if (undo.type === 'demoAsset') {
      setDemoCustomAssets((prev) =>
        prev.map((a) => (a.id === undo.id ? { ...a, balance: Math.max(0, a.balance + delta) } : a))
      )
    }
  }

  const resolveDemoUndo = (row: DemoAdjLog) => row.undo ?? inferDemoUndo(row, demoLiabilities, demoCustomAssets, positionLabels)

  const deleteDemoAdjustmentRow = (row: DemoAdjLog): boolean => {
    const undo = resolveDemoUndo(row)
    if (!undo) return false
    pulseDemoDelta(undo, -row.amount)
    setDemoAdjLog((prev) => prev.filter((r) => r.id !== row.id))
    return true
  }

  const quickDeleteApiAdjustment = (row: NetWorthAdjustmentDto) => {
    setConfirmDialog({
      title: t('netWorth.deleteAdjustmentConfirmTitle'),
      description: t('netWorth.deleteAdjustmentConfirmDescriptionApi'),
      variant: 'danger',
      confirmLabel: t('common:delete'),
      onConfirm: async () => {
        await deleteAdjustmentMutation.mutateAsync(row.id)
        setAdjustmentEdit((e) => (e?.mode === 'api' && e.row.id === row.id ? null : e))
      },
    })
  }

  const quickDeleteDemoAdjustment = (row: DemoAdjLog) => {
    setConfirmDialog({
      title: t('netWorth.deleteAdjustmentConfirmTitle'),
      description: t('netWorth.deleteAdjustmentConfirmDescriptionDemo'),
      variant: 'danger',
      confirmLabel: t('common:delete'),
      onConfirm: async () => {
        if (!deleteDemoAdjustmentRow(row)) {
          setAlertDialog({
            title: t('netWorth.cannotDeleteTitle'),
            description: t('netWorth.cannotDeleteDescription'),
          })
          return
        }
        setAdjustmentEdit((e) => (e?.mode === 'demo' && e.row.id === row.id ? null : e))
      },
    })
  }

  const quickDeleteApiAccount = (id: string) => {
    setConfirmDialog({
      title: t('netWorth.deletePositionConfirmTitle'),
      description: t('netWorth.deletePositionConfirmDescription'),
      variant: 'danger',
      confirmLabel: t('common:delete'),
      onConfirm: async () => {
        await deleteAccountMutation.mutateAsync(id)
      },
    })
  }

  const quickDeleteDemoLiability = (id: string) => {
    setConfirmDialog({
      title: t('netWorth.deleteLiabilityConfirmTitle'),
      description: t('netWorth.deleteLiabilityConfirmDescription'),
      variant: 'danger',
      confirmLabel: t('common:delete'),
      onConfirm: async () => {
        setDemoLiabilities((p) => p.filter((l) => l.id !== id))
        setDemoAdjLog((p) => p.filter((r) => !(r.undo?.type === 'liability' && r.undo.id === id)))
      },
    })
  }

  const quickDeleteDemoCustomAsset = (id: string) => {
    setConfirmDialog({
      title: t('netWorth.deleteAssetConfirmTitle'),
      description: t('netWorth.deleteAssetConfirmDescription'),
      variant: 'danger',
      confirmLabel: t('common:delete'),
      onConfirm: async () => {
        setDemoCustomAssets((p) => p.filter((a) => a.id !== id))
        setDemoAdjLog((p) => p.filter((r) => !(r.undo?.type === 'demoAsset' && r.undo.id === id)))
      },
    })
  }

  const openCorrection = (target: {
    id: string
    name: string
    kind: 'asset' | 'liability'
    balance: number
    iconKey?: string | null
    accentKey?: string | null
  }) => {
    const ref: NetWorthCorrectionAccountRef = {
      id: target.id,
      name: target.name,
      kind: target.kind,
      iconKey: target.iconKey ?? undefined,
    }
    if (target.kind === 'asset') ref.accentKey = target.accentKey ?? undefined
    setCorrectionRef(ref)
    setCorrectionBalance(target.balance)
    setCorrectionOpen(true)
  }

  const handleCorrectionSubmit = async ({
    amount,
    description,
    iconKey,
    accentKey,
  }: {
    amount: number
    description: string
    iconKey: string
    accentKey: string | null
  }) => {
    if (!correctionRef) return
    const defIcon = correctionRef.iconKey ?? getNetWorthAccountIconKey(correctionRef.kind)
    const iconChanged = iconKey !== defIcon
    const accentChanged =
      correctionRef.kind === 'asset' &&
      normalizeNwAssetAccentKey(accentKey) !== normalizeNwAssetAccentKey(correctionRef.accentKey)

    if (useApiFinance) {
      const patch: Partial<{ iconKey: string | null; accentKey: string | null }> = {}
      if (iconChanged) patch.iconKey = iconKey
      if (accentChanged) patch.accentKey = accentKey
      if (Object.keys(patch).length > 0) {
        await updateAccountMutation.mutateAsync({ id: correctionRef.id, ...patch })
      }
      if (amount !== 0) {
        await addAdjustmentMutation.mutateAsync({
          accountId: correctionRef.id,
          amount,
          description: description || undefined,
        })
      }
      return
    }
    const logId = safeRandomId()
    const detail = description.trim() || DEMO_DETAIL_PLACEHOLDER
    if (correctionRef.kind === 'liability') {
      setDemoLiabilities((prev) =>
        prev.map((l) =>
          l.id === correctionRef.id
            ? {
                ...l,
                ...(iconChanged ? { iconKey } : {}),
                balance: amount !== 0 ? Math.max(0, l.balance + amount) : l.balance,
              }
            : l
        )
      )
      if (amount !== 0) {
        setDemoAdjLog((prev) => [
          {
            id: logId,
            at: new Date().toISOString(),
            headline: `${correctionRef.name} (${t('netWorth.kindLiability')})`,
            detail,
            amount,
            undo: { type: 'liability', id: correctionRef.id },
          },
          ...prev,
        ])
      }
    } else {
      setDemoCustomAssets((prev) =>
        prev.map((a) =>
          a.id === correctionRef.id
            ? {
                ...a,
                ...(iconChanged ? { iconKey } : {}),
                ...(accentChanged ? { accentKey: accentKey ?? undefined } : {}),
                balance: amount !== 0 ? Math.max(0, a.balance + amount) : a.balance,
              }
            : a
        )
      )
      if (amount !== 0) {
        setDemoAdjLog((prev) => [
          {
            id: logId,
            at: new Date().toISOString(),
            headline: correctionRef.name,
            detail,
            amount,
            undo: { type: 'demoAsset', id: correctionRef.id },
          },
          ...prev,
        ])
      }
    }
  }

  const handleAdjust = (position: NetWorthPositionKey) => {
    if (useApiFinance) return
    setAdjustTarget(position)
    setAdjustModalOpen(true)
  }

  const handleAdjustSubmit = (position: NetWorthPositionKey, amount: number, isAdd: boolean, description: string) => {
    const delta = isAdd ? amount : -amount
    const logId = safeRandomId()
    demoData?.updateNetWorthPosition(position, delta)
    setAdjustModalOpen(false)
    setAdjustTarget(null)
    setUndoInfo({ delta, logId, undo: { type: 'position', key: position } })
    setDemoAdjLog((prev) => [
      {
        id: logId,
        at: new Date().toISOString(),
        headline: positionLabels[position],
        detail: description.trim() || DEMO_DETAIL_PLACEHOLDER,
        amount: delta,
        undo: { type: 'position', key: position },
      },
      ...prev,
    ])
  }

  const handleUndo = () => {
    if (!undoInfo) return
    pulseDemoDelta(undoInfo.undo, -undoInfo.delta)
    setDemoAdjLog((prev) => prev.filter((r) => r.id !== undoInfo.logId))
    setUndoInfo(null)
  }

  const handleCreateAccountSubmit = async ({
    name,
    balance,
    kind,
    iconKey,
    accentKey,
  }: {
    name: string
    balance: number
    kind: 'asset' | 'liability'
    iconKey: string
    accentKey: string | null
  }) => {
    if (useApiFinance) {
      await addAccountMutation.mutateAsync({
        name,
        kind,
        balance,
        iconKey,
        accentKey: kind === 'asset' ? accentKey : null,
      })
    } else if (kind === 'asset') {
      setDemoCustomAssets((prev) => [
        ...prev,
        { id: safeRandomId(), name, balance, iconKey, accentKey: accentKey ?? undefined },
      ])
    } else {
      setDemoLiabilities((prev) => [...prev, { id: safeRandomId(), name, balance, iconKey }])
    }
  }

  useEffect(() => {
    if (!undoInfo) return
    const t = setTimeout(() => setUndoInfo(null), 6000)
    return () => clearTimeout(t)
  }, [undoInfo])

  /** Skeleton only before the first fetch — never replace the whole page during refetch/mutation. */
  const showInitialSkeleton =
    useApiFinance &&
    netWorthAccountsQuery.data === undefined &&
    netWorthAdjustmentsQuery.data === undefined &&
    (netWorthAccountsQuery.isPending || netWorthAdjustmentsQuery.isPending)

  return (
    <>
      {showInitialSkeleton ? (
        <NetWorthPageSkeleton />
      ) : (
    <div className="space-y-5">
      <div className="w-full min-w-0">
        {chartPeriod ? <ChartPeriodSelector leadingLabel={t('netWorth.periodLabel')} /> : null}
      </div>

      <div>
        <h3 className="text-base font-semibold text-(--text-primary) font-display tracking-wide">{t('netWorth.title')}</h3>
        <p className="mt-1 text-base text-(--text-muted)">
          {t('netWorth.subtitle')}
        </p>
      </div>

      <Card title={t('netWorth.summaryTitle')} className="border-(--accent)/20 max-md:p-4">
        <div className="space-y-4">
          <div>
            <p className="text-base text-(--text-muted)">{t('netWorth.netWorthLabel')}</p>
            <p
              className={`mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl ${
                accountsNetWorth >= 0 ? 'text-(--accent)' : 'text-[#e74c3c]'
              }`}
            >
              {accountsNetWorth.toLocaleString('pl-PL')} zł
            </p>
            <p className="mt-1 text-base text-(--text-muted)">{t('netWorth.netWorthFormula')}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-(--border)/50 pb-2">
              <dt className="text-base text-(--text-muted)">{t('netWorth.assetsLabel')}</dt>
              <dd className="text-base font-display text-(--text-primary) tabular-nums">
                {assetsTotal.toLocaleString('pl-PL')} zł
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-(--border)/50 pb-2">
              <dt className="text-base text-(--text-muted)">{t('netWorth.liabilitiesLabel')}</dt>
              <dd className="text-base font-display tabular-nums text-[#e74c3c]">
                −{liabilitiesTotal.toLocaleString('pl-PL')} zł
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-(--border)/50 pb-2 sm:col-span-2">
              <dt className="text-base text-(--text-muted)">{t('netWorth.periodBalance', { period: cumulativePeriodLabel })}</dt>
              <dd
                className={`text-base font-display tabular-nums ${
                  cumulativeSavings >= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'
                }`}
              >
                {cumulativeSavings >= 0 ? '+' : ''}
                {cumulativeSavings.toLocaleString('pl-PL')} zł
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 border-t border-(--border)/50 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-(--positive)/30 bg-(--positive)/10 px-3 py-1.5">
              <TrendingUp className="h-4 w-4 shrink-0 text-(--positive)" />
              <span className="text-sm font-display text-(--positive)">
                {t('netWorth.savingsRate', { pct: periodSavingsRate >= 0 ? periodSavingsRate.toFixed(0) : '0' })}
              </span>
            </div>
            <p className="text-sm text-(--text-muted) sm:text-base">
              {t('netWorth.ofIncome', {
                amount: (periodIncomeTotal - periodExpenseTotal).toLocaleString('pl-PL'),
                income: periodIncomeTotal.toLocaleString('pl-PL'),
              })}
            </p>
          </div>
        </div>
      </Card>

      <Card title={t('netWorth.componentsTitle')} className="border-(--border) max-md:p-4">
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccountCreateKind('asset')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-(--accent)/40 bg-(--accent)/15 px-3 py-2.5 text-sm font-display text-(--accent) transition-colors hover:bg-(--accent)/25"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t('netWorth.addAsset')}
          </button>
          <button
            type="button"
            onClick={() => setAccountCreateKind('liability')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#e74c3c]/40 bg-[#e74c3c]/15 px-3 py-2.5 text-sm font-display text-[#e74c3c] transition-colors hover:bg-[#e74c3c]/25"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t('netWorth.addLiability')}
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-base font-semibold text-(--text-primary) font-display tracking-wide">{t('netWorth.assetsLabel')}</h4>
            {useApiFinance ? (
              assetAccounts.length === 0 ? (
                <p className="text-base text-(--text-muted)">{t('netWorth.noAssets')}</p>
              ) : (
                <ul className="divide-y divide-(--border)/60 rounded-lg border border-(--border)/60">
                  {assetAccounts.map((account) => {
                    const AccIcon = getNetWorthAccountIcon(account.iconKey)
                    const accAccent = getNwAssetAccentClasses(account.accentKey)
                    return (
                    <li key={account.id} className={`flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-2 sm:py-2 ${accAccent.rowAccent}`}>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <AccIcon className={`h-4 w-4 shrink-0 ${accAccent.icon}`} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-base text-(--text-primary)">{account.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:shrink-0">
                        <span className={`font-mono text-base tabular-nums ${accAccent.amount}`}>
                          {account.balance.toLocaleString('pl-PL')} zł
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            openCorrection({
                              id: account.id,
                              name: account.name,
                              kind: 'asset',
                              balance: account.balance,
                              iconKey: account.iconKey,
                              accentKey: account.accentKey,
                            })
                          }
                          className={`rounded-lg border border-(--border) bg-(--bg-dark) px-2.5 py-1.5 text-sm font-display text-(--text-muted) transition-colors ${accAccent.editHover}`}
                        >
                          {t('netWorth.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => quickDeleteApiAccount(account.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-muted) transition-colors hover:border-[#e74c3c]/45 hover:bg-[#e74c3c]/10 hover:text-[#e74c3c]"
                          title={t('netWorth.deleteAssetAria')}
                          aria-label={t('netWorth.deleteAssetAria')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        </div>
                      </div>
                    </li>
                    )
                  })}
                </ul>
              )
            ) : (
              <ul className="divide-y divide-(--border)/60 rounded-lg border border-(--border)/60">
                {POSITION_CONFIG.map(({ key, icon: Icon, iconClass, balanceClass, rowAccentClass }) => (
                  <li
                    key={key}
                    className={`flex flex-col gap-2 border-b border-(--border)/50 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3 sm:py-2.5 ${rowAccentClass}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-base text-(--text-primary)">{positionLabels[key]}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:shrink-0">
                      <span className={`font-mono text-base tabular-nums ${balanceClass}`}>
                        {(netWorthPositions[key] ?? 0).toLocaleString('pl-PL')} zł
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjust(key)}
                        className="shrink-0 rounded-lg border border-(--border) bg-(--bg-dark) px-2.5 py-1.5 text-sm font-display text-(--text-muted) transition-colors hover:border-(--accent)/40 hover:text-(--accent)"
                      >
                        {t('netWorth.edit')}
                      </button>
                    </div>
                  </li>
                ))}
                {demoCustomAssets.map((a) => {
                  const CustomAIcon = getNetWorthAccountIcon(a.iconKey)
                  const aAccent = getNwAssetAccentClasses(a.accentKey)
                  return (
                  <li key={a.id} className={`flex flex-col gap-2 border-b border-(--border)/50 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-2 sm:py-2 ${aAccent.rowAccent}`}>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <CustomAIcon className={`h-4 w-4 shrink-0 ${aAccent.icon}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-base text-(--text-primary)">{a.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:shrink-0">
                      <span className={`font-mono text-base tabular-nums ${aAccent.amount}`}>
                        {a.balance.toLocaleString('pl-PL')} zł
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          openCorrection({
                            id: a.id,
                            name: a.name,
                            kind: 'asset',
                            balance: a.balance,
                            iconKey: a.iconKey,
                            accentKey: a.accentKey,
                          })
                        }
                        className={`rounded-lg border border-(--border) bg-(--bg-dark) px-2.5 py-1.5 text-sm font-display text-(--text-muted) transition-colors ${aAccent.editHover}`}
                      >
                        {t('netWorth.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => quickDeleteDemoCustomAsset(a.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-muted) transition-colors hover:border-[#e74c3c]/45 hover:bg-[#e74c3c]/10 hover:text-[#e74c3c]"
                        title={t('netWorth.deleteAssetAria')}
                        aria-label={t('netWorth.deleteAssetAria')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      </div>
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-base font-semibold text-(--text-primary) font-display tracking-wide">{t('netWorth.liabilitiesLabel')}</h4>
            {useApiFinance ? (
              liabilityAccounts.length === 0 ? (
                <p className="text-base text-(--text-muted)">{t('netWorth.noLiabilitiesApi')}</p>
              ) : (
                <ul className="divide-y divide-(--border)/60 rounded-lg border border-(--border)/60">
                  {liabilityAccounts.map((account) => {
                    const LiIcon = getNetWorthAccountIcon(account.iconKey)
                    return (
                    <li key={account.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-2 sm:py-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <LiIcon className="h-4 w-4 shrink-0 text-[#e74c3c]/90" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-base text-(--text-primary)">{account.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:shrink-0">
                        <span className="font-mono text-base tabular-nums text-[#e74c3c]">
                          −{account.balance.toLocaleString('pl-PL')} zł
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            openCorrection({
                              id: account.id,
                              name: account.name,
                              kind: 'liability',
                              balance: account.balance,
                              iconKey: account.iconKey,
                            })
                          }
                          className="rounded-lg border border-(--border) bg-(--bg-dark) px-2.5 py-1.5 text-sm font-display text-(--text-muted) transition-colors hover:border-rose-400/40 hover:text-[#e74c3c]"
                        >
                          {t('netWorth.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => quickDeleteApiAccount(account.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-muted) transition-colors hover:border-[#e74c3c]/45 hover:bg-[#e74c3c]/10 hover:text-[#e74c3c]"
                          title={t('netWorth.deleteLiabilityAria')}
                          aria-label={t('netWorth.deleteLiabilityAria')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        </div>
                      </div>
                    </li>
                    )
                  })}
                </ul>
              )
            ) : demoLiabilities.length === 0 ? (
              <p className="text-base text-(--text-muted)">{t('netWorth.noLiabilitiesDemo')}</p>
            ) : (
              <ul className="divide-y divide-(--border)/60 rounded-lg border border-(--border)/60">
                {demoLiabilities.map((l) => {
                  const DemoLiIcon = getNetWorthAccountIcon(l.iconKey)
                  return (
                  <li key={l.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-2 sm:py-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <DemoLiIcon className="h-4 w-4 shrink-0 text-[#e74c3c]/90" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-base text-(--text-primary)">{l.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:shrink-0">
                      <span className="font-mono text-base tabular-nums text-[#e74c3c]">
                        −{l.balance.toLocaleString('pl-PL')} zł
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          openCorrection({
                            id: l.id,
                            name: l.name,
                            kind: 'liability',
                            balance: l.balance,
                            iconKey: l.iconKey,
                          })
                        }
                        className="rounded-lg border border-(--border) bg-(--bg-dark) px-2.5 py-1.5 text-sm font-display text-(--text-muted) transition-colors hover:border-rose-400/40 hover:text-[#e74c3c]"
                      >
                        {t('netWorth.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => quickDeleteDemoLiability(l.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-muted) transition-colors hover:border-[#e74c3c]/45 hover:bg-[#e74c3c]/10 hover:text-[#e74c3c]"
                        title={t('netWorth.deleteLiabilityAria')}
                        aria-label={t('netWorth.deleteLiabilityAria')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      </div>
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card
        title={t('netWorth.trendTitle', {
          period: chartPeriod?.period.type === 'quarter'
            ? t('netWorth.quarterPeriod', { quarter: chartPeriod.period.quarter, year: chartPeriod.period.year })
            : chartPeriod?.period.type === 'year'
              ? String(chartPeriod.period.year)
              : chartPeriod?.period.type === 'month'
                ? `${monthNames[chartPeriod.period.month]} ${chartPeriod.period.year}`
                : selectedYear
        })}
      >
        <p className="mb-2 text-base text-(--text-muted)">
          {chartPeriod?.period.type === 'month'
            ? t('netWorth.trendDescMonth')
            : chartPeriod?.period.type === 'year'
              ? t('netWorth.trendDescYear')
              : t('netWorth.trendDescDefault')}
        </p>
        <div className="chart-shell h-[200px] w-full min-h-[200px] sm:h-60">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorWartosc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82a7cf" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#82a7cf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fontSize: isMobile ? 11 : 12 }} />
              {!isMobile && <YAxis stroke="var(--text-muted)" tickFormatter={(v) => `${v} zł`} />}
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              <Tooltip
                cursor={false}
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
                formatter={(value: number | undefined, _name, item) => {
                  const payload = (item as { payload?: { bilans?: number } } | undefined)?.payload
                  const bilans = payload?.bilans
                  const suffix =
                    bilans != null
                      ? t('netWorth.inPeriod', { amount: `${bilans >= 0 ? '+' : ''}${bilans.toLocaleString('pl-PL')}` })
                      : ''
                  return [value != null ? `${value.toLocaleString('pl-PL')} zł${suffix}` : '', t('netWorth.cumulativeBalance')]
                }}
              />
              <Area
                type="monotone"
                dataKey="wartość"
                stroke="#82a7cf"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorWartosc)"
                name={t('netWorth.cumulativeBalance')}
                baseValue={0}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        title={t('netWorth.historyTitle')}
        action={
          <button
            type="button"
            onClick={toggleHistoryCollapsed}
            className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-sm font-display text-(--text-muted) hover:border-(--accent)/30 hover:text-(--text-primary) transition-colors"
          >
            {historyCollapsed ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronUp className="h-4 w-4 shrink-0" />}
            {historyCollapsed ? t('netWorth.expand') : t('netWorth.collapse')}
          </button>
        }
      >
        {historyCollapsed ? (
          <p className="text-base text-(--text-muted)">
            {t('netWorth.collapsedMessage')}
          </p>
        ) : (
          <>
            <p className="text-base text-(--text-muted) mb-3">
              {t('netWorth.expandedDescription')}
            </p>
            {useApiFinance ? (
              <div className="space-y-1.5">
                {(netWorthAdjustmentsQuery.data ?? []).length === 0 && (
                  <p className="text-base text-(--text-muted)">{t('netWorth.noAdjustments')}</p>
                )}
                {(netWorthAdjustmentsQuery.data ?? []).map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-(--border) px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-(--text-primary)">
                        {row.account.name}{' '}
                        <span className="text-(--text-muted)">
                          ({row.account.kind === 'liability' ? t('netWorth.kindLiability') : t('netWorth.kindAsset')})
                        </span>
                      </p>
                      <p className="text-base text-(--text-muted) mt-0.5">
                        {row.description?.trim() ? row.description.trim() : t('netWorth.noDescription')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className={`font-mono text-sm ${row.amount >= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'}`}>
                          {row.amount >= 0 ? '+' : ''}
                          {row.amount.toLocaleString('pl-PL')} zł
                        </p>
                        <p className="text-base text-(--text-muted)">
                          {new Date(row.createdAt).toLocaleString(dateLocale)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdjustmentEdit({ mode: 'api', row })}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-card-hover) hover:text-(--accent)"
                        title={t('netWorth.editAdjustmentAria')}
                        aria-label={t('netWorth.editAdjustmentAria')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => quickDeleteApiAdjustment(row)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-[#e74c3c]/15 hover:text-[#e74c3c]"
                        title={t('netWorth.deleteAdjustmentAria')}
                        aria-label={t('netWorth.deleteAdjustmentAria')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : demoAdjLog.length === 0 ? (
              <p className="text-base text-(--text-muted)">{t('netWorth.noAdjustmentsDemo')}</p>
            ) : (
              <div className="space-y-1.5">
                {demoAdjLog.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-(--border) px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-(--text-primary)">{row.headline}</p>
                      <p className="text-base text-(--text-muted) mt-0.5">{row.detail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className={`font-mono text-sm ${row.amount >= 0 ? 'text-(--positive)' : 'text-[#e74c3c]'}`}>
                          {row.amount >= 0 ? '+' : ''}
                          {row.amount.toLocaleString('pl-PL')} zł
                        </p>
                        <p className="text-base text-(--text-muted)">{new Date(row.at).toLocaleString(dateLocale)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdjustmentEdit({ mode: 'demo', row })}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-card-hover) hover:text-(--accent)"
                        title={t('netWorth.editAdjustmentAria')}
                        aria-label={t('netWorth.editAdjustmentAria')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => quickDeleteDemoAdjustment(row)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-[#e74c3c]/15 hover:text-[#e74c3c]"
                        title={t('netWorth.deleteAdjustmentAria')}
                        aria-label={t('netWorth.deleteAdjustmentAria')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
      )}

      <NetWorthAdjustmentEditModal
        isOpen={adjustmentEdit != null}
        onClose={() => setAdjustmentEdit(null)}
        title={
          adjustmentEdit?.mode === 'api'
            ? `${adjustmentEdit.row.account.name} · ${new Date(adjustmentEdit.row.createdAt).toLocaleString(dateLocale)}`
            : adjustmentEdit?.mode === 'demo'
              ? adjustmentEdit.row.headline
              : ''
        }
        initialDescription={
          adjustmentEdit?.mode === 'api'
            ? (adjustmentEdit.row.description ?? '')
            : adjustmentEdit?.mode === 'demo'
              ? adjustmentEdit.row.detail === DEMO_DETAIL_PLACEHOLDER
                ? ''
                : adjustmentEdit.row.detail
              : ''
        }
        initialAmount={adjustmentEdit?.mode === 'api' ? adjustmentEdit.row.amount : adjustmentEdit?.mode === 'demo' ? adjustmentEdit.row.amount : 0}
        onSave={async ({ description, amount }) => {
          if (!adjustmentEdit) return
          if (adjustmentEdit.mode === 'api') {
            const row = adjustmentEdit.row
            const descTrim = description.trim()
            const payload: { description?: string; amount?: number } = {}
            if (descTrim !== (row.description ?? '')) payload.description = descTrim
            if (amount !== row.amount) payload.amount = amount
            if (Object.keys(payload).length > 0) {
              await patchAdjustmentMutation.mutateAsync({ id: row.id, ...payload })
            }
          } else {
            const row = adjustmentEdit.row
            const undo = resolveDemoUndo(row)
            const diff = amount - row.amount
            if (diff !== 0 && !undo) {
              throw new Error(t('netWorth.cannotRecalculateError'))
            }
            if (diff !== 0 && undo) pulseDemoDelta(undo, diff)
            const detailNext = description.trim() || DEMO_DETAIL_PLACEHOLDER
            setDemoAdjLog((prev) =>
              prev.map((r) =>
                r.id === row.id ? { ...r, amount, detail: detailNext, undo: r.undo ?? undo ?? undefined } : r
              )
            )
          }
        }}
        onDelete={async () => {
          if (!adjustmentEdit) return
          if (adjustmentEdit.mode === 'api') {
            await deleteAdjustmentMutation.mutateAsync(adjustmentEdit.row.id)
          } else {
            const row = adjustmentEdit.row
            if (!deleteDemoAdjustmentRow(row)) {
              throw new Error(t('netWorth.cannotUndoAmountError'))
            }
          }
        }}
      />

      <NetWorthAccountCreateModal
        isOpen={accountCreateKind != null}
        kind={accountCreateKind}
        onClose={() => setAccountCreateKind(null)}
        onSubmit={handleCreateAccountSubmit}
      />

      <NetWorthCorrectionModal
        isOpen={correctionOpen}
        onClose={() => {
          setCorrectionOpen(false)
          setCorrectionRef(null)
        }}
        account={correctionRef}
        currentBalance={correctionBalance}
        onSubmit={handleCorrectionSubmit}
      />

      {!useApiFinance && (
        <NetWorthAdjustModal
          isOpen={adjustModalOpen}
          onClose={() => {
            setAdjustModalOpen(false)
            setAdjustTarget(null)
          }}
          onSubmit={handleAdjustSubmit}
          initialPosition={adjustTarget ?? undefined}
          currentValue={adjustTarget ? (netWorthPositions[adjustTarget] ?? 0) : 0}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog != null}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        variant={confirmDialog?.variant ?? 'danger'}
        confirmLabel={confirmDialog?.confirmLabel}
        onConfirm={async () => {
          const fn = confirmDialog?.onConfirm
          if (fn) await fn()
        }}
      />

      <ConfirmDialog
        isOpen={alertDialog != null}
        onClose={() => setAlertDialog(null)}
        title={alertDialog?.title ?? ''}
        description={alertDialog?.description ?? ''}
        alertOnly
        variant="neutral"
        confirmLabel={t('netWorth.confirmUnderstand')}
        onConfirm={async () => {}}
      />

      <AnimatePresence>
        {undoInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-9999 flex items-center gap-3 px-4 py-2 rounded-lg border border-(--border) bg-(--bg-card) shadow-xl"
          >
            <span className="text-sm text-(--text-primary)">{t('netWorth.appliedToast')}</span>
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--accent)/20 text-(--accent) font-display text-sm hover:bg-(--accent)/30 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              {t('netWorth.undo')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
