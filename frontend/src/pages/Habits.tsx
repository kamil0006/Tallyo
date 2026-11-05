import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import i18n from '../i18n'
import { Card } from '../components/Card'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Plus,
  Trash2,
  Flame,
  Pencil,
  Check,
  X,
  ChevronDown,
  Award,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { useHabits, type HabitItem } from '../context/HabitsContext'
import type { HabitCheckInStatus, HabitScheduleType } from '../lib/api/habitsApi'
import { SimplePageSkeleton } from '../components/skeletons'
import { ModalShell } from '../components/ModalShell'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useIsMobile } from '../hooks/useIsMobile'
import { TODO_ITEM_SPRING } from '../lib/todoMotion'
import { formatNumberPl } from '../lib/currency'

/** When there are no entries — show this many days ending today (no artificial history). */
const EMPTY_GRID_DAYS = 10
/** Minimum grid history — enables scrolling / the slider even without old entries. */
const MIN_GRID_HISTORY_DAYS = 90
const HABIT_GRID_WRAP_CLASS =
  'w-full min-w-0 max-w-full pb-1.5 self-start sm:max-w-[min(100%,27rem)]'
const HABIT_GRID_COLS = 'grid grid-cols-10 gap-2'
const HABIT_GRID_CELL = 'h-9 w-9 min-h-9 min-w-9 shrink-0'
/** Width of one column with 10 visible days (9 × gap-1.5 = 3.375rem). */
const HABIT_MOBILE_CELL_WIDTH = 'w-[calc((100%-3.375rem)/10)]'
/** Total under the grid: this many most recent days from today. */
const SUM_LAST_DAYS = 10
/** Default habit chart range (last N days). */
const HABIT_CHART_DEFAULT_DAYS = 30

const HABIT_ACCENT_STORAGE_KEY = 'tallyo-habit-accents-v1'

const CHECK_IN_STATUS_ORDER: HabitCheckInStatus[] = ['done', 'missed', 'skipped']

/** Day status label — translated; `t` comes from useTranslation('habits'). */
function checkInStatusLabel(t: TFunction, status: HabitCheckInStatus): string {
  return t(`checkInStatus.${status}`)
}

const SCHEDULE_TYPE_ORDER: HabitScheduleType[] = ['daily', 'weekdays', 'weekly', 'monthly']

/** Schedule type label — translated; `t` comes from useTranslation('habits'). */
function scheduleTypeLabel(t: TFunction, type: HabitScheduleType): string {
  return t(`schedule.label.${type}`)
}

/** Habit accent palette (hex); grid + chart. Color labels — translated separately. */
const HABIT_ACCENT_PRESETS = [
  { id: 'green', hex: '#63b28f' },
  { id: 'cyan', hex: '#82a7cf' },
  { id: 'magenta', hex: '#b58cc4' },
  { id: 'amber', hex: '#c9a35c' },
  { id: 'violet', hex: '#a78bfa' },
  { id: 'emerald', hex: '#34d399' },
  { id: 'lime', hex: '#bef264' },
  { id: 'orange', hex: '#fb923c' },
  { id: 'rose', hex: '#fb7185' },
  { id: 'sky', hex: '#38bdf8' },
  { id: 'coral', hex: '#f87171' },
  { id: 'white', hex: '#e2e8f0' },
] as const

type HabitAccentId = (typeof HABIT_ACCENT_PRESETS)[number]['id']

function habitAccentLabel(t: TFunction, id: HabitAccentId): string {
  return t(`accents.${id}`)
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function resolveHabitAccentHex(
  choiceByHabit: Record<string, string>,
  habitId: string,
  fallbackId: HabitAccentId = HABIT_ACCENT_PRESETS[0].id
): string {
  const id = choiceByHabit[habitId] ?? fallbackId
  return HABIT_ACCENT_PRESETS.find((p) => p.id === id)?.hex ?? HABIT_ACCENT_PRESETS[0].hex
}

function defaultHabitAccentId(seed: string): HabitAccentId {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return HABIT_ACCENT_PRESETS[hash % HABIT_ACCENT_PRESETS.length].id
}

function readHabitAccentStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HABIT_ACCENT_STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, string>
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function writeHabitAccentStorage(next: Record<string, string>) {
  try {
    localStorage.setItem(HABIT_ACCENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

type HabitChartPeriod = '30d' | '90d' | 'month' | 'year' | 'all'

type HabitChartPoint = {
  label: string
  /** Realizacja 0–100 % (cel dnia lub okno binarne). */
  pct: number
  fullDate?: string
  /** Dla binarnych (dzienne widoki): ile dni zaliczono w przesuwnym oknie wykresu. */
  rollingDone?: number
}
/** Short day labels (getDay(): 0 = Sun … 6 = Sat). English ones generated dynamically via Intl. */
const WEEKDAY_SHORT_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']
/** For phrases like "w środę" (accusative inflection — Polish only). */
const WEEKDAY_ACCUSATIVE_PL = [
  'niedzielę',
  'poniedziałek',
  'wtorek',
  'środę',
  'czwartek',
  'piątek',
  'sobotę',
]
/** Reference Sunday — for generating English day names via Intl. */
const WEEKDAY_REFERENCE_SUNDAY = new Date(2023, 0, 1)

function weekdayShortLabels(language: string): string[] {
  if (language === 'pl') return WEEKDAY_SHORT_PL
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(WEEKDAY_REFERENCE_SUNDAY)
    d.setDate(d.getDate() + i)
    return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)
  })
}

function weekdayShortLabelsMondayFirst(language: string): string[] {
  const sundayFirst = weekdayShortLabels(language)
  return [...sundayFirst.slice(1), sundayFirst[0]]
}

function weekdayDisplayName(language: string, weekdayIdx: number): string {
  if (language === 'pl') return WEEKDAY_ACCUSATIVE_PL[weekdayIdx]
  const d = new Date(WEEKDAY_REFERENCE_SUNDAY)
  d.setDate(d.getDate() + weekdayIdx)
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

/** For "all history" — above this many days the daily chart switches to weeks (readability). */
const CHART_ALL_MAX_DAILY_POINTS = 200

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatMonthKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function parseMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

function activeDateLocale(): string {
  return i18n.language === 'pl' ? 'pl-PL' : 'en-US'
}

function formatMonthLabel(key: string): string {
  return parseMonthKey(key).toLocaleDateString(activeDateLocale(), {
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Range: at least MIN_GRID_HISTORY_DAYS days + possibly older days from entries.
 * The window shows ~10 columns at once; the rest via the slider (web) or scrolling (mobile).
 */
function getHabitGridDates(habit: HabitItem, language: string): { dates: string[]; letters: string[] } {
  const today = new Date()
  const endStr = formatLocalYmd(today)
  const minHistoryStartDate = new Date(today)
  minHistoryStartDate.setDate(minHistoryStartDate.getDate() - (MIN_GRID_HISTORY_DAYS - 1))
  let startStr = formatLocalYmd(minHistoryStartDate)

  if (habit.checkIns.length > 0) {
    const sorted = [...habit.checkIns].sort((a, b) => a.date.localeCompare(b.date))
    const earliestCheck = sorted[0].date
    if (earliestCheck < startStr) startStr = earliestCheck
  }

  const dayLetters = weekdayShortLabels(language)
  const dates: string[] = []
  const letters: string[] = []
  const start = parseLocalYmd(startStr)
  const end = parseLocalYmd(endStr)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(formatLocalYmd(d))
    letters.push(dayLetters[d.getDay()])
  }
  return { dates, letters }
}

function sanitizeGoalNumber(val: string): string {
  let s = val.replace(/[^0-9,.]/g, '')
  const parts = s.split(/[.,]/)
  if (parts.length > 2) {
    s = parts[0] + ',' + parts.slice(1).join('')
  } else if (parts.length === 2 && (s.includes(',') && s.includes('.'))) {
    s = parts[0] + ',' + parts[1]
  }
  if (s.length > 1 && s[0] === '0' && s[1] !== '.' && s[1] !== ',') {
    s = s.replace(/^0+/, '') || '0'
  }
  if (/^0+$/.test(s)) s = '0'
  return s
}

function parseGoalNumber(val: string): number {
  return parseFloat(val.replace(',', '.')) || 0
}

function isMeasurableHabit(h: HabitItem): boolean {
  return h.targetPerDay != null || !!(h.unit && h.unit.trim())
}

function checkInForDay(habit: HabitItem, date: string) {
  return habit.checkIns.find((c) => c.date === date)
}

function habitDayIsDone(habit: HabitItem, date: string): boolean {
  const checkIn = checkInForDay(habit, date)
  if (!checkIn || checkIn.status !== 'done') return false
  if (isMeasurableHabit(habit) && habit.targetPerDay != null && habit.targetPerDay > 0) {
    return (checkIn.value ?? 0) >= habit.targetPerDay
  }
  return true
}

function habitDayHasDoneEntry(habit: HabitItem, date: string): boolean {
  return checkInForDay(habit, date)?.status === 'done'
}

function habitScheduledOnDate(habit: HabitItem, date: string): boolean {
  const d = parseLocalYmd(date)
  if (habit.scheduleType === 'weekdays') return habit.scheduleDays.includes(d.getDay())
  return true
}

function formatHabitSchedule(t: TFunction, language: string, habit: HabitItem): string {
  if (habit.scheduleType === 'weekdays') {
    const dayLetters = weekdayShortLabels(language)
    const days = habit.scheduleDays.length
      ? habit.scheduleDays.map((d) => dayLetters[d]).join(', ')
      : t('schedule.noDays')
    return t('schedule.planWeekdays', { days })
  }
  if (habit.scheduleType === 'weekly') {
    return t('schedule.planWeekly', { count: habit.weeklyTarget ?? 1 })
  }
  if (habit.scheduleType === 'monthly') {
    return t('schedule.planMonthly', { count: habit.monthlyTarget ?? 1 })
  }
  return t('schedule.planDaily')
}


function expectedHabitCountInWindow(habit: HabitItem, days: number, scheduledDays: number): number {
  if (habit.scheduleType === 'weekly') {
    return Math.max(1, Math.ceil(days / 7) * (habit.weeklyTarget ?? 1))
  }
  if (habit.scheduleType === 'monthly') {
    return Math.max(1, Math.ceil(days / 30) * (habit.monthlyTarget ?? 1))
  }
  return scheduledDays
}

/** How many times the habit was completed on a given weekday in history (0 = Sun … 6 = Sat). */
function countCompletionsByWeekday(habit: HabitItem, measurable: boolean): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const c of habit.checkIns) {
    const w = parseLocalYmd(String(c.date).split('T')[0]).getDay()
    if (c.status !== 'done') continue
    if (measurable) {
      if (c.value != null && c.value > 0) counts[w]++
    } else {
      counts[w]++
    }
  }
  return counts
}

function weekdayCountTitle(t: TFunction, language: string, weekdayIdx: number, n: number): string {
  const name = weekdayDisplayName(language, weekdayIdx)
  return t('detail.weekday.countTitle', { count: n, day: name })
}

function pluralDays(t: TFunction, n: number): string {
  return t('common.dayCount', { count: n })
}

function goalStatusChip(t: TFunction, pct: number): { label: string; cls: string } | null {
  if (pct >= 100) return { label: t('goalStatus.completed'), cls: 'border-(--positive)/40 bg-(--positive)/10 text-(--positive)' }
  if (pct >= 75) return { label: t('goalStatus.close'), cls: 'border-(--warning)/40 bg-(--warning)/10 text-(--warning)' }
  return null
}

function goalQuickStep(target: number): number {
  if (target >= 1000) return 100
  if (target >= 100) return 10
  return 1
}

/** Height of the cell's green fill: 0–100% relative to the daily goal, or "has an entry". */
function dayFillPercent(habit: HabitItem, value: number | null | undefined): number {
  if (value == null || value <= 0) return 0
  if (habit.targetPerDay != null && habit.targetPerDay > 0) {
    return Math.min(100, (value / habit.targetPerDay) * 100)
  }
  return 100
}

function sumLastNDays(habit: HabitItem, n: number): number {
  const today = new Date()
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const checkIn = checkInForDay(habit, key)
    if (checkIn?.status !== 'done') continue
    const v = checkIn.value
    if (v != null && v > 0) sum += v
  }
  return sum
}

/** Longest continuous streak of calendar days with any entry. */
function getLongestStreakDays(habit: HabitItem): number {
  const start = getHabitHistoryStart(habit)
  const end = new Date()
  end.setHours(12, 0, 0, 0)
  const unique: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = formatLocalYmd(d)
    if (habitDayIsDone(habit, key)) unique.push(key)
  }
  if (unique.length === 0) return 0
  let best = 1
  let cur = 1
  for (let i = 1; i < unique.length; i++) {
    const prev = parseLocalYmd(unique[i - 1])
    const next = parseLocalYmd(unique[i])
    const diffDays = Math.round((next.getTime() - prev.getTime()) / 86400000)
    if (diffDays === 1) {
      cur++
      best = Math.max(best, cur)
    } else {
      cur = 1
    }
  }
  return best
}

/** Etykieta widocznego okna kratki (np. „7 kwi – 16 kwi 2026”). */
function formatVisibleDateRange(dates: string[]): string {
  if (dates.length === 0) return ''
  const first = dates[0]
  const last = dates[dates.length - 1]
  const d0 = parseLocalYmd(first)
  const d1 = parseLocalYmd(last)
  const locale = activeDateLocale()
  if (first === last) {
    return d0.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  const sameYear = d0.getFullYear() === d1.getFullYear()
  const left = d0.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' as const }),
  })
  const right = d1.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${left} – ${right}`
}

/**
 * Rolling window for a binary habit on the chart (daily / month).
 * Wider than a week — so 7 in a row doesn't immediately give 100% (full scale = all days in the window completed).
 */
const BINARY_CHART_ROLLING_DAYS = 14

function binaryRollingWindowMeta(habit: HabitItem, endDate: Date): { pct: number; done: number } {
  let done = 0
  for (let i = 0; i < BINARY_CHART_ROLLING_DAYS; i++) {
    const d = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    )
    d.setDate(d.getDate() - i)
    const key = formatLocalYmd(d)
    if (habitDayHasDoneEntry(habit, key)) done++
  }
  return { pct: (done / BINARY_CHART_ROLLING_DAYS) * 100, done }
}

/** Start of history for stats / "all history": min(createdAt, oldest entry). */
function getHabitHistoryStart(habit: HabitItem): Date {
  let minYmd = habit.createdAt.split('T')[0]
  if (habit.checkIns.length > 0) {
    const sorted = [...habit.checkIns].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted[0].date < minYmd) minYmd = sorted[0].date
  }
  const d = parseLocalYmd(minYmd)
  d.setHours(12, 0, 0, 0)
  return d
}

/** Average completion 0–100 by weekday (every calendar day from history start until today). */
function computeWeekdayStats(
  habit: HabitItem,
  measurable: boolean
): { avg: number[]; bestIdx: number | null; maxAvg: number } {
  const start = getHabitHistoryStart(habit)
  const end = new Date()
  end.setHours(12, 0, 0, 0)
  const sum = [0, 0, 0, 0, 0, 0, 0]
  const cnt = [0, 0, 0, 0, 0, 0, 0]
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const w = d.getDay()
    cnt[w]++
    const key = formatLocalYmd(d)
    if (measurable) {
      const checkIn = checkInForDay(habit, key)
      sum[w] += checkIn?.status === 'done' ? dayFillPercent(habit, checkIn.value) : 0
    } else {
      sum[w] += habitDayHasDoneEntry(habit, key) ? 100 : 0
    }
  }
  const avg = [0, 1, 2, 3, 4, 5, 6].map((i) => (cnt[i] ? sum[i] / cnt[i] : 0))
  let bestIdx: number | null = null
  let maxAvg = -1
  for (let i = 0; i < 7; i++) {
    if (cnt[i] === 0) continue
    if (avg[i] > maxAvg) {
      maxAvg = avg[i]
      bestIdx = i
    }
  }
  if (bestIdx === null || maxAvg < 0) maxAvg = 0
  return { avg, bestIdx, maxAvg }
}

function buildHabitChartSeries(
  habit: HabitItem,
  measurable: boolean,
  period: HabitChartPeriod
): HabitChartPoint[] {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const locale = activeDateLocale()

  const pushDaily = (d: Date): HabitChartPoint => {
    const key = formatLocalYmd(d)
    let pct: number
    let rollingDone: number | undefined
    if (measurable) {
      const checkIn = checkInForDay(habit, key)
      pct = checkIn?.status === 'done' ? dayFillPercent(habit, checkIn.value) : 0
    } else {
      const meta = binaryRollingWindowMeta(habit, d)
      pct = meta.pct
      rollingDone = meta.done
    }
    return {
      label: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      pct: Math.min(100, Math.max(0, pct)),
      fullDate: key,
      rollingDone,
    }
  }

  if (period === 'year') {
    const out: HabitChartPoint[] = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const y = monthStart.getFullYear()
      const mon = monthStart.getMonth()
      let sum = 0
      let n = 0
      for (let day = 1; day <= 31; day++) {
        const d = new Date(y, mon, day)
        if (d.getMonth() !== mon) break
        if (d > today) break
        n++
        const key = formatLocalYmd(d)
        if (measurable) {
          const checkIn = checkInForDay(habit, key)
          sum += checkIn?.status === 'done' ? dayFillPercent(habit, checkIn.value) : 0
        } else {
          sum += habitDayHasDoneEntry(habit, key) ? 100 : 0
        }
      }
      const pct = n > 0 ? Math.min(100, Math.max(0, sum / n)) : 0
      const label = monthStart.toLocaleDateString(locale, {
        month: 'short',
        year: '2-digit',
      })
      out.push({
        label,
        pct,
        fullDate: formatLocalYmd(new Date(y, mon, 15)),
      })
    }
    return out
  }

  if (period === 'month') {
    const out: HabitChartPoint[] = []
    const y = today.getFullYear()
    const mon = today.getMonth()
    for (let day = 1; day <= 31; day++) {
      const d = new Date(y, mon, day)
      if (d.getMonth() !== mon) break
      if (d > today) break
      out.push(pushDaily(d))
    }
    return out
  }

  if (period === 'all') {
    const start = getHabitHistoryStart(habit)
    const end = new Date(today)
    const dayCount =
      Math.floor((end.getTime() - start.getTime()) / 86400000) + 1

    if (dayCount <= 0) return []

    if (dayCount <= CHART_ALL_MAX_DAILY_POINTS) {
      const out: HabitChartPoint[] = []
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(start)
        d.setHours(12, 0, 0, 0)
        d.setDate(d.getDate() + i)
        if (d > end) break
        out.push(pushDaily(d))
      }
      return out
    }

    const out: HabitChartPoint[] = []
    let chunkStart = new Date(start)
    chunkStart.setHours(12, 0, 0, 0)
    const endT = new Date(end)
    endT.setHours(12, 0, 0, 0)
    while (chunkStart <= endT) {
      const chunkEnd = new Date(chunkStart)
      chunkEnd.setDate(chunkEnd.getDate() + 6)
      if (chunkEnd > endT) chunkEnd.setTime(endT.getTime())
      let sumP = 0
      let n = 0
      for (let d = new Date(chunkStart); d <= chunkEnd; d.setDate(d.getDate() + 1)) {
        n++
        const key = formatLocalYmd(d)
        if (measurable) {
          const checkIn = checkInForDay(habit, key)
          sumP += checkIn?.status === 'done' ? dayFillPercent(habit, checkIn.value) : 0
        } else {
          sumP += binaryRollingWindowMeta(habit, d).pct
        }
      }
      const pct = n > 0 ? Math.min(100, Math.max(0, sumP / n)) : 0
      const label = `${chunkStart.getDate()}.${String(chunkStart.getMonth() + 1).padStart(2, '0')}–${chunkEnd.getDate()}.${String(chunkEnd.getMonth() + 1).padStart(2, '0')}`
      out.push({
        label,
        pct,
        fullDate: formatLocalYmd(chunkEnd),
      })
      chunkStart = new Date(chunkEnd)
      chunkStart.setDate(chunkStart.getDate() + 1)
    }
    return out
  }

  if (period === '90d') {
    const out: HabitChartPoint[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      out.push(pushDaily(d))
    }
    return out
  }

  const out: HabitChartPoint[] = []
  for (let i = HABIT_CHART_DEFAULT_DAYS - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push(pushDaily(d))
  }
  return out
}

/** Shorter X-axis labels on mobile — day only or abbreviated month. */
function formatHabitChartAxisTick(
  label: string,
  index: number,
  series: HabitChartPoint[],
  period: HabitChartPeriod
): string {
  const point = series[index]
  if (period === 'year') {
    const month = point?.fullDate
      ? parseLocalYmd(point.fullDate).toLocaleDateString(activeDateLocale(), { month: 'short' })
      : label.split(/\s+/)[0]
    return month.replace('.', '')
  }
  if (label.includes('–')) {
    const start = label.split('–')[0]?.trim() ?? label
    const day = start.split('.')[0]
    return day || start
  }
  if (point?.fullDate) {
    return String(parseLocalYmd(point.fullDate).getDate())
  }
  const dayPrefix = label.match(/^\d+/)
  return dayPrefix ? dayPrefix[0] : label
}

function habitChartXAxisInterval(
  seriesLength: number,
  period: HabitChartPeriod,
  mobile: boolean
): number | 'preserveStartEnd' {
  if (!mobile) {
    if (period === 'year') return 0
    if (seriesLength > 48) return Math.max(2, Math.floor(seriesLength / 14))
    if (seriesLength > 28) return Math.max(1, Math.floor(seriesLength / 12))
    return 'preserveStartEnd'
  }
  if (seriesLength <= 1) return 0
  if (period === 'year') return 1
  if (seriesLength <= 7) return 0
  if (seriesLength <= 14) return 1
  return Math.max(2, Math.floor(seriesLength / 5))
}

function computeHabitWindowStats(habit: HabitItem, days: number) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  let planned = 0
  let done = 0
  let skipped = 0
  let valueSum = 0
  let valueCount = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = formatLocalYmd(d)
    if (habitScheduledOnDate(habit, key)) planned++
    const checkIn = checkInForDay(habit, key)
    if (checkIn?.status === 'skipped') skipped++
    if (habitDayIsDone(habit, key)) done++
    if (checkIn?.status === 'done' && checkIn.value != null && checkIn.value > 0) {
      valueSum += checkIn.value
      valueCount++
    }
  }
  planned = expectedHabitCountInWindow(habit, days, planned)
  const denominator = Math.max(1, planned - skipped)
  return {
    days,
    done,
    planned,
    skipped,
    pct: Math.round((done / denominator) * 100),
    avgValue: valueCount ? valueSum / valueCount : null,
  }
}

function computeHabitTrend(habit: HabitItem, days: number): number {
  const current = computeHabitWindowStats(habit, days).pct
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  let planned = 0
  let done = 0
  let skipped = 0
  for (let i = days; i < days * 2; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = formatLocalYmd(d)
    if (habitScheduledOnDate(habit, key)) planned++
    const checkIn = checkInForDay(habit, key)
    if (checkIn?.status === 'skipped') skipped++
    if (habitDayIsDone(habit, key)) done++
  }
  planned = expectedHabitCountInWindow(habit, days, planned)
  const previous = Math.round((done / Math.max(1, planned - skipped)) * 100)
  return current - previous
}

type HabitCalendarCell =
  | { kind: 'blank'; key: string }
  | { kind: 'day'; date: string; day: number; pct: number; status: HabitCheckInStatus | 'empty' }

function buildHabitMonthOptions(habit: HabitItem): { key: string; label: string }[] {
  const start = getHabitHistoryStart(habit)
  const end = new Date()
  const out: { key: string; label: string }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= endMonth) {
    const key = formatMonthKey(cursor)
    out.push({ key, label: formatMonthLabel(key) })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return out.reverse()
}

function buildHabitMonthCalendar(habit: HabitItem, monthKey: string): HabitCalendarCell[] {
  const month = parseMonthKey(monthKey)
  const y = month.getFullYear()
  const mon = month.getMonth()
  const firstDay = new Date(y, mon, 1)
  const leadingBlanks = (firstDay.getDay() + 6) % 7
  const days: HabitCalendarCell[] = Array.from({ length: leadingBlanks }, (_, i) => ({
    kind: 'blank',
    key: `blank-${i}`,
  }))
  for (let day = 1; day <= 31; day++) {
    const d = new Date(y, mon, day)
    if (d.getMonth() !== mon) break
    const date = formatLocalYmd(d)
    const checkIn = checkInForDay(habit, date)
    days.push({
      kind: 'day',
      date,
      day,
      pct: checkIn?.status === 'done' ? dayFillPercent(habit, checkIn.value) : 0,
      status: checkIn?.status ?? 'empty',
    })
  }
  return days
}

function computeHabitMonthSummary(habit: HabitItem, monthKey: string) {
  const month = parseMonthKey(monthKey)
  const y = month.getFullYear()
  const mon = month.getMonth()
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  let calendarDays = 0
  let planned = 0
  let done = 0
  let missed = 0
  let skipped = 0

  for (let day = 1; day <= 31; day++) {
    const d = new Date(y, mon, day)
    if (d.getMonth() !== mon) break
    if (d > today) break
    calendarDays++
    const key = formatLocalYmd(d)
    if (habitScheduledOnDate(habit, key)) planned++
    const checkIn = checkInForDay(habit, key)
    if (checkIn?.status === 'missed') missed++
    if (checkIn?.status === 'skipped') skipped++
    if (habitDayIsDone(habit, key)) done++
  }

  const expected = expectedHabitCountInWindow(habit, Math.max(1, calendarDays), planned)
  const effectiveExpected = Math.max(1, expected - skipped)
  return {
    done,
    missed,
    skipped,
    expected,
    pct: Math.round((done / effectiveExpected) * 100),
  }
}

function toggleScheduleDayValue(
  day: number,
  setDays: Dispatch<SetStateAction<number[]>>
) {
  setDays((prev) =>
    prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
  )
}

function buildHabitSchedulePayload(
  type: HabitScheduleType,
  days: number[],
  weeklyRaw: string,
  monthlyRaw: string
) {
  return {
    scheduleType: type,
    scheduleDays: type === 'weekdays' ? days : [],
    weeklyTarget:
      type === 'weekly' ? Math.max(1, Math.round(parseGoalNumber(weeklyRaw) || 1)) : null,
    monthlyTarget:
      type === 'monthly' ? Math.max(1, Math.round(parseGoalNumber(monthlyRaw) || 1)) : null,
  }
}

function HabitCreateForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, extras: {
    unit: string | null
    targetPerDay: number | null
    category: string | null
    color: string | null
    scheduleType: HabitScheduleType
    scheduleDays: number[]
    weeklyTarget: number | null
    monthlyTarget: number | null
  }) => void
  onCancel: () => void
}) {
  const { t, i18n } = useTranslation('habits')
  const isMobile = useIsMobile()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [targetRaw, setTargetRaw] = useState('')
  const [category, setCategory] = useState('')
  const [scheduleType, setScheduleType] = useState<HabitScheduleType>('daily')
  const [scheduleDays, setScheduleDays] = useState<number[]>([])
  const [weeklyTargetRaw, setWeeklyTargetRaw] = useState('')
  const [monthlyTargetRaw, setMonthlyTargetRaw] = useState('')
  const [accentId, setAccentId] = useState<HabitAccentId>(HABIT_ACCENT_PRESETS[1].id)
  const weekdayShort = weekdayShortLabels(i18n.language)

  const accentHex =
    HABIT_ACCENT_PRESETS.find((p) => p.id === accentId)?.hex ?? HABIT_ACCENT_PRESETS[1].hex

  const submit = () => {
    if (!name.trim()) return
    const parsedTarget = parseGoalNumber(targetRaw)
    const targetPerDay =
      targetRaw.trim() !== '' && !Number.isNaN(parsedTarget) && parsedTarget > 0
        ? parsedTarget
        : null
    onAdd(name.trim(), {
      unit: unit.trim() || null,
      targetPerDay,
      category: category.trim() || null,
      color: accentHex,
      ...buildHabitSchedulePayload(scheduleType, scheduleDays, weeklyTargetRaw, monthlyTargetRaw),
    })
  }

  const formFields = (
    <div className="space-y-4">
      <div>
        <label htmlFor="new-habit-name" className="mb-2 block text-base text-(--text-muted)">
          {t('form.nameLabel')}
        </label>
        <input
          id="new-habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter') submit()
          }}
          className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
          autoFocus={!isMobile}
          placeholder={t('form.namePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-habit-category" className="mb-2 block text-base text-(--text-muted)">
            {t('form.categoryLabel')}
          </label>
          <input
            id="new-habit-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
            placeholder={t('form.categoryPlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="new-habit-schedule" className="mb-2 block text-base text-(--text-muted)">
            {t('form.scheduleLabel')}
          </label>
          <select
            id="new-habit-schedule"
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as HabitScheduleType)}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
          >
            {SCHEDULE_TYPE_ORDER.map((value) => (
              <option key={value} value={value}>
                {scheduleTypeLabel(t, value)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {scheduleType === 'weekdays' && (
        <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
          {weekdayShort.map((day, i) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleScheduleDayValue(i, setScheduleDays)}
              className={`rounded-lg border px-2 py-2.5 text-base sm:px-3 sm:py-2 ${
                scheduleDays.includes(i)
                  ? 'border-(--accent)/50 bg-(--accent)/15 text-(--accent)'
                  : 'border-(--border) text-(--text-muted)'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      )}
      {scheduleType === 'weekly' && (
        <div>
          <label htmlFor="new-habit-weekly" className="mb-2 block text-base text-(--text-muted)">
            {t('form.weeklyCountLabel')}
          </label>
          <input
            id="new-habit-weekly"
            type="text"
            inputMode="numeric"
            value={weeklyTargetRaw}
            onChange={(e) => setWeeklyTargetRaw(sanitizeGoalNumber(e.target.value))}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) sm:max-w-xs"
            placeholder={t('form.weeklyCountPlaceholder')}
          />
        </div>
      )}
      {scheduleType === 'monthly' && (
        <div>
          <label htmlFor="new-habit-monthly" className="mb-2 block text-base text-(--text-muted)">
            {t('form.monthlyCountLabel')}
          </label>
          <input
            id="new-habit-monthly"
            type="text"
            inputMode="numeric"
            value={monthlyTargetRaw}
            onChange={(e) => setMonthlyTargetRaw(sanitizeGoalNumber(e.target.value))}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) sm:max-w-xs"
            placeholder={t('form.monthlyCountPlaceholder')}
          />
        </div>
      )}
      <div>
        <p className="mb-2 text-base font-medium text-(--text-primary)">{t('form.measurableTitle')}</p>
        <p className="mb-3 text-base text-(--text-muted)">{t('form.measurableHint')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-habit-unit" className="mb-2 block text-base text-(--text-muted)">
              {t('form.unitLabel')}
            </label>
            <input
              id="new-habit-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
              placeholder={t('form.unitPlaceholder')}
            />
          </div>
          <div>
            <label htmlFor="new-habit-target" className="mb-2 block text-base text-(--text-muted)">
              {t('form.targetLabel')}
            </label>
            <input
              id="new-habit-target"
              type="text"
              inputMode="decimal"
              value={targetRaw}
              onChange={(e) => setTargetRaw(sanitizeGoalNumber(e.target.value))}
              className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
              placeholder={t('form.targetPlaceholder')}
            />
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-base text-(--text-muted)">{t('form.colorLabel')}</p>
        <div className="flex flex-wrap gap-2.5 sm:gap-2" role="group" aria-label={t('form.colorGroupAriaNew')}>
          {HABIT_ACCENT_PRESETS.map((p) => {
            const selected = accentId === p.id
            const label = habitAccentLabel(t, p.id)
            return (
              <button
                key={p.id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => setAccentId(p.id)}
                className={`h-9 w-9 shrink-0 rounded-full border-2 transition-transform sm:h-7 sm:w-7 ${
                  selected
                    ? 'scale-105 ring-2 ring-(--text-primary) ring-offset-2 ring-offset-(--bg-card)'
                    : 'border-(--border) hover:scale-105'
                }`}
                style={{ backgroundColor: p.hex }}
              />
            )
          })}
        </div>
      </div>
      <div className="space-y-2 border-t border-(--border)/60 pt-4 sm:flex sm:flex-wrap sm:gap-2 sm:space-y-0">
        <button
          type="button"
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-base hover:opacity-90 sm:w-auto sm:py-2"
          style={{
            borderColor: hexAlpha(accentHex, 0.45),
            backgroundColor: hexAlpha(accentHex, 0.14),
            color: accentHex,
          }}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {t('form.submitAdd')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-(--border) px-4 py-2.5 text-base text-(--text-muted) hover:bg-(--bg-card) sm:w-auto sm:py-2"
        >
          <X className="h-4 w-4 shrink-0" />
          {t('form.cancel')}
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <ModalShell isOpen onClose={onCancel} maxWidth="max-w-lg" padding="px-4 pt-2 pb-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-(--text-primary)">{t('form.mobileNewTitle')}</p>
            <p className="text-sm text-(--text-muted)">{t('form.mobileNewSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-lg p-2 text-(--text-muted) hover:bg-(--bg-card) hover:text-(--text-primary)"
            aria-label={t('form.closeAria')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {formFields}
      </ModalShell>
    )
  }

  return (
    <div className="rounded-lg border border-(--border)/55 bg-(--bg-card)/20 p-4">
      <p className="mb-4 text-base font-medium text-(--text-primary)">{t('form.desktopNewTitle')}</p>
      {formFields}
    </div>
  )
}

function GoalCreateForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: { name: string; target: number; current: number; unit?: string }) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('habits')
  const isMobile = useIsMobile()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('0')
  const [unit, setUnit] = useState('')

  const submit = () => {
    const trimmedName = name.trim()
    const parsedTarget = parseGoalNumber(target)
    const parsedCurrent = parseGoalNumber(current)
    if (!trimmedName || Number.isNaN(parsedTarget) || parsedTarget <= 0) return
    onAdd({
      name: trimmedName,
      target: parsedTarget,
      current: parsedCurrent,
      unit: unit.trim() || undefined,
    })
    setName('')
    setTarget('')
    setCurrent('0')
    setUnit('')
  }

  const formFields = (
    <div className="space-y-4">
      <div>
        <label htmlFor="new-goal-name" className="mb-2 block text-base text-(--text-muted)">
          {t('goalForm.nameLabel')}
        </label>
        <input
          id="new-goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter') submit()
          }}
          className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
          autoFocus={!isMobile}
          placeholder={t('goalForm.namePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="new-goal-current" className="mb-2 block text-base text-(--text-muted)">
            {t('goalForm.currentLabel')}
          </label>
          <input
            id="new-goal-current"
            type="text"
            inputMode="decimal"
            value={current}
            onChange={(e) => setCurrent(sanitizeGoalNumber(e.target.value))}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
          />
        </div>
        <div>
          <label htmlFor="new-goal-target" className="mb-2 block text-base text-(--text-muted)">
            {t('goalForm.targetLabel')}
          </label>
          <input
            id="new-goal-target"
            type="text"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(sanitizeGoalNumber(e.target.value))}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
            placeholder={t('goalForm.targetPlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="new-goal-unit" className="mb-2 block text-base text-(--text-muted)">
            {t('goalForm.unitLabel')}
          </label>
          <input
            id="new-goal-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
            placeholder={t('goalForm.unitPlaceholder')}
          />
        </div>
      </div>
      <div className="space-y-2 border-t border-(--border)/60 pt-4 sm:flex sm:flex-wrap sm:gap-2 sm:space-y-0">
        <button
          type="button"
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-(--accent)/40 bg-(--accent)/15 px-4 py-3 text-base text-(--accent) hover:bg-(--accent)/25 sm:w-auto sm:py-2"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {t('goalForm.submitAdd')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-(--border) px-4 py-2.5 text-base text-(--text-muted) hover:bg-(--bg-card) sm:w-auto sm:py-2"
        >
          <X className="h-4 w-4 shrink-0" />
          {t('goalForm.cancel')}
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <ModalShell isOpen onClose={onCancel} maxWidth="max-w-lg" padding="px-4 pt-2 pb-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-(--text-primary)">{t('goalForm.mobileNewTitle')}</p>
            <p className="text-sm text-(--text-muted)">{t('goalForm.mobileNewSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-lg p-2 text-(--text-muted) hover:bg-(--bg-card) hover:text-(--text-primary)"
            aria-label={t('goalForm.closeAria')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {formFields}
      </ModalShell>
    )
  }

  return (
    <div className="rounded-lg border border-(--border)/55 bg-(--bg-card)/20 p-4">
      <p className="mb-4 text-base font-medium text-(--text-primary)">{t('goalForm.desktopNewTitle')}</p>
      {formFields}
    </div>
  )
}

function formatHabitEditorDate(date: string): string {
  return parseLocalYmd(date).toLocaleDateString(activeDateLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function HabitDayEditor({
  habit,
  date,
  measurable,
  accentHex,
  onSave,
  onRemove,
  onClose,
}: {
  habit: HabitItem
  date: string
  measurable: boolean
  accentHex: string
  onSave: (
    value: number | null,
    extras: { status: HabitCheckInStatus; note: string | null }
  ) => Promise<boolean>
  onRemove: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('habits')
  const isMobile = useIsMobile()
  const checkIn = checkInForDay(habit, date)
  const [valueRaw, setValueRaw] = useState(() =>
    checkIn?.value != null && checkIn.value > 0 ? String(checkIn.value) : ''
  )
  const [status, setStatus] = useState<HabitCheckInStatus>(checkIn?.status ?? 'done')
  const [note, setNote] = useState(checkIn?.note ?? '')

  useEffect(() => {
    const next = checkInForDay(habit, date)
    setValueRaw(next?.value != null && next.value > 0 ? String(next.value) : '')
    setStatus(next?.status ?? 'done')
    setNote(next?.note ?? '')
  }, [habit, date])

  const handleSave = async () => {
    const n = parseGoalNumber(valueRaw)
    if (measurable && status === 'done' && (Number.isNaN(n) || n <= 0)) return
    const ok = await onSave(measurable ? n : null, {
      status,
      note: note.trim() || null,
    })
    if (ok) onClose()
  }

  const editorBody = (
    <>
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-0">
        <div className="min-w-0">
          {isMobile && (
            <p className="truncate text-base font-medium text-(--text-primary)">{habit.name}</p>
          )}
          <p
            className={`font-medium text-(--text-primary) ${
              isMobile ? 'text-sm text-(--text-muted)' : 'text-base'
            }`}
          >
            {isMobile ? formatHabitEditorDate(date) : t('dayEditor.entryForDate', { date })}
          </p>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-(--text-muted) hover:bg-(--bg-card) hover:text-(--text-primary)"
            aria-label={t('dayEditor.close')}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-4 sm:space-y-4">
        <div>
          <label
            htmlFor={`day-status-${habit.id}-${date}`}
            className="mb-2 block text-base text-(--text-muted)"
          >
            {t('dayEditor.dayStatusLabel')}
          </label>
          <div
            id={`day-status-${habit.id}-${date}`}
            className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"
            role="radiogroup"
            aria-label={t('dayEditor.dayStatusLabel')}
          >
            {CHECK_IN_STATUS_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                onClick={() => setStatus(value)}
                className={`rounded-lg border px-4 py-3 text-base transition-colors sm:px-3 sm:py-1.5 ${
                  status === value
                    ? 'border-(--accent)/50 bg-(--accent)/15 text-(--accent)'
                    : 'border-(--border) text-(--text-muted) hover:bg-(--bg-card)'
                } ${isMobile ? 'w-full text-left' : ''}`}
              >
                {checkInStatusLabel(t, value)}
              </button>
            ))}
          </div>
        </div>

        {measurable && (
          <div>
            <label
              htmlFor={`day-value-${habit.id}-${date}`}
              className="mb-2 block text-base text-(--text-muted)"
            >
              {t('dayEditor.valueLabel')}{habit.unit ? ` (${habit.unit})` : ''}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                id={`day-value-${habit.id}-${date}`}
                type="text"
                inputMode="decimal"
                value={valueRaw}
                onChange={(e) => setValueRaw(sanitizeGoalNumber(e.target.value))}
                className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25 sm:max-w-xs"
              />
              {habit.targetPerDay != null && habit.targetPerDay > 0 && (
                <button
                  type="button"
                  onClick={() => setValueRaw(String(habit.targetPerDay))}
                  className="w-full rounded-lg border border-(--border) px-3 py-2.5 text-base text-(--text-muted) hover:bg-(--bg-card) hover:text-(--text-primary) sm:w-auto sm:py-2"
                >
                  {t('dayEditor.useTargetButton')}
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor={`day-note-${habit.id}-${date}`}
            className="mb-2 block text-base text-(--text-muted)"
          >
            {t('dayEditor.noteLabel')}
          </label>
          <textarea
            id={`day-note-${habit.id}-${date}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={isMobile ? 2 : 3}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
            placeholder={t('dayEditor.notePlaceholder')}
          />
        </div>
      </div>

      <div className="mt-6 space-y-2 border-t border-(--border)/60 pt-4 sm:mt-4 sm:flex sm:flex-wrap sm:gap-2 sm:space-y-0">
        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-lg border px-4 py-3 text-base hover:opacity-90 sm:w-auto sm:py-2"
          style={{
            borderColor: hexAlpha(accentHex, 0.45),
            backgroundColor: hexAlpha(accentHex, 0.14),
            color: accentHex,
          }}
        >
          {t('dayEditor.save')}
        </button>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-(--border) px-4 py-2.5 text-base text-(--text-muted) hover:bg-(--bg-card) sm:py-2"
          >
            {t('dayEditor.removeDay')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-(--border) px-4 py-2.5 text-base text-(--text-muted) hover:bg-(--bg-card) hover:text-(--text-primary) sm:border-0 sm:py-2 sm:hover:bg-transparent"
          >
            {t('dayEditor.close')}
          </button>
        </div>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <ModalShell isOpen onClose={onClose} maxWidth="max-w-lg" padding="px-4 pt-2 pb-4">
        {editorBody}
      </ModalShell>
    )
  }

  return (
    <div className="mt-2 w-full space-y-4 rounded-lg border border-(--border) bg-(--bg-card)/25 p-4 sm:p-5">
      {editorBody}
    </div>
  )
}

function formatHabitGridDayLabel(date: string): string {
  return String(parseLocalYmd(date).getDate())
}

type HabitEditFormProps = {
  habit: HabitItem
  accentHex: string
  name: string
  setName: (value: string) => void
  category: string
  setCategory: (value: string) => void
  scheduleType: HabitScheduleType
  setScheduleType: (value: HabitScheduleType) => void
  scheduleDays: number[]
  setScheduleDays: Dispatch<SetStateAction<number[]>>
  weeklyTargetRaw: string
  setWeeklyTargetRaw: (value: string) => void
  monthlyTargetRaw: string
  setMonthlyTargetRaw: (value: string) => void
  unit: string
  setUnit: (value: string) => void
  targetRaw: string
  setTargetRaw: (value: string) => void
  color: string | null
  setColor: (value: string | null) => void
  onCancel: () => void
  onSave: () => void
}

function HabitEditForm({
  habit,
  accentHex,
  name,
  setName,
  category,
  setCategory,
  scheduleType,
  setScheduleType,
  scheduleDays,
  setScheduleDays,
  weeklyTargetRaw,
  setWeeklyTargetRaw,
  monthlyTargetRaw,
  setMonthlyTargetRaw,
  unit,
  setUnit,
  targetRaw,
  setTargetRaw,
  color,
  setColor,
  onCancel,
  onSave,
}: HabitEditFormProps) {
  const { t, i18n } = useTranslation('habits')
  const isMobile = useIsMobile()
  const weekdayShort = weekdayShortLabels(i18n.language)

  const formFields = (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`edit-habit-name-${habit.id}`}
          className="mb-2 block text-base text-(--text-muted)"
        >
          {t('form.nameLabel')}
        </label>
        <input
          id={`edit-habit-name-${habit.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
          }}
          className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
          autoFocus={!isMobile}
          placeholder={t('form.namePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`edit-habit-category-${habit.id}`}
            className="mb-2 block text-base text-(--text-muted)"
          >
            {t('form.categoryLabel')}
          </label>
          <input
            id={`edit-habit-category-${habit.id}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
            placeholder={t('form.categoryPlaceholder')}
          />
        </div>
        <div>
          <label
            htmlFor={`edit-habit-schedule-${habit.id}`}
            className="mb-2 block text-base text-(--text-muted)"
          >
            {t('form.scheduleLabel')}
          </label>
          <select
            id={`edit-habit-schedule-${habit.id}`}
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as HabitScheduleType)}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
          >
            {SCHEDULE_TYPE_ORDER.map((value) => (
              <option key={value} value={value}>
                {scheduleTypeLabel(t, value)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {scheduleType === 'weekdays' && (
        <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
          {weekdayShort.map((day, i) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleScheduleDayValue(i, setScheduleDays)}
              className={`rounded-lg border px-2 py-2.5 text-base sm:px-3 sm:py-2 ${
                scheduleDays.includes(i)
                  ? 'border-(--accent)/50 bg-(--accent)/15 text-(--accent)'
                  : 'border-(--border) text-(--text-muted)'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      )}
      {scheduleType === 'weekly' && (
        <div>
          <label className="mb-2 block text-base text-(--text-muted)">{t('form.weeklyCountLabel')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={weeklyTargetRaw}
            onChange={(e) => setWeeklyTargetRaw(sanitizeGoalNumber(e.target.value))}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) sm:max-w-xs"
            placeholder={t('form.weeklyCountPlaceholder')}
          />
        </div>
      )}
      {scheduleType === 'monthly' && (
        <div>
          <label className="mb-2 block text-base text-(--text-muted)">{t('form.monthlyCountLabel')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={monthlyTargetRaw}
            onChange={(e) => setMonthlyTargetRaw(sanitizeGoalNumber(e.target.value))}
            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) sm:max-w-xs"
            placeholder={t('form.monthlyCountPlaceholder')}
          />
        </div>
      )}
      <div>
        <p className="mb-2 text-base font-medium text-(--text-primary)">{t('form.measurableTitle')}</p>
        <p className="mb-3 text-base text-(--text-muted)">{t('form.measurableHint')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`edit-habit-unit-${habit.id}`}
              className="mb-2 block text-base text-(--text-muted)"
            >
              {t('form.unitLabel')}
            </label>
            <input
              id={`edit-habit-unit-${habit.id}`}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
              placeholder={t('form.unitPlaceholder')}
            />
          </div>
          <div>
            <label
              htmlFor={`edit-habit-target-${habit.id}`}
              className="mb-2 block text-base text-(--text-muted)"
            >
              {t('form.targetLabel')}
            </label>
            <input
              id={`edit-habit-target-${habit.id}`}
              type="text"
              inputMode="decimal"
              value={targetRaw}
              onChange={(e) => setTargetRaw(sanitizeGoalNumber(e.target.value))}
              className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
              placeholder={t('form.targetPlaceholder')}
            />
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-base text-(--text-muted)">{t('form.colorLabel')}</p>
        <div className="flex flex-wrap gap-2.5 sm:gap-2" role="group" aria-label={t('form.colorGroupAriaEdit')}>
          {HABIT_ACCENT_PRESETS.map((p) => {
            const selected = (color ?? accentHex) === p.hex
            const label = habitAccentLabel(t, p.id)
            return (
              <button
                key={p.id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => setColor(p.hex)}
                className={`h-9 w-9 shrink-0 rounded-full border-2 transition-transform sm:h-7 sm:w-7 ${
                  selected
                    ? 'scale-105 ring-2 ring-(--text-primary) ring-offset-2 ring-offset-(--bg-card)'
                    : 'border-(--border) hover:scale-105'
                }`}
                style={{ backgroundColor: p.hex }}
              />
            )
          })}
        </div>
      </div>
      <div className="space-y-2 border-t border-(--border)/60 pt-4 sm:flex sm:flex-wrap sm:gap-2 sm:space-y-0">
        <button
          type="button"
          onClick={onSave}
          className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-base hover:opacity-90 sm:w-auto sm:py-2"
          style={{
            borderColor: hexAlpha(accentHex, 0.45),
            backgroundColor: hexAlpha(accentHex, 0.14),
            color: accentHex,
          }}
        >
          <Check className="h-4 w-4 shrink-0" />
          {t('form.submitSave')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-(--border) px-4 py-2.5 text-base text-(--text-muted) hover:bg-(--bg-card) sm:w-auto sm:py-2"
        >
          <X className="h-4 w-4 shrink-0" />
          {t('form.cancel')}
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <ModalShell isOpen onClose={onCancel} maxWidth="max-w-lg" padding="px-4 pt-2 pb-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-(--text-primary)">{t('form.mobileEditTitle')}</p>
            <p className="truncate text-sm text-(--text-muted)">{habit.name}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-lg p-2 text-(--text-muted) hover:bg-(--bg-card) hover:text-(--text-primary)"
            aria-label={t('form.closeAria')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {formFields}
      </ModalShell>
    )
  }

  return (
    <div className="w-full space-y-4 rounded-lg border border-(--border) bg-(--bg-card)/30 p-4">
      {formFields}
    </div>
  )
}

type HabitDayCellProps = {
  habit: HabitItem
  date: string
  accentHex: string
  measurable: boolean
  isArchived: boolean
  isSelected: boolean
  cellClassName: string
  onSelect: (date: string) => void
}

function HabitDayCell({
  habit,
  date,
  accentHex,
  measurable,
  isArchived,
  isSelected,
  cellClassName,
  onSelect,
}: HabitDayCellProps) {
  const { t } = useTranslation('habits')
  const checkIn = checkInForDay(habit, date)
  const checked = !!checkIn
  const pct =
    checkIn?.status === 'done' ? dayFillPercent(habit, checkIn.value ?? null) : 0
  const titleBits = [date]
  if (checkIn?.status) titleBits.push(checkInStatusLabel(t, checkIn.status))
  if (checkIn && checkIn.value != null && checkIn.value > 0) {
    titleBits.push(`${checkIn.value} ${habit.unit ?? ''}`.trim())
  } else if (checked) {
    titleBits.push(t('dayEditor.checkedFallback'))
  }
  if (checkIn?.note) titleBits.push(checkIn.note)

  return (
    <button
      type="button"
      onClick={() => {
        if (!isArchived) onSelect(date)
      }}
      className={`relative overflow-hidden rounded-md border transition-colors ${cellClassName} ${
        measurable
          ? 'border-(--border) hover:opacity-90'
          : checked
            ? 'border-transparent'
            : 'border-transparent bg-(--border) hover:bg-(--border)/80'
      } ${
        isSelected
          ? 'z-10 ring-2 ring-(--accent) ring-offset-2 ring-offset-(--bg-card)'
          : ''
      }`}
      title={titleBits.join(' — ')}
    >
      {measurable ? (
        <>
          <span className="absolute inset-0 bg-(--border)" />
          <span
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: `${pct}%`,
              backgroundColor: hexAlpha(accentHex, 0.92),
            }}
          />
          {checkIn?.status && checkIn.status !== 'done' && (
            <span
              className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full sm:right-1 sm:top-1 sm:h-2 sm:w-2"
              style={{
                backgroundColor: checkIn.status === 'missed' ? '#f87171' : '#94a3b8',
              }}
            />
          )}
        </>
      ) : (
        <span
          className={`block h-full w-full rounded-sm ${
            checked ? '' : 'bg-(--border) hover:bg-(--border)/80'
          }`}
          style={
            checked
              ? {
                  backgroundColor:
                    checkIn?.status === 'missed'
                      ? '#f87171'
                      : checkIn?.status === 'skipped'
                        ? '#94a3b8'
                        : accentHex,
                }
              : undefined
          }
        />
      )}
    </button>
  )
}

type HabitGridMobileStripProps = {
  habit: HabitItem
  dates: string[]
  letters: string[]
  accentHex: string
  measurable: boolean
  isArchived: boolean
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

function HabitGridMobileStrip({
  habit,
  dates,
  letters,
  accentHex,
  measurable,
  isArchived,
  selectedDate,
  onSelectDate,
}: HabitGridMobileStripProps) {
  const { t } = useTranslation('habits')
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastDate = dates[dates.length - 1]

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth - el.clientWidth
  }, [habit.id, dates.length, lastDate])

  return (
    <div className="pt-0.5 sm:hidden">
      <div
        ref={scrollRef}
        className="flex touch-pan-x gap-1.5 overflow-x-auto overscroll-x-contain py-1 pb-2.5 scrollbar-hidden"
      >
        {dates.map((date, i) => (
            <div
              key={date}
              className={`flex ${HABIT_MOBILE_CELL_WIDTH} shrink-0 flex-col items-center gap-1 px-0.5`}
            >
              <span className="text-xs leading-none text-(--text-muted)">{letters[i]}</span>
              <HabitDayCell
                habit={habit}
                date={date}
                accentHex={accentHex}
                measurable={measurable}
                isArchived={isArchived}
                isSelected={selectedDate === date}
                cellClassName="aspect-square w-full min-w-0"
                onSelect={onSelectDate}
              />
              <span className="min-h-4.5 pt-0.5 text-xs leading-tight tabular-nums text-(--text-muted)">
                {formatHabitGridDayLabel(date)}
              </span>
            </div>
          ))}
      </div>
      {dates.length > EMPTY_GRID_DAYS && (
        <p className="mt-2.5 text-xs text-(--text-muted)">
          {t('habitsCard.scrollHint')}
        </p>
      )}
    </div>
  )
}

export function Habits() {
  const { t, i18n } = useTranslation('habits')
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const { isDemoMode } = useAuth()
  const {
    habits,
    goals,
    addHabit,
    updateHabit,
    removeHabit,
    restoreHabit,
    deleteHabitPermanently,
    upsertHabitDayValue,
    removeHabitDay,
    addGoal,
    updateGoal,
    removeGoal,
    loading,
  } = useHabits()

  const [showHabitForm, setShowHabitForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [showArchivedHabits, setShowArchivedHabits] = useState(false)
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editingHabitName, setEditingHabitName] = useState('')
  const [editingHabitUnit, setEditingHabitUnit] = useState('')
  const [editingHabitTargetRaw, setEditingHabitTargetRaw] = useState('')
  const [editingHabitCategory, setEditingHabitCategory] = useState('')
  const [editingHabitScheduleType, setEditingHabitScheduleType] = useState<HabitScheduleType>('daily')
  const [editingHabitScheduleDays, setEditingHabitScheduleDays] = useState<number[]>([])
  const [editingHabitWeeklyTargetRaw, setEditingHabitWeeklyTargetRaw] = useState('')
  const [editingHabitMonthlyTargetRaw, setEditingHabitMonthlyTargetRaw] = useState('')
  const [editingHabitColor, setEditingHabitColor] = useState<string | null>(null)
  const [measurableEditor, setMeasurableEditor] = useState<{
    habitId: string
    date: string
  } | null>(null)
  const [habitPendingDelete, setHabitPendingDelete] = useState<{
    id: string
    name: string
    permanent?: boolean
  } | null>(null)
  const [goalPendingDelete, setGoalPendingDelete] = useState<{
    id: string
    name: string
    completed: boolean
  } | null>(null)
  const [goalToast, setGoalToast] = useState<{
    type: 'progress' | 'completed'
    goalId: string
    goalName: string
    previousValue: number
  } | null>(null)
  const goalToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingGoal, setEditingGoal] = useState({ name: '', target: '', unit: '', current: '' })
  const [showCompletedGoals, setShowCompletedGoals] = useState(false)
  /** Expanded habit "middle" panel: chart + streak record. */
  const [habitExpandedId, setHabitExpandedId] = useState<string | null>(null)
  /** Chart time range in the details panel (per habit). */
  const [habitChartPeriod, setHabitChartPeriod] = useState<
    Record<string, HabitChartPeriod>
  >({})
  const [habitCalendarMonth, setHabitCalendarMonth] = useState<Record<string, string>>({})
  const [habitAccentChoice, setHabitAccentChoice] = useState<Record<string, string>>(
    readHabitAccentStorage
  )

  const habitGrids = useMemo(
    () => habits.map((h) => getHabitGridDates(h, i18n.language)),
    [habits, i18n.language]
  )
  const habitGridById = useMemo(
    () =>
      Object.fromEntries(habits.map((h, i) => [h.id, habitGrids[i]] as const)),
    [habits, habitGrids]
  )
  const activeHabits = useMemo(() => habits.filter((h) => !h.archivedAt), [habits])
  const archivedHabits = useMemo(() => habits.filter((h) => !!h.archivedAt), [habits])
  const visibleHabits = showArchivedHabits ? archivedHabits : activeHabits
  const activeGoals = useMemo(() => goals.filter((g) => g.current < g.target), [goals])
  const completedGoals = useMemo(() => goals.filter((g) => g.current >= g.target), [goals])
  const visibleGoals = showCompletedGoals ? completedGoals : activeGoals

  /** 0 = newest window (last N days); higher value = older window (backwards in time only). */
  const [habitGridSlider, setHabitGridSlider] = useState<Record<string, number>>({})

  const habitDetailPanelVariants = useMemo(
    () => ({
      hidden: reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, y: 14, scale: 0.99 },
      show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: reduceMotion ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const } : TODO_ITEM_SPRING,
      },
      leave: {
        opacity: 0,
        y: 6,
        transition: { duration: reduceMotion ? 0.1 : 0.15, ease: 'easeOut' as const },
      },
    }),
    [reduceMotion]
  )

  useLayoutEffect(() => {
    setHabitGridSlider((prev) => {
      const next = { ...prev }
      let changed = false
      habits.forEach((h, i) => {
        const len = habitGrids[i]?.dates.length ?? 0
        const maxS = Math.max(0, len - EMPTY_GRID_DAYS)
        const v = next[h.id] ?? 0
        if (v > maxS) {
          next[h.id] = maxS
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [habits, habitGrids])

  const getStreak = (habit: HabitItem) => {
    let streak = 0
    const today = new Date().toISOString().split('T')[0]
    const d = new Date(today)
    while (true) {
      const key = d.toISOString().split('T')[0]
      if (habitDayIsDone(habit, key)) {
        streak++
        d.setDate(d.getDate() - 1)
      } else {
        break
      }
    }
    return streak
  }

  if (loading) {
    return <SimplePageSkeleton titleWidth="w-44" />
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-(--text-primary) font-display tracking-wider">
          {t('header.title')}
        </h1>
        <p className="text-base text-(--text-muted) mt-1 font-display tracking-wide">
          {isDemoMode ? t('header.subtitleDemo') : t('header.subtitleNormal')}
        </p>
      </div>
      {/* Nawyki */}
      <Card title={t('habitsCard.cardTitle')} className="border-(--positive)/20 max-md:p-4">
        <div className="flex flex-col">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchivedHabits(false)}
              className={`rounded-lg border px-3 py-2 text-base transition-colors ${
                !showArchivedHabits
                  ? 'border-(--border) bg-(--bg-dark) font-display tracking-wide text-(--text-primary)'
                  : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/60 hover:text-(--text-primary)'
              }`}
            >
              {t('habitsCard.activeTab', { count: activeHabits.length })}
            </button>
            <button
              type="button"
              onClick={() => setShowArchivedHabits(true)}
              className={`rounded-lg border px-3 py-2 text-base transition-colors ${
                showArchivedHabits
                  ? 'border-(--border) bg-(--bg-dark) font-display tracking-wide text-(--text-primary)'
                  : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/60 hover:text-(--text-primary)'
              }`}
            >
              {t('habitsCard.archivedTab', { count: archivedHabits.length })}
            </button>
            {showArchivedHabits && (
              <span className="text-base text-(--text-muted)">
                {t('habitsCard.archivedHint')}
              </span>
            )}
          </div>
          {visibleHabits.map((habit, habitIdx) => {
            const { dates: gridDates, letters: gridDayLetters } = habitGridById[habit.id] ?? {
              dates: [],
              letters: [],
            }
            const maxStart = Math.max(0, gridDates.length - EMPTY_GRID_DAYS)
            const sliderBack = Math.min(habitGridSlider[habit.id] ?? 0, maxStart)
            const windowStart = maxStart - sliderBack
            const visibleDates = gridDates.slice(windowStart, windowStart + EMPTY_GRID_DAYS)
            const visibleLetters = gridDayLetters.slice(windowStart, windowStart + EMPTY_GRID_DAYS)
            const selectedGridDate =
              measurableEditor?.habitId === habit.id ? measurableEditor.date : null
            const streak = getStreak(habit)
            const isEditing = editingHabitId === habit.id
            const isArchived = !!habit.archivedAt
            const isExpanded = habitExpandedId === habit.id
            const measurable = isMeasurableHabit(habit)
            const weekdayCompletionCounts = isExpanded
              ? countCompletionsByWeekday(habit, measurable)
              : [0, 0, 0, 0, 0, 0, 0]
            const sumLastPeriod = measurable ? sumLastNDays(habit, SUM_LAST_DAYS) : 0
            const longestStreak = isExpanded ? getLongestStreakDays(habit) : 0
            const chartPeriod = habitChartPeriod[habit.id] ?? '30d'
            const chartSeries = isExpanded ? buildHabitChartSeries(habit, measurable, chartPeriod) : []
            const weekdayStats = isExpanded ? computeWeekdayStats(habit, measurable) : null
            const chartScrollWide =
              chartSeries.length > 36 ||
              chartPeriod === 'all' ||
              chartPeriod === '90d'
            const chartInnerMinWidthPx = Math.max(320, chartSeries.length * 5)
            const xAxisInterval =
              chartPeriod === 'year'
                ? 0
                : chartSeries.length > 48
                  ? Math.max(2, Math.floor(chartSeries.length / 14))
                  : chartSeries.length > 28
                    ? Math.max(1, Math.floor(chartSeries.length / 12))
                    : ('preserveStartEnd' as const)
            const xAxisMinTickGap =
              chartPeriod === 'year' ? 8 : chartSeries.length > 36 ? 4 : 24
            const chartXInterval = habitChartXAxisInterval(chartSeries.length, chartPeriod, isMobile)
            const chartMargin = isMobile
              ? { top: 6, right: 6, left: 0, bottom: 22 }
              : { top: 4, right: 8, left: 4, bottom: 8 }
            const chartWeeklyAggregated =
              chartPeriod === 'all' &&
              chartSeries.length > 0 &&
              chartSeries.some((pt) => pt.label.includes('–'))
            const chartGradId = `hg${habit.id.replace(/[^a-zA-Z0-9]/g, '')}`
            const fallbackAccentId = defaultHabitAccentId(`${habit.id}-${habit.name}`)
            const accentHex =
              (isEditing && editingHabitColor) ||
              habit.color ||
              resolveHabitAccentHex(habitAccentChoice, habit.id, fallbackAccentId)
            const stats7 = isExpanded ? computeHabitWindowStats(habit, 7) : null
            const stats30 = computeHabitWindowStats(habit, 30)
            const stats90 = isExpanded ? computeHabitWindowStats(habit, 90) : null
            const trend30 = isExpanded ? computeHabitTrend(habit, 30) : null
            const monthOptions = isExpanded ? buildHabitMonthOptions(habit) : []
            const selectedCalendarMonth =
              habitCalendarMonth[habit.id] ?? formatMonthKey(new Date())
            const currentMonthCalendar = isExpanded
              ? buildHabitMonthCalendar(habit, selectedCalendarMonth)
              : []
            const monthSummary = isExpanded
              ? computeHabitMonthSummary(habit, selectedCalendarMonth)
              : null

            const saveEditedHabit = () => {
              const name = editingHabitName.trim()
              if (!name) return
              const unit = editingHabitUnit.trim() || null
              const t = parseGoalNumber(editingHabitTargetRaw)
              const targetPerDay =
                editingHabitTargetRaw.trim() !== '' && !Number.isNaN(t) && t > 0 ? t : null
              updateHabit(habit.id, {
                name,
                unit,
                targetPerDay,
                category: editingHabitCategory.trim() || null,
                color: editingHabitColor,
                ...buildHabitSchedulePayload(
                  editingHabitScheduleType,
                  editingHabitScheduleDays,
                  editingHabitWeeklyTargetRaw,
                  editingHabitMonthlyTargetRaw
                ),
              })
              if (editingHabitColor) {
                setHabitAccentChoice((prev) => {
                  const matched = HABIT_ACCENT_PRESETS.find((p) => p.hex === editingHabitColor)
                  if (!matched) return prev
                  const next = { ...prev, [habit.id]: matched.id }
                  writeHabitAccentStorage(next)
                  return next
                })
              }
              setEditingHabitId(null)
            }

            const habitEditFormProps = {
              habit,
              accentHex,
              name: editingHabitName,
              setName: setEditingHabitName,
              category: editingHabitCategory,
              setCategory: setEditingHabitCategory,
              scheduleType: editingHabitScheduleType,
              setScheduleType: setEditingHabitScheduleType,
              scheduleDays: editingHabitScheduleDays,
              setScheduleDays: setEditingHabitScheduleDays,
              weeklyTargetRaw: editingHabitWeeklyTargetRaw,
              setWeeklyTargetRaw: setEditingHabitWeeklyTargetRaw,
              monthlyTargetRaw: editingHabitMonthlyTargetRaw,
              setMonthlyTargetRaw: setEditingHabitMonthlyTargetRaw,
              unit: editingHabitUnit,
              setUnit: setEditingHabitUnit,
              targetRaw: editingHabitTargetRaw,
              setTargetRaw: setEditingHabitTargetRaw,
              color: editingHabitColor,
              setColor: setEditingHabitColor,
              onCancel: () => setEditingHabitId(null),
              onSave: saveEditedHabit,
            }

            return (
              <div
                key={habit.id}
                className={
                  habitIdx > 0 ? 'mt-8 border-t border-(--border)/45 pt-8 sm:mt-10 sm:pt-10' : ''
                }
              >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
                className={`flex flex-col gap-4 rounded-xl border bg-(--bg-card)/20 p-3 transition-[border-color,box-shadow] duration-200 sm:gap-5 sm:p-5 ${
                  isEditing ? '' : 'border-(--border)/55'
                }`}
                style={
                  {
                    '--habit-accent': accentHex,
                    ...(isEditing
                      ? {
                          borderColor: hexAlpha(accentHex, 0.38),
                          boxShadow: `0 0 0 1px ${hexAlpha(accentHex, 0.12)}`,
                        }
                      : {}),
                  } as CSSProperties
                }
                onMouseEnter={(e) => {
                  if (isEditing) return
                  e.currentTarget.style.borderColor = hexAlpha(accentHex, 0.38)
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${hexAlpha(accentHex, 0.12)}`
                }}
                onMouseLeave={(e) => {
                  if (isEditing) return
                  e.currentTarget.style.removeProperty('border-color')
                  e.currentTarget.style.removeProperty('box-shadow')
                }}
              >
                <div className="flex items-start justify-between gap-3 max-md:gap-2">
                  <div
                    className={`flex min-w-0 flex-1 ${
                      isEditing && !isMobile
                        ? 'flex-col'
                        : 'flex-row flex-wrap items-center gap-3 max-md:flex-col max-md:items-start max-md:gap-2'
                    }`}
                  >
                    {isEditing && !isMobile ? (
                      <HabitEditForm {...habitEditFormProps} />
                    ) : (
                      <div className="flex min-w-0 items-start gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setHabitExpandedId((id) => (id === habit.id ? null : habit.id))
                          }
                          className="mt-0.5 shrink-0 rounded-md p-1 text-(--text-muted) transition-colors hover:bg-(--bg-card) hover:text-(--text-primary)"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? t('habitsCard.collapseAria')
                              : t('habitsCard.expandAria')
                          }
                          title={
                            isExpanded
                              ? t('habitsCard.collapseTitle')
                              : t('habitsCard.expandTitle')
                          }
                        >
                          <ChevronDown
                            className={`h-5 w-5 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            aria-hidden
                          />
                        </button>
                        <div className="min-w-0">
                          <p className="font-medium text-base">{habit.name}</p>
                          <p className="text-base text-(--text-muted) mt-0.5 max-md:truncate max-md:text-sm">
                            {[
                              habit.category,
                              formatHabitSchedule(t, i18n.language, habit),
                              measurable && habit.targetPerDay != null
                                ? t('habitsCard.dailyTargetLabel', { value: habit.targetPerDay, unit: habit.unit ?? '' })
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {isArchived && (
                            <p className="mt-1 text-base text-(--text-muted)">
                              {t('habitsCard.archivedAtLabel', { date: habit.archivedAt })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {!isEditing && streak > 0 && (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-(--warning)/40 bg-(--warning)/10 px-2.5 py-1 text-sm font-medium text-(--warning) max-md:ml-7">
                        <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t('habitsCard.streakLabel', { days: pluralDays(t, streak) })}
                      </span>
                    )}
                  </div>
                  {isEditing && isMobile && <HabitEditForm {...habitEditFormProps} />}
                  {!isEditing && (
                    <div className="flex items-center gap-1">
                      {isArchived ? (
                        <>
                        <button
                          type="button"
                          onClick={() => restoreHabit(habit.id)}
                          className="flex items-center gap-2 rounded-lg border border-(--accent)/40 bg-(--accent)/10 px-3 py-2 text-base text-(--accent) hover:bg-(--accent)/20"
                          title={t('habitsCard.restoreTitle')}
                        >
                          <Check className="h-4 w-4" />
                          {t('habitsCard.restoreButton')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setHabitPendingDelete({
                              id: habit.id,
                              name: habit.name,
                              permanent: true,
                            })
                          }
                          className="p-2 text-(--text-muted) hover:text-red-400 transition-colors"
                          title={t('habitsCard.deletePermanentTitle')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setHabitExpandedId(null)
                              setEditingHabitId(habit.id)
                              setEditingHabitName(habit.name)
                              setEditingHabitUnit(habit.unit ?? '')
                              setEditingHabitTargetRaw(
                                habit.targetPerDay != null ? String(habit.targetPerDay) : ''
                              )
                              setEditingHabitCategory(habit.category ?? '')
                              setEditingHabitScheduleType(habit.scheduleType)
                              setEditingHabitScheduleDays(habit.scheduleDays)
                              setEditingHabitWeeklyTargetRaw(
                                habit.weeklyTarget != null ? String(habit.weeklyTarget) : ''
                              )
                              setEditingHabitMonthlyTargetRaw(
                                habit.monthlyTarget != null ? String(habit.monthlyTarget) : ''
                              )
                              setEditingHabitColor(habit.color ?? null)
                            }}
                            className="p-2 text-(--text-muted) hover:text-(--accent) transition-colors"
                            title={t('habitsCard.editTitle')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setHabitPendingDelete({ id: habit.id, name: habit.name })
                            }
                            className="p-2 text-(--text-muted) hover:text-red-400 transition-colors"
                            title={t('habitsCard.archiveTitle')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="border-t border-(--border)/35 pt-3 sm:pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="min-w-0 w-full flex-1">
                      {measurable && !isExpanded && (
                        <p className="mb-1.5 text-base text-(--text-muted)">
                          {t('habitsCard.lastNDaysLabel', { count: SUM_LAST_DAYS })}
                          {sumLastPeriod > 0
                            ? ` · ${formatNumberPl(sumLastPeriod)}${habit.unit ? ` ${habit.unit}` : ''}`
                            : ''}
                        </p>
                      )}
                      <p className="mb-1.5 text-xs text-(--text-muted)">
                        {isExpanded && isMobile ? t('habitsCard.tapDayHint') : t('habitsCard.clickDayHint')}
                      </p>
                      <div className={HABIT_GRID_WRAP_CLASS}>
                        <HabitGridMobileStrip
                          habit={habit}
                          dates={gridDates}
                          letters={gridDayLetters}
                          accentHex={accentHex}
                          measurable={measurable}
                          isArchived={isArchived}
                          selectedDate={selectedGridDate}
                          onSelectDate={(date) => setMeasurableEditor({ habitId: habit.id, date })}
                        />
                        <div className="hidden flex-col gap-1.5 py-1 sm:flex">
                          <div
                            className={`${HABIT_GRID_COLS} text-base font-medium leading-none text-(--text-muted)`}
                          >
                            {visibleLetters.map((letter: string, i: number) => (
                              <span
                                key={i}
                                className={`flex ${HABIT_GRID_CELL} items-center justify-center`}
                              >
                                {letter}
                              </span>
                            ))}
                          </div>
                          <div className={HABIT_GRID_COLS} role="group" aria-label={t('habitsCard.gridAriaLabel')}>
                            {visibleDates.map((date: string) => (
                              <HabitDayCell
                                key={date}
                                habit={habit}
                                date={date}
                                accentHex={accentHex}
                                measurable={measurable}
                                isArchived={isArchived}
                                isSelected={selectedGridDate === date}
                                cellClassName={HABIT_GRID_CELL}
                                onSelect={(d) => setMeasurableEditor({ habitId: habit.id, date: d })}
                              />
                            ))}
                          </div>
                        </div>
                        {maxStart > 0 && (
                          <div className="mt-2 hidden flex-col gap-1 sm:flex">
                            <label
                              htmlFor={`habit-history-${habit.id}`}
                              className="sr-only"
                            >
                              {t('habitsCard.sliderSrLabel')}
                            </label>
                            <input
                              id={`habit-history-${habit.id}`}
                              type="range"
                              min={0}
                              max={maxStart}
                              step={1}
                              value={sliderBack}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                setHabitGridSlider((p) => ({ ...p, [habit.id]: v }))
                              }}
                              className="h-2 w-full max-w-[min(100%,27rem)] cursor-pointer"
                              style={{ accentColor: accentHex }}
                              title={t('habitsCard.sliderTitle')}
                            />
                          </div>
                        )}
                        {visibleDates.length > 0 && (
                          <p
                            className="mt-1.5 hidden text-xs text-(--text-muted) sm:block"
                            aria-live="polite"
                          >
                            {formatVisibleDateRange(visibleDates)}
                          </p>
                        )}
                      </div>
                    </div>
                    {stats30 && !isEditing && !(isMobile && isExpanded) && (
                      <div className="flex shrink-0 items-center gap-4 rounded-lg border border-(--border)/35 bg-(--bg-dark)/10 px-3 py-2 sm:block sm:space-y-1 sm:border-0 sm:bg-transparent sm:p-0 sm:text-right sm:pt-0.5">
                        <p className="text-xs text-(--text-muted) sm:mb-0">{t('habitsCard.stats30dLabel')}</p>
                        <p
                          className="text-lg font-semibold tabular-nums"
                          style={{ color: accentHex }}
                        >
                          {stats30.pct}%
                        </p>
                        <p className="text-xs text-(--text-muted)">
                          {stats30.done}/{Math.max(1, stats30.planned - stats30.skipped)}
                        </p>
                        {measurable && stats30.avgValue != null && (
                          <p className="text-xs text-(--text-muted)">
                            {t('habitsCard.avgValueLabel', {
                              value: stats30.avgValue.toFixed(1),
                              unit: habit.unit ? `\u00a0${habit.unit}` : '',
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {measurableEditor?.habitId === habit.id && (
                    <HabitDayEditor
                      habit={habit}
                      date={measurableEditor.date}
                      measurable={measurable}
                      accentHex={accentHex}
                      onSave={(value, extras) =>
                        upsertHabitDayValue(habit.id, measurableEditor.date, value, extras)
                      }
                      onRemove={() => {
                        removeHabitDay(habit.id, measurableEditor.date)
                        setMeasurableEditor(null)
                      }}
                      onClose={() => setMeasurableEditor(null)}
                    />
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {isExpanded && !isEditing && (
                    <motion.div
                      key={`habit-expanded-${habit.id}`}
                      variants={habitDetailPanelVariants}
                      initial="hidden"
                      animate="show"
                      exit="leave"
                      className="space-y-6 rounded-lg border border-(--border)/50 bg-(--bg-card)/15 p-4 max-md:space-y-3 max-md:p-3 sm:p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-base text-(--text-primary) max-md:text-sm">
                        <Award className="h-5 w-5 shrink-0 text-(--warning) max-md:h-4 max-md:w-4" aria-hidden />
                        <span>
                          {t('detail.recordStreak', { days: pluralDays(t, longestStreak) })}
                        </span>
                      </div>
                      {stats7 && stats30 && stats90 && (
                      <div className={isMobile ? 'grid grid-cols-3 gap-2' : 'flex flex-wrap gap-2'}>
                        {[
                          [pluralDays(t, 7), stats7],
                          [pluralDays(t, 30), stats30],
                          [pluralDays(t, 90), stats90],
                        ].map(([label, stat]) => {
                          const s = stat as typeof stats7
                          return (
                            <div
                              key={label as string}
                              className={
                                isMobile
                                  ? 'rounded-lg border border-(--border)/35 bg-(--bg-dark)/10 px-2 py-2 text-center'
                                  : 'flex items-baseline gap-2 rounded-lg border border-(--border)/35 bg-(--bg-dark)/10 px-3 py-2'
                              }
                            >
                              <span className={`text-(--text-muted) ${isMobile ? 'block text-xs' : 'text-base'}`}>
                                {label as string}
                              </span>
                              <span
                                className={`font-semibold tabular-nums text-(--text-primary) ${
                                  isMobile ? 'text-lg leading-tight' : 'text-base'
                                }`}
                              >
                                {s.pct}%
                              </span>
                              <span className={`text-(--text-muted) ${isMobile ? 'block text-xs' : 'text-sm'}`}>
                                {s.done}/{Math.max(1, s.planned - s.skipped)}
                              </span>
                              {measurable && s.avgValue != null && !isMobile && (
                                <span className="text-sm text-(--text-muted)">
                                  {t('habitsCard.avgValueLabel', {
                                    value: s.avgValue.toFixed(1),
                                    unit: `\u00a0${habit.unit ?? ''}`,
                                  })}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      )}
                      {trend30 != null && (
                      <p className="text-base text-(--text-muted) max-md:hidden">
                        {t('detail.trendLabel')}{' '}
                        <span
                          className={
                            trend30 >= 0 ? 'text-(--positive)' : 'text-red-400'
                          }
                        >
                          {trend30 >= 0 ? '+' : ''}
                          {trend30} pp
                        </span>
                      </p>
                      )}
                      <div className="space-y-5 max-md:space-y-3">
                        <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
                          <span className="text-base font-medium text-(--text-primary) max-md:text-sm">
                            {t('detail.chartLabel')}
                          </span>
                          <select
                            id={`habit-chart-period-${habit.id}`}
                            value={chartPeriod}
                            onChange={(e) =>
                              setHabitChartPeriod((prev) => ({
                                ...prev,
                                [habit.id]: e.target.value as HabitChartPeriod,
                              }))
                            }
                            className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25 max-md:min-h-11 sm:w-auto"
                          >
                            <option value="30d">{t('detail.chartOption.d30')}</option>
                            <option value="90d">{t('detail.chartOption.d90')}</option>
                            <option value="month">{t('detail.chartOption.month')}</option>
                            <option value="year">{t('detail.chartOption.year')}</option>
                            <option value="all">{t('detail.chartOption.all')}</option>
                          </select>
                        </div>
                        {chartWeeklyAggregated && (
                          <p className="text-base text-(--text-muted) max-md:text-sm max-md:hidden">
                            {t('detail.weeklyAggregatedHint', { count: CHART_ALL_MAX_DAILY_POINTS })}
                          </p>
                        )}
                        <div
                          className={`chart-shell w-full min-w-0 min-h-[160px] ${chartScrollWide ? 'overflow-x-auto pb-1' : ''}`}
                        >
                          <div
                            className="h-[180px] min-h-[160px] max-md:h-[152px] max-md:min-h-[152px]"
                            style={
                              chartScrollWide
                                ? { minWidth: chartInnerMinWidthPx }
                                : undefined
                            }
                          >
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartSeries} margin={chartMargin}>
                              <defs>
                                <linearGradient id={chartGradId} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={accentHex} stopOpacity={0.35} />
                                  <stop offset="95%" stopColor={accentHex} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                                vertical={!isMobile}
                              />
                              <XAxis
                                dataKey="label"
                                tick={{
                                  fill: isMobile ? 'var(--text-primary)' : 'var(--text-muted)',
                                  fontSize: isMobile ? 11 : 10,
                                }}
                                interval={isMobile ? chartXInterval : xAxisInterval}
                                minTickGap={isMobile ? 36 : xAxisMinTickGap}
                                tickMargin={isMobile ? 10 : 6}
                                axisLine={!isMobile}
                                tickLine={!isMobile}
                                tickFormatter={
                                  isMobile
                                    ? (label, index) =>
                                        formatHabitChartAxisTick(
                                          String(label),
                                          index,
                                          chartSeries,
                                          chartPeriod
                                        )
                                    : undefined
                                }
                              />
                              <YAxis
                                tick={{
                                  fill: isMobile ? 'var(--text-muted)' : 'var(--text-muted)',
                                  fontSize: isMobile ? 10 : 11,
                                }}
                                width={isMobile ? 34 : 40}
                                domain={[0, 100]}
                                tickFormatter={(v: number) => `${v}%`}
                                axisLine={!isMobile}
                                tickLine={!isMobile}
                              />
                              <Tooltip
                                cursor={{ stroke: 'var(--border)' }}
                                contentStyle={{
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                }}
                                labelFormatter={(_label, payload) => {
                                  const p = payload?.[0]?.payload as HabitChartPoint | undefined
                                  if (!p) return ''
                                  if (p.label.includes('–')) return p.label
                                  if (!p.fullDate) return p.label
                                  if (chartPeriod === 'year') {
                                    return parseLocalYmd(p.fullDate).toLocaleDateString(activeDateLocale(), {
                                      month: 'long',
                                      year: 'numeric',
                                    })
                                  }
                                  return parseLocalYmd(p.fullDate).toLocaleDateString(activeDateLocale(), {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })
                                }}
                                formatter={(value: unknown, _n, item) => {
                                  const p = item?.payload as HabitChartPoint
                                  const pct = typeof value === 'number' ? value : (p?.pct ?? 0)
                                  const parts: string[] = [t('detail.tooltip.completion', { pct: Math.round(pct) })]
                                  if (
                                    measurable &&
                                    p?.fullDate &&
                                    chartPeriod !== 'year' &&
                                    !p.label.includes('–')
                                  ) {
                                    const raw = checkInForDay(habit, p.fullDate)?.value
                                    if (raw != null && raw > 0) {
                                      parts.push(
                                        t('detail.tooltip.dayValue', {
                                          value: raw,
                                          unit: habit.unit ? ` ${habit.unit}` : '',
                                        })
                                      )
                                    }
                                  }
                                  if (
                                    !measurable &&
                                    chartPeriod !== 'year' &&
                                    p?.rollingDone != null &&
                                    !p.label.includes('–')
                                  ) {
                                    parts.push(
                                      t('detail.tooltip.rollingWindow', {
                                        done: p.rollingDone,
                                        total: BINARY_CHART_ROLLING_DAYS,
                                      })
                                    )
                                  }
                                  if (chartPeriod === 'year') {
                                    parts.push(
                                      measurable
                                        ? t('detail.tooltip.yearAvgMeasurable')
                                        : t('detail.tooltip.yearAvgBinary')
                                    )
                                  }
                                  if (p.label.includes('–')) {
                                    parts.push(
                                      measurable
                                        ? t('detail.tooltip.weekAvgMeasurable')
                                        : t('detail.tooltip.weekAvgBinary')
                                    )
                                  }
                                  return [parts.join(' · '), t('detail.tooltip.seriesName')]
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="pct"
                                stroke={accentHex}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#${chartGradId})`}
                                name={t('detail.tooltip.seriesName')}
                                baseValue={0}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                          </div>
                        </div>
                        <details className="rounded-lg border border-(--border)/40 bg-(--bg-dark)/10 [&_summary::-webkit-details-marker]:hidden">
                          <summary className="cursor-pointer list-none px-4 py-3 text-base text-(--text-muted) hover:text-(--text-primary) max-md:px-3 max-md:py-2.5 max-md:text-sm">
                            {t('detail.monthCalendar.summary')}
                          </summary>
                          <div className="border-t border-(--border)/30 p-4 max-md:p-3">
                            <div className="mb-3">
                              <label
                                htmlFor={`habit-calendar-month-${habit.id}`}
                                className="mb-1.5 block text-base text-(--text-muted)"
                              >
                                {t('detail.monthCalendar.monthLabel')}
                              </label>
                              {monthOptions.length > 1 ? (
                                <select
                                  id={`habit-calendar-month-${habit.id}`}
                                  value={selectedCalendarMonth}
                                  onChange={(e) =>
                                    setHabitCalendarMonth((prev) => ({
                                      ...prev,
                                      [habit.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full max-w-xs rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none focus:ring-1 focus:ring-(--accent)/25"
                                >
                                  {monthOptions.map((month) => (
                                    <option key={month.key} value={month.key}>
                                      {month.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-base text-(--text-primary)">
                                  {formatMonthLabel(selectedCalendarMonth)}
                                </p>
                              )}
                            </div>
                            {monthSummary && (
                              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <div className="rounded-lg border border-(--border)/40 bg-(--bg-card)/20 p-3 max-md:p-2.5">
                                  <p className="text-base text-(--text-muted) max-md:text-sm">{t('detail.monthCalendar.realization')}</p>
                                  <p className="text-xl font-semibold tabular-nums text-(--text-primary) max-md:text-lg">
                                    {monthSummary.pct}%
                                  </p>
                                  <p className="text-base text-(--text-muted) max-md:text-xs">
                                    {monthSummary.done}/{Math.max(1, monthSummary.expected - monthSummary.skipped)}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-(--border)/40 bg-(--bg-card)/20 p-3 max-md:p-2.5">
                                  <p className="text-base text-(--text-muted) max-md:text-sm">{t('detail.monthCalendar.missed')}</p>
                                  <p className="text-xl font-semibold tabular-nums text-red-400 max-md:text-lg">
                                    {monthSummary.missed}
                                  </p>
                                </div>
                                <div className="hidden rounded-lg border border-(--border)/40 bg-(--bg-card)/20 p-3 sm:block">
                                  <p className="text-base text-(--text-muted)">{t('detail.monthCalendar.skippedShort')}</p>
                                  <p className="text-xl font-semibold tabular-nums text-slate-300">
                                    {monthSummary.skipped}
                                  </p>
                                </div>
                                <div className="hidden rounded-lg border border-(--border)/40 bg-(--bg-card)/20 p-3 sm:block">
                                  <p className="text-base text-(--text-muted)">{t('detail.monthCalendar.planned')}</p>
                                  <p className="text-xl font-semibold tabular-nums text-(--text-primary)">
                                    {monthSummary.expected}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="mb-3 hidden flex-wrap gap-x-4 gap-y-2 text-base text-(--text-muted) sm:flex">
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-sm"
                                  style={{ backgroundColor: hexAlpha(accentHex, 0.65) }}
                                />
                                {t('detail.monthCalendar.legendDone')}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded-sm bg-red-400/70" />
                                {t('detail.monthCalendar.legendMissed')}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded-sm bg-slate-400/70" />
                                {t('detail.monthCalendar.legendSkipped')}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded-sm border border-(--border)" />
                                {t('detail.monthCalendar.legendEmpty')}
                              </span>
                            </div>
                            <div className="grid grid-cols-7 gap-1.5 max-md:gap-1">
                              {weekdayShortLabelsMondayFirst(i18n.language).map((day, dayIdx) => (
                                <span
                                  key={dayIdx}
                                  className="flex h-6 items-center justify-center text-xs font-medium text-(--text-muted) sm:h-7"
                                >
                                  {day}
                                </span>
                              ))}
                              {currentMonthCalendar.map((day) =>
                                day.kind === 'blank' ? (
                                  <span key={day.key} aria-hidden className="h-9" />
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isArchived}
                                    key={day.date}
                                    onClick={() =>
                                      setMeasurableEditor({ habitId: habit.id, date: day.date })
                                    }
                                    title={`${day.date} — ${
                                      day.status === 'empty'
                                        ? t('detail.monthCalendar.noEntry')
                                        : checkInStatusLabel(t, day.status)
                                    }`}
                                    className={`flex h-8 items-center justify-center rounded-md border text-xs tabular-nums text-(--text-primary) transition-transform hover:scale-105 disabled:cursor-default disabled:hover:scale-100 sm:h-9 ${
                                      measurableEditor?.habitId === habit.id &&
                                      measurableEditor.date === day.date
                                        ? 'border-(--accent) ring-2 ring-(--accent)/50'
                                        : 'border-(--border)/40'
                                    }`}
                                    style={{
                                      backgroundColor:
                                        day.status === 'done'
                                          ? hexAlpha(accentHex, Math.max(0.16, day.pct / 120))
                                          : day.status === 'missed'
                                            ? 'rgba(248,113,113,0.22)'
                                            : day.status === 'skipped'
                                              ? 'rgba(148,163,184,0.22)'
                                              : 'transparent',
                                    }}
                                  >
                                    {day.day}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </details>
                        {weekdayStats && weekdayStats.bestIdx != null && (
                          <details className="rounded-lg border border-(--border)/40 bg-(--bg-dark)/10 [&_summary::-webkit-details-marker]:hidden">
                            <summary className="cursor-pointer list-none px-4 py-3 text-base text-(--text-muted) hover:text-(--text-primary) max-md:px-3 max-md:py-2.5 max-md:text-sm">
                              <span className="text-(--text-primary)">{t('detail.weekday.sectionTitle')}</span>
                              {' · '}
                              {t('detail.weekday.bestPrefix', { day: weekdayDisplayName(i18n.language, weekdayStats.bestIdx) })}
                              {weekdayStats.maxAvg > 0 && (
                                <> ({Math.round(weekdayStats.maxAvg)}%)</>
                              )}
                            </summary>
                            <div
                              className="border-t border-(--border)/30 px-5 pb-5 pt-4 max-md:px-3 max-md:pb-3 max-md:pt-3 sm:px-7"
                              role="img"
                              aria-label={t('detail.weekday.statsAriaLabel')}
                            >
                              <div className="grid min-h-30 grid-cols-7 items-end gap-x-2 sm:gap-x-3">
                                {weekdayShortLabels(i18n.language).map((wd, i) => (
                                  <div
                                    key={i}
                                    className="flex min-h-0 min-w-0 flex-col items-center justify-end gap-2"
                                  >
                                    <div className="flex h-12 w-full items-end justify-center rounded-md bg-(--bg-card)/40 px-1">
                                      <div
                                        className="w-3.5 max-w-full shrink-0 rounded-t-sm sm:w-4"
                                        style={{
                                          height: `${Math.max(
                                            3,
                                            Math.round((weekdayStats.avg[i] / 100) * 44)
                                          )}px`,
                                          backgroundColor: accentHex,
                                          opacity:
                                            weekdayStats.bestIdx === i ? 1 : 0.42,
                                        }}
                                      />
                                    </div>
                                    <span
                                      className="w-full text-center text-xs tabular-nums leading-none tracking-tight text-(--text-muted)"
                                      title={weekdayCountTitle(t, i18n.language, i, weekdayCompletionCounts[i])}
                                    >
                                      {weekdayCompletionCounts[i]}×
                                    </span>
                                    <span className="w-full text-center text-xs leading-tight text-(--text-muted)">
                                      {wd}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </details>
                        )}
                        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--text-muted) sm:flex">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: hexAlpha(accentHex, 0.75) }}
                            />
                            {t('detail.monthCalendar.legendDone')}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-red-400/70" />
                            {t('detail.monthCalendar.legendMissed')}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-slate-400/70" />
                            {t('detail.monthCalendar.legendSkipped')}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm border border-(--border)" />
                            {t('detail.monthCalendar.legendEmpty')}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              </div>
            )
          })}

          {visibleHabits.length === 0 && (
            <p className="rounded-lg border border-(--border)/40 bg-(--bg-card)/15 p-4 text-base text-(--text-muted)">
              {showArchivedHabits
                ? t('habitsCard.emptyArchived')
                : t('habitsCard.emptyActive')}
            </p>
          )}

          {!showArchivedHabits && (
          <div
            className={
              activeHabits.length > 0
                ? 'mt-10 border-t border-(--border)/40 pt-8'
                : 'mt-2'
            }
          >
          <AnimatePresence>
            {showHabitForm ? (
              <HabitCreateForm
                onAdd={(name, extras) => {
                  addHabit(name, extras)
                  setShowHabitForm(false)
                }}
                onCancel={() => setShowHabitForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowHabitForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--positive)/15 text-(--positive) border border-(--positive)/40 font-display hover:bg-(--positive)/25 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('habitsCard.addHabitButton')}
              </button>
            )}
          </AnimatePresence>
          </div>
          )}
        </div>
      </Card>

      {/* Cele */}
      <Card title={t('goalsCard.cardTitle')} className="border-(--accent)/20 max-md:p-4">
        <div className="space-y-4">
          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompletedGoals(false)}
              className={`rounded-lg border px-3 py-2 text-base transition-colors ${
                !showCompletedGoals
                  ? 'border-(--border) bg-(--bg-dark) font-display tracking-wide text-(--text-primary)'
                  : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/60 hover:text-(--text-primary)'
              }`}
            >
              {t('goalsCard.activeTab', { count: activeGoals.length })}
            </button>
            <button
              type="button"
              onClick={() => setShowCompletedGoals(true)}
              className={`rounded-lg border px-3 py-2 text-base transition-colors ${
                showCompletedGoals
                  ? 'border-(--border) bg-(--bg-dark) font-display tracking-wide text-(--text-primary)'
                  : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/60 hover:text-(--text-primary)'
              }`}
            >
              {t('goalsCard.completedTab', { count: completedGoals.length })}
            </button>
          </div>

          {visibleGoals.map((goal) => {
            const pct = Math.min(100, (goal.current / goal.target) * 100)
            const pctRounded = Math.round(pct)
            const isEditing = editingGoalId === goal.id
            const remaining = Math.max(0, goal.target - goal.current)
            const step = goalQuickStep(goal.target)
            const chip = goalStatusChip(t, pctRounded)

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
                className="rounded-lg border border-(--border) bg-(--bg-dark) p-4 hover:border-(--accent)/25 transition-colors"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-base text-(--text-muted)">{t('goalsCard.nameLabel')}</label>
                      <input
                        value={editingGoal.name}
                        onChange={(e) => setEditingGoal((g) => ({ ...g, name: e.target.value }))}
                        className="w-full rounded-lg border border-(--border) bg-(--bg-card) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-base text-(--text-muted)">{t('goalsCard.targetLabel')}</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingGoal.target}
                          onChange={(e) =>
                            setEditingGoal((g) => ({ ...g, target: sanitizeGoalNumber(e.target.value) }))
                          }
                          className="w-full rounded-lg border border-(--border) bg-(--bg-card) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-base text-(--text-muted)">{t('goalsCard.unitLabel')}</label>
                        <input
                          value={editingGoal.unit}
                          onChange={(e) => setEditingGoal((g) => ({ ...g, unit: e.target.value }))}
                          className="w-full rounded-lg border border-(--border) bg-(--bg-card) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none"
                          placeholder={t('goalsCard.unitPlaceholder')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-base text-(--text-muted)">{t('goalsCard.progressLabel')}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingGoal.current ?? String(goal.current)}
                        onChange={(e) =>
                          setEditingGoal((g) => ({ ...g, current: sanitizeGoalNumber(e.target.value) }))
                        }
                        className="w-full max-w-xs rounded-lg border border-(--border) bg-(--bg-card) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-(--border)/60 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const target = parseGoalNumber(editingGoal.target)
                          const current = editingGoal.current != null ? parseGoalNumber(editingGoal.current) : goal.current
                          if (editingGoal.name.trim() && !isNaN(target) && target > 0) {
                            updateGoal(goal.id, {
                              name: editingGoal.name.trim(),
                              target,
                              current: Math.min(current, target),
                              unit: editingGoal.unit.trim() || undefined,
                            })
                            setEditingGoalId(null)
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-(--accent)/40 bg-(--accent)/15 px-4 py-2 text-base text-(--accent) hover:bg-(--accent)/25"
                      >
                        <Check className="w-4 h-4" />
                        {t('goalsCard.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingGoalId(null)}
                        className="flex items-center gap-1.5 rounded-lg border border-(--border) px-4 py-2 text-base text-(--text-muted) hover:bg-(--bg-card)"
                      >
                        <X className="w-4 h-4" />
                        {t('goalsCard.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header row: name + status chip + pct */}
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <p className="font-medium text-base leading-snug">{goal.name}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {chip && (
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${chip.cls}`}>
                            {chip.label}
                          </span>
                        )}
                        <span className="text-base font-semibold tabular-nums text-(--text-primary)">
                          {pctRounded}%
                        </span>
                      </div>
                    </div>
                    {/* Subline: progress + insight */}
                    <p className="mb-3 text-base text-(--text-muted)">
                      {t('goalsCard.progressSummary', {
                        current: formatNumberPl(goal.current),
                        target: formatNumberPl(goal.target),
                        unit: goal.unit ? ` ${goal.unit}` : '',
                      })}
                      {remaining > 0
                        ? t('goalsCard.remainingSuffix', {
                            remaining: formatNumberPl(remaining),
                            unit: goal.unit ? ` ${goal.unit}` : '',
                          })
                        : t('goalsCard.achievedSuffix')}
                    </p>
                    {/* Progress bar */}
                    <div className="mb-3 h-2 overflow-hidden rounded-full bg-(--bg-card)">
                      <div
                        className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
                        style={{
                          width: `${pct}%`,
                          background:
                            pctRounded >= 100
                              ? 'var(--positive)'
                              : 'linear-gradient(to right, var(--accent), var(--positive))',
                        }}
                      />
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = Math.min(goal.current + step, goal.target)
                            const isNowCompleted = newValue >= goal.target
                            const prevValue = goal.current
                            updateGoal(goal.id, { current: newValue })
                            if (goalToastTimerRef.current) clearTimeout(goalToastTimerRef.current)
                            setGoalToast({
                              type: isNowCompleted ? 'completed' : 'progress',
                              goalId: goal.id,
                              goalName: goal.name,
                              previousValue: prevValue,
                            })
                            goalToastTimerRef.current = setTimeout(() => {
                              setGoalToast(null)
                              if (isNowCompleted) setShowCompletedGoals(true)
                            }, isNowCompleted ? 2500 : 5000)
                          }}
                          className="flex items-center gap-1 rounded-lg border border-(--accent)/40 bg-(--accent)/10 px-3 py-1.5 text-base text-(--accent) hover:bg-(--accent)/20 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0" />
                          {step}{goal.unit ? ` ${goal.unit}` : ''}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoalId(goal.id)
                          setEditingGoal({
                            name: goal.name,
                            target: String(goal.target),
                            unit: goal.unit ?? '',
                            current: String(goal.current),
                          })
                        }}
                        className="p-2 text-(--text-muted) hover:text-(--accent) transition-colors"
                        title={t('goalsCard.editTitle')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGoalPendingDelete({
                            id: goal.id,
                            name: goal.name,
                            completed: pctRounded >= 100,
                          })
                        }
                        className="p-2 text-(--text-muted) hover:text-red-400 transition-colors"
                        title={t('goalsCard.deleteTitle')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )
          })}

          {visibleGoals.length === 0 && (
            <p className="rounded-lg border border-(--border)/40 bg-(--bg-card)/15 p-4 text-base text-(--text-muted)">
              {showCompletedGoals ? t('goalsCard.emptyCompleted') : t('goalsCard.emptyActive')}
            </p>
          )}

          {!showCompletedGoals && (
            <div
              className={
                activeGoals.length > 0
                  ? 'mt-10 border-t border-(--border)/40 pt-8'
                  : 'mt-2'
              }
            >
              <AnimatePresence>
                {showGoalForm ? (
                  <GoalCreateForm
                    onAdd={(data) => {
                      addGoal(data)
                      setShowGoalForm(false)
                    }}
                    onCancel={() => setShowGoalForm(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowGoalForm(true)}
                    className="flex items-center gap-2 rounded-lg border border-(--accent)/40 bg-(--accent)/15 px-4 py-2 font-display text-(--accent) transition-colors hover:bg-(--accent)/25"
                  >
                    <Plus className="h-4 w-4" />
                    {t('goalsCard.addGoalButton')}
                  </button>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={habitPendingDelete != null}
        onClose={() => setHabitPendingDelete(null)}
        title={habitPendingDelete?.permanent ? t('confirm.deletePermanentTitle') : t('confirm.archiveTitle')}
        description={
          habitPendingDelete?.permanent
            ? t('confirm.deletePermanentDescription')
            : t('confirm.archiveDescription')
        }
        emphasis={habitPendingDelete ? `„${habitPendingDelete.name}"` : undefined}
        variant="danger"
        confirmLabel={habitPendingDelete?.permanent ? t('confirm.deletePermanentConfirmLabel') : t('confirm.archiveConfirmLabel')}
        onConfirm={() => {
          if (!habitPendingDelete) return
          const { id, permanent } = habitPendingDelete
          if (permanent) {
            deleteHabitPermanently(id)
          } else {
            removeHabit(id)
          }
          if (measurableEditor?.habitId === id) setMeasurableEditor(null)
          if (editingHabitId === id) setEditingHabitId(null)
          if (habitExpandedId === id) setHabitExpandedId(null)
          setHabitAccentChoice((prev) => {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            writeHabitAccentStorage(next)
            return next
          })
          setHabitChartPeriod((prev) => {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
          })
          setHabitCalendarMonth((prev) => {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
          })
          setHabitPendingDelete(null)
        }}
      />

      <ConfirmDialog
        isOpen={goalPendingDelete != null}
        onClose={() => setGoalPendingDelete(null)}
        title={goalPendingDelete?.completed ? t('confirm.deleteCompletedGoalTitle') : t('confirm.deleteGoalTitle')}
        description={
          goalPendingDelete?.completed
            ? t('confirm.deleteCompletedGoalDescription')
            : t('confirm.deleteGoalDescription')
        }
        emphasis={goalPendingDelete ? `„${goalPendingDelete.name}"` : undefined}
        variant="danger"
        confirmLabel={t('confirm.deleteConfirmLabel')}
        onConfirm={() => {
          if (!goalPendingDelete) return
          removeGoal(goalPendingDelete.id)
          setGoalPendingDelete(null)
        }}
      />

      {goalToast && createPortal(
        <AnimatePresence>
          <motion.div
            key="goal-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-6 left-1/2 z-10000 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-(--border) bg-(--bg-card) px-4 py-3 shadow-2xl"
          >
            {goalToast.type === 'completed' ? (
              <>
                <span className="text-base font-medium text-(--positive)">
                  {t('toast.goalCompleted', { name: goalToast.goalName })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateGoal(goalToast.goalId, { current: goalToast.previousValue })
                    if (goalToastTimerRef.current) clearTimeout(goalToastTimerRef.current)
                    setGoalToast(null)
                  }}
                  className="text-sm text-(--text-muted) underline hover:text-(--text-primary)"
                >
                  {t('toast.undo')}
                </button>
              </>
            ) : (
              <>
                <span className="text-base text-(--text-muted)">
                  {t('toast.progressAdded', { name: goalToast.goalName })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateGoal(goalToast.goalId, { current: goalToast.previousValue })
                    if (goalToastTimerRef.current) clearTimeout(goalToastTimerRef.current)
                    setGoalToast(null)
                  }}
                  className="text-sm font-medium text-(--accent) hover:opacity-80"
                >
                  {t('toast.undo')}
                </button>
              </>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
