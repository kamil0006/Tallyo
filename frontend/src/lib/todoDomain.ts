export type TodoPriority = 'low' | 'medium' | 'high'

export type TodoCategory = 'dom' | 'praca' | 'finanse' | 'nauka' | 'zdrowie' | 'inne'

export const TODO_CATEGORIES: TodoCategory[] = ['dom', 'praca', 'finanse', 'nauka', 'zdrowie', 'inne']

export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: string
  dueDate: string | null
  dueTime: string | null
  priority: TodoPriority
  category: TodoCategory
  archivedAt: string | null
  noteId: string | null
  linkedEventId?: string | null
}

export function localISODate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocalYMD(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** The date is earlier than today (local calendar). */
export function isTodoOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return parseLocalYMD(dueDate).getTime() < parseLocalYMD(localISODate()).getTime()
}

export function isTodoDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate === localISODate()
}

export type TodoDateStatus = 'none' | 'today' | 'upcoming' | 'overdue'

export function todoDateStatus(dueDate: string | null): TodoDateStatus {
  if (!dueDate) return 'none'
  if (isTodoOverdue(dueDate)) return 'overdue'
  if (isTodoDueToday(dueDate)) return 'today'
  return 'upcoming'
}

export interface TodoDueLabels {
  /** BCP 47 locale for weekday/month names, e.g. "pl-PL". */
  locale: string
  today: string
  tomorrow: string
  none: string
}

/** Short due-date label, e.g. "today · 14:30", "Friday", "Nov 12" (localized). */
export function formatTodoDueSummary(dueDate: string | null, dueTime: string | null, labels: TodoDueLabels): string {
  if (!dueDate && !dueTime) return labels.none
  const withTime = (label: string) => (dueTime ? `${label} · ${dueTime}` : label)
  const today = localISODate()
  const tomorrow = localISODate(new Date(Date.now() + 86400000))
  if (dueDate === today) return withTime(labels.today)
  if (dueDate === tomorrow) return withTime(labels.tomorrow)
  if (dueDate) {
    const dt = parseLocalYMD(dueDate)
    const diffDays = Math.round((dt.getTime() - parseLocalYMD(today).getTime()) / 86400000)
    if (diffDays > 1 && diffDays <= 7) {
      return withTime(dt.toLocaleDateString(labels.locale, { weekday: 'long' }))
    }
    return withTime(dt.toLocaleDateString(labels.locale, { day: 'numeric', month: 'short' }))
  }
  return dueTime ?? labels.none
}

export function normalizePriority(v: string | undefined | null): TodoPriority {
  if (v === 'low' || v === 'high') return v
  return 'medium'
}

export function normalizeCategory(v: string | undefined | null): TodoCategory {
  const c = (v ?? '').toLowerCase()
  if (TODO_CATEGORIES.includes(c as TodoCategory)) return c as TodoCategory
  return 'inne'
}

export type TodoTabFilter = 'today' | 'upcoming' | 'all' | 'done'

export function isArchivedTodo(t: TodoItem): boolean {
  return !!t.archivedAt
}

/** The task belongs to the Today bucket (due today or earlier, or no date), not filtered by done status. */
export function todoInTodayBucket(t: TodoItem): boolean {
  if (isArchivedTodo(t)) return false
  const endToday = parseLocalYMD(localISODate())
  endToday.setHours(23, 59, 59, 999)
  if (!t.dueDate) return true
  return parseLocalYMD(t.dueDate).getTime() <= endToday.getTime()
}

export function todoMatchesTab(t: TodoItem, tab: TodoTabFilter): boolean {
  if (isArchivedTodo(t)) return false
  if (tab === 'done') return t.done
  if (t.done) return false

  if (tab === 'today') {
    return todoInTodayBucket(t)
  }
  if (tab === 'upcoming') {
    if (!t.dueDate) return false
    const endToday = parseLocalYMD(localISODate())
    endToday.setHours(23, 59, 59, 999)
    return parseLocalYMD(t.dueDate).getTime() > endToday.getTime()
  }
  return tab === 'all'
}

export function compareTodosForDisplay(a: TodoItem, b: TodoItem): number {
  const bucket = (t: TodoItem) => {
    if (t.done) return 10
    const st = todoDateStatus(t.dueDate)
    if (st === 'overdue') return 0
    if (st === 'today') return 1
    if (st === 'none') return 2
    return 3
  }
  const ba = bucket(a)
  const bb = bucket(b)
  if (ba !== bb) return ba - bb
  const pa = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2
  const pb = b.priority === 'high' ? 0 : b.priority === 'medium' ? 1 : 2
  if (pa !== pb) return pa - pb
  const da = a.dueDate ? parseLocalYMD(a.dueDate).getTime() : Number.POSITIVE_INFINITY
  const db = b.dueDate ? parseLocalYMD(b.dueDate).getTime() : Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  return b.createdAt.localeCompare(a.createdAt)
}
