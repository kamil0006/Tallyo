import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { eventsApi } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuthenticatedQueryEnabled } from '../hooks/useAuthenticatedQueryEnabled'
import { DEFAULT_EVENT_CATEGORIES, type EventCategory } from '../lib/eventCategories'

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

export interface DemoEvent {
  id: string
  title: string
  date: string
  time?: string
  category?: string
  color?: string
  notes?: string
  recurrenceType?: RecurrenceType
  recurrenceInterval?: number
  recurrenceUnit?: RecurrenceUnit
  recurrenceUntil?: string
  linkedTodoId?: string | null
  sourceEventId?: string
}

/** Single date format for UI and comparisons (YYYY-MM-DD). */
export function normalizeEventDate(raw: string): string {
  return raw.split('T')[0]
}

function normalizeEvent(e: {
  id: string
  title: string
  date: string
  time?: string | null
  category?: string | null
  color?: string | null
  notes?: string | null
  recurrenceType?: RecurrenceType | null
  recurrenceInterval?: number | null
  recurrenceUnit?: RecurrenceUnit | null
  recurrenceUntil?: string | null
  linkedTodoId?: string | null
}): DemoEvent {
  return {
    id: e.id,
    title: e.title,
    date: normalizeEventDate(e.date),
    time: e.time ?? undefined,
    category: e.category ?? undefined,
    color: e.color ?? undefined,
    notes: e.notes ?? undefined,
    recurrenceType: e.recurrenceType ?? undefined,
    recurrenceInterval: e.recurrenceInterval ?? undefined,
    recurrenceUnit: e.recurrenceUnit ?? undefined,
    recurrenceUntil: e.recurrenceUntil ? normalizeEventDate(e.recurrenceUntil) : undefined,
    linkedTodoId: e.linkedTodoId ?? null,
  }
}

function getDemoEvents(year: number): DemoEvent[] {
  const y = year.toString()
  const pad = (m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return [
    { id: '1', title: 'Spotkanie z klientem', date: pad(3, 5), time: '10:00', category: 'praca', color: '#82a7cf' },
    { id: '2', title: 'Urodziny mamy', date: pad(3, 12), category: 'prywatne', color: '#b58cc4' },
    { id: '3', title: 'Wizyta u dentysty', date: pad(3, 18), time: '14:30', category: 'zdrowie', color: '#63b28f' },
    { id: '4', title: 'Spotkanie zespołu', date: pad(3, 22), time: '09:00', category: 'praca', color: '#82a7cf' },
    { id: '5', title: 'Kino z przyjaciółmi', date: pad(3, 28), time: '19:00', category: 'rozrywka', color: '#c9a35c' },
    { id: '6', title: 'Prezentacja projektu', date: pad(4, 3), time: '11:00', category: 'praca', color: '#82a7cf' },
    { id: '7', title: 'Wakacje – wyjazd', date: pad(4, 15), category: 'rozrywka', color: '#63b28f' },
    { id: '8', title: 'Rocznica ślubu', date: pad(4, 20), category: 'prywatne', color: '#b58cc4' },
    { id: '9', title: 'Kontrola samochodu', date: pad(5, 8), time: '08:00', category: 'inne', color: '#c9a35c' },
    { id: '10', title: 'Urodziny', date: pad(5, 25), category: 'prywatne', color: '#b58cc4', recurrenceType: 'yearly' },
    { id: '11', title: 'Konferencja IT', date: pad(6, 10), category: 'praca', color: '#82a7cf' },
    { id: '12', title: 'Wesele kolegi', date: pad(6, 21), category: 'prywatne', color: '#b58cc4' },
  ]
}

const currentYear = new Date().getFullYear()
const INITIAL_DEMO_EVENTS = getDemoEvents(currentYear)
const EVENT_CATEGORY_STORAGE_PREFIX = 'tallyo_event_categories_v1'
const EVENT_RECURRENCE_STORAGE_PREFIX = 'tallyo_event_recurrence_v1'

const defaultEventCategories = DEFAULT_EVENT_CATEGORIES.map((category) => ({ ...category }))

function eventCategoryStorageKey(userId: string, isDemoMode: boolean): string {
  return `${EVENT_CATEGORY_STORAGE_PREFIX}_${isDemoMode ? 'demo' : userId}`
}

function loadEventCategories(storageKey: string): EventCategory[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaultEventCategories
    const parsed = JSON.parse(raw) as EventCategory[]
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultEventCategories
    return parsed
  } catch {
    return defaultEventCategories
  }
}

function saveEventCategories(storageKey: string, categories: EventCategory[]) {
  localStorage.setItem(storageKey, JSON.stringify(categories))
}

type RecurrenceSnapshot = Pick<DemoEvent, 'recurrenceType' | 'recurrenceInterval' | 'recurrenceUnit' | 'recurrenceUntil'>

function eventRecurrenceStorageKey(userId: string, isDemoMode: boolean): string {
  return `${EVENT_RECURRENCE_STORAGE_PREFIX}_${isDemoMode ? 'demo' : userId}`
}

function loadRecurrenceSnapshots(storageKey: string): Record<string, RecurrenceSnapshot> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, RecurrenceSnapshot>
    return parsed ?? {}
  } catch {
    return {}
  }
}

function saveRecurrenceSnapshots(storageKey: string, map: Record<string, RecurrenceSnapshot>) {
  localStorage.setItem(storageKey, JSON.stringify(map))
}

function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addRecurrenceStep(base: Date, interval: number, unit: RecurrenceUnit): Date {
  const next = new Date(base)
  if (unit === 'day') next.setDate(next.getDate() + interval)
  if (unit === 'week') next.setDate(next.getDate() + interval * 7)
  if (unit === 'month') next.setMonth(next.getMonth() + interval)
  if (unit === 'year') next.setFullYear(next.getFullYear() + interval)
  return next
}

function recurrenceToStep(event: DemoEvent): { interval: number; unit: RecurrenceUnit } | null {
  const type = event.recurrenceType
  if (!type || type === 'none') return null
  if (type === 'daily') return { interval: 1, unit: 'day' }
  if (type === 'weekly') return { interval: 1, unit: 'week' }
  if (type === 'monthly') return { interval: 1, unit: 'month' }
  if (type === 'yearly') return { interval: 1, unit: 'year' }
  if (type === 'custom') {
    return {
      interval: Math.max(1, event.recurrenceInterval ?? 1),
      unit: event.recurrenceUnit ?? 'day',
    }
  }
  return null
}

export function expandRecurringEvents(events: DemoEvent[], startDate: string, endDate: string): DemoEvent[] {
  const rangeStart = toDate(startDate)
  const rangeEnd = toDate(endDate)
  const expanded: DemoEvent[] = []

  events.forEach((event) => {
    const step = recurrenceToStep(event)
    const baseDate = toDate(normalizeEventDate(event.date))
    const recurrenceEnd = event.recurrenceUntil ? toDate(event.recurrenceUntil) : null

    if (!step) {
      if (baseDate >= rangeStart && baseDate <= rangeEnd) expanded.push(event)
      return
    }

    let cursor = baseDate
    let safety = 0
    while (cursor <= rangeEnd && safety < 1000) {
      if (recurrenceEnd && cursor > recurrenceEnd) break
      if (cursor >= rangeStart) {
        expanded.push({
          ...event,
          id: `${event.id}::${formatDate(cursor)}`,
          date: formatDate(cursor),
          sourceEventId: event.id,
        })
      }
      cursor = addRecurrenceStep(cursor, step.interval, step.unit)
      safety += 1
    }
  })

  return expanded.sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date)
    if (dateDiff !== 0) return dateDiff
    const timeA = a.time ?? '99:99'
    const timeB = b.time ?? '99:99'
    if (timeA !== timeB) return timeA.localeCompare(timeB)
    return a.title.localeCompare(b.title)
  })
}

export function useEvents() {
  const { isDemoMode, user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  const queryEnabled = useAuthenticatedQueryEnabled() && !!userId
  const key = queryKeys.events(userId)
  const categoriesKey = queryKeys.eventCategories(userId || 'demo')
  const categoryStorageKey = eventCategoryStorageKey(userId || 'guest', isDemoMode)
  const recurrenceStorageKey = eventRecurrenceStorageKey(userId || 'guest', isDemoMode)

  const { data: events = [], isPending } = useQuery({
    queryKey: key,
    queryFn: isDemoMode
      ? () => INITIAL_DEMO_EVENTS
      : () =>
          eventsApi.getAll().then((data) => {
            const recurrenceSnapshots = loadRecurrenceSnapshots(recurrenceStorageKey)
            return data.map((entry) => {
              const normalized = normalizeEvent(entry)
              const saved = recurrenceSnapshots[normalized.id]
              return saved ? { ...normalized, ...saved } : normalized
            })
          }),
    enabled: isDemoMode || queryEnabled,
    staleTime: isDemoMode ? Infinity : undefined,
    gcTime: isDemoMode ? Infinity : undefined,
  })

  const loading = !isDemoMode && isPending

  const { data: categories = defaultEventCategories } = useQuery({
    queryKey: categoriesKey,
    queryFn: () => loadEventCategories(categoryStorageKey),
    enabled: isDemoMode || queryEnabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const mergeSorted = (list: DemoEvent[]) =>
    [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title))

  const addEvent = async (e: Omit<DemoEvent, 'id'>) => {
    const payload = {
      ...e,
      date: normalizeEventDate(e.date),
      recurrenceUntil: e.recurrenceUntil ? normalizeEventDate(e.recurrenceUntil) : undefined,
    }
    if (isDemoMode) {
      queryClient.setQueryData<DemoEvent[]>(key, (old) =>
        mergeSorted([
          ...(old ?? []),
          { ...payload, id: `demo-${(old ?? []).length + 1}-${payload.date}-${payload.title.toLowerCase().replace(/\s+/g, '-')}` },
        ])
      )
      return
    }
    try {
      const created = await eventsApi.create(payload)
      const row = { ...normalizeEvent(created), ...payload }
      persistRecurrence(row.id, row)
      queryClient.setQueryData<DemoEvent[]>(key, (old) =>
        mergeSorted([...(old ?? []).filter((ev) => ev.id !== row.id), row])
      )
    } catch {
      await queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const updateEvent = async (id: string, updates: Partial<Omit<DemoEvent, 'id'>>) => {
    const patch = {
      ...updates,
      ...(updates.date != null ? { date: normalizeEventDate(updates.date) } : {}),
      ...(updates.recurrenceUntil !== undefined
        ? { recurrenceUntil: updates.recurrenceUntil ? normalizeEventDate(updates.recurrenceUntil) : undefined }
        : {}),
    }
    if (isDemoMode) {
      queryClient.setQueryData<DemoEvent[]>(key, (old) =>
        mergeSorted((old ?? []).map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)))
      )
      return
    }
    try {
      const updated = await eventsApi.update(id, patch)
      const row = { ...normalizeEvent(updated), ...patch }
      persistRecurrence(id, row)
      queryClient.setQueryData<DemoEvent[]>(key, (old) =>
        mergeSorted((old ?? []).map((ev) => (ev.id === id ? row : ev)))
      )
    } catch {
      await queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const deleteEvent = async (id: string) => {
    if (isDemoMode) {
      queryClient.setQueryData<DemoEvent[]>(key, (old) => (old ?? []).filter((ev) => ev.id !== id))
      return
    }
    try {
      await eventsApi.delete(id)
      if (!isDemoMode) {
        const map = loadRecurrenceSnapshots(recurrenceStorageKey)
        delete map[id]
        saveRecurrenceSnapshots(recurrenceStorageKey, map)
      }
      queryClient.setQueryData<DemoEvent[]>(key, (old) => (old ?? []).filter((ev) => ev.id !== id))
    } catch {
      await queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const saveCategories = (nextCategories: EventCategory[]) => {
    saveEventCategories(categoryStorageKey, nextCategories)
    queryClient.setQueryData<EventCategory[]>(categoriesKey, nextCategories)
  }

  const addCategory = (name: string, color: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const duplicate = categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase())
    if (duplicate) return

    const id = `cat-${Date.now()}-${trimmed.toLowerCase().replace(/\s+/g, '-')}`
    saveCategories([...categories, { id, name: trimmed, color, isVisible: true }])
  }

  const updateCategory = (id: string, updates: Partial<Pick<EventCategory, 'name' | 'color'>>) => {
    const nextCategories = categories.map((category) =>
      category.id === id
        ? {
            ...category,
            ...(updates.name ? { name: updates.name.trim() || category.name } : {}),
            ...(updates.color ? { color: updates.color } : {}),
          }
        : category
    )
    saveCategories(nextCategories)
  }

  const persistRecurrence = (eventId: string, event: Pick<DemoEvent, 'recurrenceType' | 'recurrenceInterval' | 'recurrenceUnit' | 'recurrenceUntil'>) => {
    if (isDemoMode) return
    const map = loadRecurrenceSnapshots(recurrenceStorageKey)
    const next: RecurrenceSnapshot = {
      recurrenceType: event.recurrenceType,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceUnit: event.recurrenceUnit,
      recurrenceUntil: event.recurrenceUntil ? normalizeEventDate(event.recurrenceUntil) : undefined,
    }
    if (!next.recurrenceType) {
      delete map[eventId]
    } else {
      map[eventId] = next
    }
    saveRecurrenceSnapshots(recurrenceStorageKey, map)
  }

  const deleteCategory = (id: string) => {
    const nextCategories = categories.filter((category) => category.id !== id)
    saveCategories(nextCategories)
    queryClient.setQueryData<DemoEvent[]>(key, (old) =>
      (old ?? []).map((event) => (event.category === id ? { ...event, category: undefined, color: undefined } : event))
    )
  }

  const toggleCategoryVisibility = (id: string) => {
    const nextCategories = categories.map((category) =>
      category.id === id ? { ...category, isVisible: !category.isVisible } : category
    )
    saveCategories(nextCategories)
  }

  return {
    events,
    categories,
    addEvent,
    updateEvent,
    deleteEvent,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryVisibility,
    loading,
  }
}
