import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { CalendarDays, CalendarRange, CheckSquare2, ChevronDown, ChevronLeft, ChevronRight, Plus, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { EventModal } from '../components/EventModal'
import { expandRecurringEvents, normalizeEventDate, type DemoEvent, useEvents } from '../context/EventsContext'
import { getPolishHolidays } from '../lib/polishHolidays'
import { getCategoryColor } from '../lib/eventCategories'
import { SimplePageSkeleton } from '../components/skeletons'
import { useTodos } from '../context/TodosContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatTodoDueSummary, localISODate, type TodoItem } from '../lib/todoDomain'
import { useTodoDueLabels } from '../lib/useTodoDueLabels'

type ViewMode = 'month' | 'week'
type FeedFilter = 'all' | 'events' | 'todos'

export function Calendar() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('calendar')
  const dueLabels = useTodoDueLabels()
  const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'
  const dayNames = useMemo(() => t('weekDayShort', { returnObjects: true }) as string[], [t])
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleDateString(locale, { month: 'long' })),
    [locale]
  )
  const {
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
  } = useEvents()
  const { todos, toggleTodo, updateTodo } = useTodos()
  const isMobile = useIsMobile()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<DemoEvent | null>(null)
  const [initialDate, setInitialDate] = useState<string | undefined>()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [isDayPanelCollapsed, setIsDayPanelCollapsed] = useState(false)
  const [openCategoryManagerOnOpen, setOpenCategoryManagerOnOpen] = useState(false)
  const [showEvents, setShowEvents] = useState(true)
  const [showTodos, setShowTodos] = useState(true)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [rescheduleDateByTodoId, setRescheduleDateByTodoId] = useState<Record<string, string>>({})

  const { year, month } = useMemo(() => ({
    year: viewDate.getFullYear(),
    month: viewDate.getMonth(),
  }), [viewDate])

  const calendarDays = useMemo(() => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = (first.getDay() + 6) % 7
    const daysInMonth = last.getDate()

    const days: { date: Date; day: number; isCurrentMonth: boolean }[] = []

    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, 1 - (startPad - i))
      days.push({ date: d, day: d.getDate(), isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), day: d, isCurrentMonth: true })
    }
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({ date: d, day: d.getDate(), isCurrentMonth: false })
    }
    return days
  }, [year, month])

  const formatKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return []
    const start = new Date(viewDate)
    const dayOffset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - dayOffset)
    const days: { date: Date; key: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push({ date: d, key: formatKey(d) })
    }
    return days
  }, [viewMode, viewDate])

  const categoryById = useMemo(() => {
    const map = new Map<string, (typeof categories)[number]>()
    categories.forEach((category) => map.set(category.id, category))
    return map
  }, [categories])

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'week' && weekDays.length > 0) {
      return { rangeStart: weekDays[0].key, rangeEnd: weekDays[6].key }
    }
    return {
      rangeStart: formatKey(calendarDays[0]?.date ?? new Date()),
      rangeEnd: formatKey(calendarDays[calendarDays.length - 1]?.date ?? new Date()),
    }
  }, [viewMode, weekDays, calendarDays])

  const expandedEventsForGrid = useMemo(
    () => expandRecurringEvents(events, rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd]
  )

  const isEventVisible = useCallback((event: DemoEvent) => {
    if (!event.category) return true
    const category = categoryById.get(event.category)
    if (!category) return true
    return category.isVisible
  }, [categoryById])

  const filteredEventsForGrid = useMemo(
    () => (showEvents ? expandedEventsForGrid.filter(isEventVisible) : []),
    [expandedEventsForGrid, isEventVisible, showEvents]
  )

  const eventsByDate = useMemo(() => {
    const map: Record<string, DemoEvent[]> = {}
    filteredEventsForGrid.forEach((event) => {
      const key = normalizeEventDate(event.date)
      if (!map[key]) map[key] = []
      map[key].push(event)
    })
    return map
  }, [filteredEventsForGrid])

  const todosWithDates = useMemo(
    () => todos.filter((todo) => !!todo.dueDate),
    [todos]
  )

  const todosByDate = useMemo(() => {
    const map: Record<string, TodoItem[]> = {}
    todosWithDates.forEach((todo) => {
      const key = todo.dueDate as string
      if (!map[key]) map[key] = []
      map[key].push(todo)
    })
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done)
        if (a.priority !== b.priority) {
          const pa = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2
          const pb = b.priority === 'high' ? 0 : b.priority === 'medium' ? 1 : 2
          return pa - pb
        }
        return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99')
      })
    })
    return map
  }, [todosWithDates])

  const holidays = useMemo(() => getPolishHolidays(year, t), [year, t])

  const isToday = (d: Date) => {
    const today = new Date()
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
  const prevWeek = () => setViewDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setViewDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
  const switchToMonthView = () => setViewMode('month')
  const switchToWeekView = () => {
    setViewMode('week')
    setViewDate(new Date())
  }
  const todayDateFormatted = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    [locale]
  )


  const openAddModal = (date?: string) => {
    setEditingEvent(null)
    setInitialDate(date)
    setOpenCategoryManagerOnOpen(false)
    setModalOpen(true)
  }

  const openEditModal = (ev: DemoEvent) => {
    const sourceId = ev.sourceEventId ?? ev.id
    const sourceEvent = events.find((item) => item.id === sourceId)
    if (!sourceEvent) return
    setEditingEvent(sourceEvent)
    setInitialDate(undefined)
    setOpenCategoryManagerOnOpen(false)
    setModalOpen(true)
  }

  const handleAdd = (data: Omit<DemoEvent, 'id'>) => {
    void addEvent(data)
  }

  const handleUpdate = (id: string, data: Partial<Omit<DemoEvent, 'id'>>) => {
    void updateEvent(id, data)
  }

  const handleDelete = (id: string) => {
    void deleteEvent(id)
  }

  const handleDayClick = (dateKey: string, dayEvents: DemoEvent[], dayTodos: TodoItem[], isCurrentMonth = true) => {
    if (!isCurrentMonth) return
    if (dayEvents.length === 0 && dayTodos.length === 0) {
      openAddModal(dateKey)
      return
    }
    if (selectedDayKey === dateKey) {
      setIsDayPanelCollapsed((prev) => !prev)
      return
    }
    setSelectedDayKey(dateKey)
    setIsDayPanelCollapsed(false)
  }

  const upcomingEvents = useMemo(() => {
    if (!showEvents) return []
    const start = formatKey(new Date())
    const future = new Date()
    future.setDate(future.getDate() + 120)
    const end = formatKey(future)
    return expandRecurringEvents(events, start, end)
      .filter(isEventVisible)
      .slice(0, 8)
  }, [events, isEventVisible, showEvents])

  const upcomingTodos = useMemo(() => {
    const today = localISODate()
    return todosWithDates
      .filter((todo) => (todo.dueDate ?? '') >= today)
      .slice(0, 12)
  }, [todosWithDates])

  const selectedDayEvents = selectedDayKey ? eventsByDate[selectedDayKey] ?? [] : []
  const selectedDayTodos = selectedDayKey ? (todosByDate[selectedDayKey] ?? []) : []

  const formatHumanDate = (raw: string) => {
    const [year, month, day] = raw.split('-').map(Number)
    const date = new Date(year ?? 2000, (month ?? 1) - 1, day ?? 1)
    const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
    return `${day} ${monthShort}`
  }

  const formatPanelDayHeader = (raw: string) => {
    const [year, month, day] = raw.split('-').map(Number)
    const date = new Date(year, (month ?? 1) - 1, day ?? 1)
    const fullDate = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
    return { fullDate, weekday }
  }

  const openCategoryManagerModal = () => {
    setEditingEvent(null)
    setInitialDate(undefined)
    setOpenCategoryManagerOnOpen(true)
    setModalOpen(true)
  }

  const getEventCardColor = (event: DemoEvent) => {
    const category = event.category ? categoryById.get(event.category) : null
    if (!category) return '#6b7280'
    return category.color ?? event.color ?? getCategoryColor(event.category)
  }

  const getEventCategoryLabel = (event: DemoEvent) => {
    if (!event.category) return t('noCategory')
    return categoryById.get(event.category)?.name ?? t('noCategory')
  }

  const getTodoPriorityBadgeClass = (priority: TodoItem['priority']) => {
    if (priority === 'high') return 'border-[#ef4444]/50 text-[#fca5a5] bg-[#ef4444]/10'
    if (priority === 'medium') return 'border-[#f59e0b]/50 text-[#fcd34d] bg-[#f59e0b]/10'
    return 'border-[#10b981]/50 text-[#6ee7b7] bg-[#10b981]/10'
  }

  const getTodoPriorityAccent = (priority: TodoItem['priority']) => {
    if (priority === 'high') return '#ef4444'
    if (priority === 'medium') return '#f59e0b'
    return '#10b981'
  }

  const selectedDayHeader = selectedDayKey ? formatPanelDayHeader(selectedDayKey) : null

  const upcomingFeed = useMemo(() => {
    const eventItems = upcomingEvents.map((event) => ({ kind: 'event' as const, date: event.date, time: event.time, event }))
    const todoItems = upcomingTodos.map((todo) => ({ kind: 'todo' as const, date: todo.dueDate as string, time: todo.dueTime ?? undefined, todo }))
    return [...eventItems, ...todoItems]
      .filter((item) => (feedFilter === 'all' ? true : feedFilter === 'events' ? item.kind === 'event' : item.kind === 'todo'))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
      .slice(0, 12)
  }, [upcomingEvents, upcomingTodos, feedFilter])

  const rescheduleTodoToDate = (todo: TodoItem) => {
    const nextDate = rescheduleDateByTodoId[todo.id] ?? todo.dueDate ?? localISODate()
    if (!nextDate) return
    toggleTodo(todo.id, false)
    updateTodo(todo.id, { dueDate: nextDate })
  }

  useEffect(() => {
    if (!selectedDayKey) return
    const hasEvents = (eventsByDate[selectedDayKey] ?? []).length > 0
    const hasTodos = (todosByDate[selectedDayKey] ?? []).length > 0
    if (!hasEvents && (!showTodos || !hasTodos)) setSelectedDayKey(null)
  }, [eventsByDate, todosByDate, selectedDayKey, showTodos])

  if (loading) {
    return <SimplePageSkeleton titleWidth="w-36" />
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-end justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-(--text-primary) font-display tracking-wider">
            {t('title')}
          </h1>
          <p className="text-sm sm:text-base text-(--text-muted) mt-1 font-display tracking-wide">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => openAddModal()}
          className="flex shrink-0 items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-(--accent) text-(--bg-dark) font-display hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('addEvent')}</span>
          <span className="sm:hidden">{t('add')}</span>
        </button>
      </motion.div>

      <EventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setOpenCategoryManagerOnOpen(false)
        }}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        initialDate={initialDate}
        event={editingEvent}
        holidayName={initialDate ? holidays[initialDate] : undefined}
        categories={categories}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
        onToggleCategoryVisibility={toggleCategoryVisibility}
        openCategoryManager={openCategoryManagerOnOpen}
      />

      <Card className="overflow-hidden max-md:p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <button
              onClick={viewMode === 'month' ? prevMonth : prevWeek}
              className="p-2 rounded-lg hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--accent) transition-colors"
              aria-label={viewMode === 'month' ? t('prevMonth') : t('prevWeek')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-xl font-bold text-(--text-primary) font-display flex-1 sm:flex-none sm:min-w-[200px] text-center">
              {viewMode === 'month'
                ? `${monthNames[month]} ${year}`
                : weekDays[0]
                  ? `${weekDays[0].date.getDate()}–${weekDays[6].date.getDate()} ${monthNames[weekDays[0].date.getMonth()]} ${year}`
                  : ''}
            </h2>
            <button
              onClick={viewMode === 'month' ? nextMonth : nextWeek}
              className="p-2 rounded-lg hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--accent) transition-colors"
              aria-label={viewMode === 'month' ? t('nextMonth') : t('nextWeek')}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="hidden md:inline-flex px-3 py-1.5 rounded-lg border border-(--border) text-sm text-(--text-muted)">
              {t('todayLabel', { date: todayDateFormatted })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex w-full sm:w-auto rounded-lg border border-(--border) p-0.5">
              <button
                onClick={switchToMonthView}
                className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-display transition-colors ${
                  viewMode === 'month' ? 'bg-(--accent) text-(--bg-dark)' : 'text-(--text-muted) hover:text-(--text-primary)'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                {t('monthView')}
              </button>
              <button
                onClick={switchToWeekView}
                className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-display transition-colors ${
                  viewMode === 'week' ? 'bg-(--accent) text-(--bg-dark)' : 'text-(--text-muted) hover:text-(--text-primary)'
                }`}
              >
                <CalendarRange className="w-4 h-4" />
                {t('weekView')}
              </button>
            </div>
          </div>
        </div>

        {selectedDayKey && (selectedDayEvents.length > 0 || selectedDayTodos.length > 0) && (
          <div className="mb-3 rounded-lg border border-(--border) bg-(--bg-dark) p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <h3 className="text-lg font-display text-(--text-primary)">{selectedDayHeader?.fullDate}</h3>
                <p className="text-base text-(--text-muted)">{selectedDayHeader?.weekday}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDayPanelCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg border border-(--border) text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-card-hover)"
                  title={isDayPanelCollapsed ? t('expandDay') : t('collapseDay')}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDayPanelCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                  {isDayPanelCollapsed ? t('expand') : t('collapse')}
                </button>
                <button
                  onClick={() => openAddModal(selectedDayKey)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-(--accent) text-(--bg-dark) font-display"
                >
                  {t('addOnThisDay')}
                </button>
              </div>
            </div>
            {!isDayPanelCollapsed && (
            <div className="space-y-1">
              {selectedDayTodos.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-sm font-display text-(--text-muted) uppercase mb-1">{t('tasksHeading')}</h4>
                  <div className="space-y-1.5">
                    {selectedDayTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border border-transparent hover:border-(--border) ${
                          todo.done ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#6b7280]/50 bg-(--bg-card-hover) px-2 py-0.5 text-xs text-(--text-primary)">
                              {todo.done ? <CheckSquare2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                              {t('taskBadge')}
                            </span>
                            <span className="text-sm text-(--text-muted)">
                              {todo.dueTime ? `${todo.dueTime} · ` : ''}{t(`todo:categoryLabel.${todo.category}`)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleTodo(todo.id, !todo.done)}
                              className="p-1 rounded hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--accent)"
                              title={todo.done ? t('markUndone') : t('markDone')}
                            >
                              {todo.done ? <CheckSquare2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                            <input
                              type="date"
                              value={rescheduleDateByTodoId[todo.id] ?? todo.dueDate ?? localISODate()}
                              onChange={(e) =>
                                setRescheduleDateByTodoId((prev) => ({ ...prev, [todo.id]: e.target.value }))
                              }
                              className="px-1.5 py-0.5 rounded text-xs border border-(--border) bg-(--bg-card) text-(--text-muted)"
                            />
                            <button
                              onClick={() => rescheduleTodoToDate(todo)}
                              className="px-2 py-0.5 rounded text-xs border border-(--border) text-(--text-muted) hover:text-(--text-primary)"
                              title={t('rescheduleTitle')}
                            >
                              {t('reschedule')}
                            </button>
                            <button
                              onClick={() => navigate('/todo')}
                              className="px-2 py-0.5 rounded text-xs border border-(--border) text-(--text-muted) hover:text-(--text-primary)"
                              title={t('goToTodoTitle')}
                            >
                              {t('goToTodo')}
                            </button>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-sm ${todo.done ? 'line-through text-(--text-muted)' : 'text-(--text-primary)'}`}>
                          <span className="w-2 h-2 rounded-full bg-[#6b7280]" />
                          {todo.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => openEditModal(event)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-(--bg-card-hover) border border-transparent hover:border-(--border)"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-(--accent)/40 bg-(--bg-card-hover) px-2 py-0.5 text-xs text-(--text-primary)">
                        <CalendarDays className="w-3 h-3" />
                        {t('eventBadge')}
                      </span>
                      <br />
                      <span className="text-sm text-(--text-muted)">
                        {event.time ? `${event.time} · ` : ''}{getEventCategoryLabel(event)} ·{' '}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm text-(--text-primary)">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getEventCardColor(event) }} />
                        {event.title}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            )}
          </div>
        )}

        {viewMode === 'week' && isMobile ? (
          <div className="space-y-2">
            {weekDays.map(({ date, key }) => {
              const dayEvents = eventsByDate[key] ?? []
              const dayTodos = showTodos ? (todosByDate[key] ?? []) : []
              const holiday = holidays[key]
              const today = isToday(date)
              const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
              const items = [
                ...dayEvents.map((ev) => ({ kind: 'event' as const, ev })),
                ...dayTodos.map((todo) => ({ kind: 'todo' as const, todo })),
              ]

              return (
                <div
                  key={key}
                  className={`rounded-lg border p-3 ${
                    today ? 'border-(--accent)/50 bg-(--accent)/5' : 'border-(--border) bg-(--bg-card)'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-lg font-display font-bold ${today ? 'text-(--accent)' : 'text-(--text-primary)'}`}>
                        {date.getDate()}
                      </span>
                      <span className="text-sm text-(--text-muted) capitalize">{weekdayLabel}</span>
                    </div>
                    <button
                      onClick={() => openAddModal(key)}
                      className="shrink-0 p-1.5 rounded-lg border border-(--border) text-(--text-muted) hover:text-(--accent) active:bg-(--bg-card-hover)"
                      aria-label={t('addOnThisDayAria')}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {holiday && (
                    <p className="text-xs font-mono mb-2" style={{ color: '#e57373' }}>{holiday}</p>
                  )}
                  {items.length === 0 ? (
                    <p className="text-sm text-(--text-muted)">{t('noEntries')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((item) =>
                        item.kind === 'event' ? (
                          <button
                            key={item.ev.id}
                            onClick={() => openEditModal(item.ev)}
                            className="w-full text-left text-sm px-2.5 py-2 rounded border-l-2 active:opacity-80"
                            style={{ borderLeftColor: getEventCardColor(item.ev), backgroundColor: `${getEventCardColor(item.ev)}20` }}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-(--text-muted)" />
                              <span className="text-(--text-primary)">{item.ev.time ? `${item.ev.time} · ` : ''}{item.ev.title}</span>
                            </span>
                          </button>
                        ) : (
                          <div
                            key={item.todo.id}
                            className={`text-sm px-2.5 py-2 rounded border-l-2 ${item.todo.done ? 'opacity-60 line-through' : ''}`}
                            style={{ borderLeftColor: getTodoPriorityAccent(item.todo.priority), backgroundColor: '#6b728014' }}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {item.todo.done ? <CheckSquare2 className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                              <span className="text-(--text-primary)">{item.todo.dueTime ? `${item.todo.dueTime} · ` : ''}{item.todo.text}</span>
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : viewMode === 'week' ? (
          <div className="grid grid-cols-7 gap-px bg-(--border) rounded-lg overflow-hidden">
            {dayNames.map((name) => (
              <div
                key={name}
                className="bg-(--bg-card) p-2 text-center text-base font-display text-(--text-muted) uppercase"
              >
                {name}
              </div>
            ))}
            {weekDays.map(({ date, key }) => {
              const dayEvents = eventsByDate[key] ?? []
              const dayTodos = showTodos ? (todosByDate[key] ?? []) : []
              const previewItems = [
                ...dayEvents.map((ev) => ({ kind: 'event' as const, ev })),
                ...dayTodos.map((todo) => ({ kind: 'todo' as const, todo })),
              ].slice(0, 3)
              const hiddenCount = dayEvents.length + dayTodos.length - previewItems.length
              const holiday = holidays[key]
              const today = isToday(date)

              return (
                <div
                  key={key}
                  className="relative h-[220px] p-3 bg-(--bg-card) flex flex-col cursor-pointer hover:bg-(--bg-card-hover) overflow-hidden"
                  onClick={() => handleDayClick(key, dayEvents, dayTodos)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-base font-display w-8 h-8 flex items-center justify-center rounded-full ${
                        today ? 'bg-(--accent) text-(--bg-dark) font-bold' : 'text-(--text-primary)'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {holiday && (
                      <span className="text-xs font-mono" style={{ color: '#e57373' }} title={holiday}>
                        {holiday}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 scrollbar-hidden">
                    {previewItems.map((item) =>
                      item.kind === 'event' ? (
                        <div
                          key={item.ev.id}
                          onClick={(e) => { e.stopPropagation(); openEditModal(item.ev) }}
                          className={`text-sm px-2 py-1.5 rounded border-l-2 cursor-pointer hover:opacity-90 ${!item.ev.category ? 'opacity-70' : ''}`}
                          style={{
                            borderLeftColor: getEventCardColor(item.ev),
                            backgroundColor: `${getEventCardColor(item.ev)}20`,
                          }}
                        >
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getEventCardColor(item.ev) }} />
                            <span>{item.ev.time ? `${item.ev.time} ` : ''}{item.ev.title}</span>
                          </span>
                        </div>
                      ) : (
                        <div
                          key={item.todo.id}
                          className={`text-sm px-2 py-1.5 rounded border-l-2 ${item.todo.done ? 'opacity-60 line-through' : ''}`}
                          style={{
                            borderLeftColor: getTodoPriorityAccent(item.todo.priority),
                            backgroundColor: '#6b728014',
                          }}
                          title={`${item.todo.text} – ${formatTodoDueSummary(item.todo.dueDate, item.todo.dueTime, dueLabels)} – ${t('priorityTooltip', { label: t(`todo:priorityLabel.${item.todo.priority}`) })}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {item.todo.done ? <CheckSquare2 className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                            <span>{item.todo.dueTime ? `${item.todo.dueTime} ` : ''}{item.todo.text}</span>
                          </span>
                        </div>
                      )
                    )}
                    {hiddenCount > 0 && (
                      <div className="text-base text-(--text-muted)">+{hiddenCount}</div>
                    )}
                  </div>
                  {hiddenCount > 0 && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-(--bg-card) to-transparent" />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
        <div className="grid grid-cols-7 gap-px bg-(--border) rounded-lg overflow-hidden">
          {dayNames.map((name) => (
            <div
              key={name}
              className="bg-(--bg-card) p-1 sm:p-2 text-center text-xs sm:text-base font-display text-(--text-muted) uppercase"
            >
              {name}
            </div>
          ))}
          {calendarDays.map(({ date, day, isCurrentMonth }) => {
            const key = formatKey(date)
            const dayEvents = eventsByDate[key] ?? []
            const dayTodos = showTodos ? (todosByDate[key] ?? []) : []
            const previewItems = [
              ...dayEvents.map((ev) => ({ kind: 'event' as const, ev })),
              ...dayTodos.map((todo) => ({ kind: 'todo' as const, todo })),
            ].slice(0, 3)
            const hiddenCount = dayEvents.length + dayTodos.length - previewItems.length
            const holiday = holidays[key]
            const today = isToday(date)

            const dotItems = [
              ...dayEvents.map((ev) => ({ id: ev.id, color: getEventCardColor(ev) })),
              ...dayTodos.map((todo) => ({ id: todo.id, color: getTodoPriorityAccent(todo.priority) })),
            ].slice(0, 4)
            const totalCount = dayEvents.length + dayTodos.length

            if (isMobile) {
              return (
                <div
                  key={key}
                  className={`relative aspect-square p-1 bg-(--bg-card) flex flex-col items-center ${
                    !isCurrentMonth ? 'opacity-40' : 'active:bg-(--bg-card-hover)'
                  } ${holiday ? 'ring-1 ring-inset ring-[#e57373]/40' : ''}`}
                  onClick={() => handleDayClick(key, dayEvents, dayTodos, isCurrentMonth)}
                >
                  <span
                    className={`text-sm font-display w-7 h-7 flex items-center justify-center rounded-full ${
                      today ? 'bg-(--accent) text-(--bg-dark) font-bold' : 'text-(--text-primary)'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-auto mb-0.5 flex flex-wrap items-center justify-center gap-0.5 max-w-full">
                    {dotItems.map((d) => (
                      <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                    ))}
                    {totalCount > 4 && (
                      <span className="text-xs leading-none text-(--text-muted)">+{totalCount - 4}</span>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={key}
                className={`relative h-[125px] p-2 bg-(--bg-card) flex flex-col overflow-hidden ${
                  !isCurrentMonth ? 'opacity-40' : ''
                } ${isCurrentMonth ? 'cursor-pointer hover:bg-(--bg-card-hover)' : ''}`}
                onClick={() => handleDayClick(key, dayEvents, dayTodos, isCurrentMonth)}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`text-base font-display w-7 h-7 flex items-center justify-center rounded-full shrink-0 ${
                      today
                        ? 'bg-(--accent) text-(--bg-dark) font-bold'
                        : 'text-(--text-primary)'
                    }`}
                  >
                    {day}
                  </span>
                  {holiday && (
                    <span
                      className="text-[11px] font-mono truncate max-w-[65px] block"
                      style={{ color: '#e57373' }}
                      title={holiday}
                    >
                      {holiday}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1 flex-1 overflow-y-auto scrollbar-hidden">
                  {previewItems.map((item) =>
                    item.kind === 'event' ? (
                      <div
                        key={item.ev.id}
                        onClick={(e) => { e.stopPropagation(); openEditModal(item.ev) }}
                        className={`text-sm px-2 py-0.5 rounded truncate border-l-2 cursor-pointer hover:opacity-90 transition-opacity ${!item.ev.category ? 'opacity-70' : ''}`}
                        style={{
                          borderLeftColor: getEventCardColor(item.ev),
                          backgroundColor: `${getEventCardColor(item.ev)}20`,
                        }}
                        title={`${item.ev.title}${item.ev.time ? ` ${item.ev.time}` : ''} – ${t('editTooltip')}`}
                      >
                        <span className="inline-flex items-center gap-1 truncate max-w-full">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getEventCardColor(item.ev) }} />
                          <span className="truncate">{item.ev.time ? `${item.ev.time} ` : ''}{item.ev.title}</span>
                        </span>
                      </div>
                    ) : (
                      <div
                        key={item.todo.id}
                        className={`text-sm px-2 py-0.5 rounded truncate border-l-2 ${item.todo.done ? 'opacity-60 line-through' : ''}`}
                        style={{
                          borderLeftColor: getTodoPriorityAccent(item.todo.priority),
                          backgroundColor: '#6b728014',
                        }}
                        title={`${item.todo.text} – ${t('priorityTooltip', { label: t(`todo:priorityLabel.${item.todo.priority}`) })}`}
                      >
                        <span className="inline-flex items-center gap-1 truncate max-w-full">
                          {item.todo.done ? <CheckSquare2 className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                          <span className="truncate">{item.todo.dueTime ? `${item.todo.dueTime} ` : ''}{item.todo.text}</span>
                        </span>
                      </div>
                    )
                  )}
                  {hiddenCount > 0 && (
                    <div className="text-base text-(--text-muted)">+{hiddenCount}</div>
                  )}
                </div>
                {hiddenCount > 0 && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-(--bg-card) to-transparent" />
                )}
              </div>
            )
          })}
        </div>
        )}

        {/* Legenda + filtry */}
        <div className="mt-8 pt-6 border-t border-(--border) space-y-5">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            <span className="text-sm sm:text-base text-(--text-muted) font-display uppercase shrink-0">{t('visibilityLabel')}</span>
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
            <button
              onClick={() => setShowEvents((v) => !v)}
              className={`inline-flex items-center px-3 py-2 sm:px-2.5 sm:py-1 rounded-md border text-sm transition-colors ${
                showEvents
                  ? 'border-(--accent)/50 text-(--accent) hover:bg-(--bg-card-hover)'
                  : 'border-(--border) text-(--text-muted) hover:text-(--accent) hover:border-(--accent)/50 hover:bg-(--bg-card-hover)'
              }`}
            >
              {showEvents ? t('hideEvents') : t('showEvents')}
            </button>
            <button
              onClick={() => setShowTodos((v) => !v)}
              className={`inline-flex items-center px-3 py-2 sm:px-2.5 sm:py-1 rounded-md border text-sm transition-colors ${
                showTodos
                  ? 'border-(--accent)/50 text-(--accent) hover:bg-(--bg-card-hover)'
                  : 'border-(--border) text-(--text-muted) hover:text-(--accent) hover:border-(--accent)/50 hover:bg-(--bg-card-hover)'
              }`}
            >
              {showTodos ? t('hideTasks') : t('showTasks')}
            </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            <span className="text-sm sm:text-base text-(--text-muted) font-display uppercase shrink-0">{t('categoriesLabel')}</span>
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
            <button
              onClick={openCategoryManagerModal}
              className="inline-flex items-center px-3 py-2 sm:px-2.5 sm:py-1 rounded-md border border-(--border) text-sm text-(--text-muted) hover:text-(--accent) hover:border-(--accent)/50 hover:bg-(--bg-card-hover) transition-colors"
            >
              {t('manage')}
            </button>
            {categories.map(({ id, name, color, isVisible }) => (
              <span key={id} className="flex items-center gap-1 text-sm">
                <button
                  onClick={() => toggleCategoryVisibility(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 sm:px-2 sm:py-1 rounded border ${
                    isVisible ? 'border-(--accent)' : 'border-(--border) opacity-50'
                  } hover:bg-(--bg-card-hover) transition-colors`}
                  title={isVisible ? t('hideCategory') : t('showCategory')}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {name}
                </button>
              </span>
            ))}
            <span className="flex items-center gap-1.5 px-3 py-2 sm:px-2 sm:py-1 rounded border border-(--border) text-(--text-muted) text-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#6b7280' }} />
              {t('noCategory')}
            </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#e57373' }} />
            <span className="text-sm">{t('publicHoliday')}</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-(--border)">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-5">
            <h3 className="text-lg font-display text-(--text-primary)">{t('upcoming')}</h3>
            <div className="-mx-1 flex w-full items-center gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-theme sm:w-auto">
              <button
                type="button"
                onClick={() => setFeedFilter('all')}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  feedFilter === 'all'
                    ? 'border-(--border) bg-(--bg-dark) font-display tracking-wide text-(--text-primary)'
                    : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/60 hover:text-(--text-primary)'
                }`}
              >
                {t('filterAll')}
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter('events')}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  feedFilter === 'events'
                    ? 'border-(--border) bg-(--bg-dark) font-display tracking-wide text-(--text-primary)'
                    : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/60 hover:text-(--text-primary)'
                }`}
              >
                {t('filterEvents')}
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter('todos')}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  feedFilter === 'todos'
                    ? 'border-(--border) bg-(--bg-dark) font-display tracking-wide text-(--text-primary)'
                    : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/60 hover:text-(--text-primary)'
                }`}
              >
                {t('filterTasks')}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {upcomingFeed.length === 0 && (
              <p className="text-base text-(--text-muted) py-2">{t('noUpcoming')}</p>
            )}
            {upcomingFeed.map((item) =>
              item.kind === 'event' ? (
                <button
                  key={`event-${item.event.id}`}
                  onClick={() => openEditModal(item.event)}
                  className="group w-full text-left px-4 py-3.5 rounded-xl border border-(--border)/60 bg-(--bg-dark)/40 hover:bg-(--bg-card-hover) hover:border-(--border) transition-colors"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-(--accent)/40 bg-(--bg-card-hover) px-2.5 py-1 text-xs text-(--text-primary)">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {t('eventBadge')}
                  </span>
                  <p className="mt-2.5 text-sm text-(--text-muted)">
                    {formatHumanDate(item.event.date)}
                    {item.event.time ? ` · ${item.event.time}` : ''}
                  </p>
                  <p className="mt-1 text-base font-medium text-(--text-primary) leading-snug">{item.event.title}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-(--text-muted)">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getEventCardColor(item.event) }} />
                    {getEventCategoryLabel(item.event)}
                  </p>
                </button>
              ) : (
                <div
                  key={`todo-${item.todo.id}`}
                  className={`group w-full text-left max-sm:px-4 max-sm:py-3.5 max-sm:rounded-xl max-sm:border-(--border)/60 max-sm:bg-(--bg-dark)/40 px-3 py-1.5 rounded-lg border border-transparent hover:border-(--border) ${
                    item.todo.done ? 'opacity-60' : ''
                  }`}
                >
                  {/* Desktop: meta + actions in one row, always visible */}
                  <div className="hidden sm:flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#6b7280]/50 bg-(--bg-card-hover) px-2 py-0.5 text-xs text-(--text-primary)">
                        {item.todo.done ? <CheckSquare2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                        {t('taskBadge')}
                      </span>
                      <span className="text-base text-(--text-muted)">
                        {formatHumanDate(item.todo.dueDate ?? localISODate())}
                        {item.todo.dueTime ? ` · ${item.todo.dueTime}` : ''} · {t(`todo:categoryLabel.${item.todo.category}`)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getTodoPriorityBadgeClass(item.todo.priority)}`}
                        title={t('priorityLabel', { label: t(`todo:priorityLabel.${item.todo.priority}`) })}
                      >
                        {t(`todo:priorityLabel.${item.todo.priority}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleTodo(item.todo.id, !item.todo.done)}
                        className="p-1 rounded hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--accent)"
                        title={item.todo.done ? t('markUndone') : t('markDone')}
                      >
                        {item.todo.done ? <CheckSquare2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                      <input
                        type="date"
                        value={rescheduleDateByTodoId[item.todo.id] ?? item.todo.dueDate ?? localISODate()}
                        onChange={(e) =>
                          setRescheduleDateByTodoId((prev) => ({ ...prev, [item.todo.id]: e.target.value }))
                        }
                        className="px-1.5 py-0.5 rounded text-xs border border-(--border) bg-(--bg-card) text-(--text-muted)"
                      />
                      <button
                        onClick={() => rescheduleTodoToDate(item.todo)}
                        className="px-2 py-0.5 rounded text-xs border border-(--border) text-(--text-muted) hover:text-(--text-primary)"
                        title={t('rescheduleTitle')}
                      >
                        {t('reschedule')}
                      </button>
                      <button
                        onClick={() => navigate('/todo')}
                        className="px-2 py-0.5 rounded text-xs border border-(--border) text-(--text-muted) hover:text-(--text-primary)"
                        title={t('goToTodoTitle')}
                      >
                        {t('goToTodo')}
                      </button>
                    </div>
                  </div>

                  {/* Mobile: meta */}
                  <div className="sm:hidden flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#6b7280]/50 bg-(--bg-card-hover) px-2.5 py-1 text-xs text-(--text-primary)">
                      {item.todo.done ? <CheckSquare2 className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      {t('taskBadge')}
                    </span>
                    <span className="text-sm text-(--text-muted)">
                      {formatHumanDate(item.todo.dueDate ?? localISODate())}
                      {item.todo.dueTime ? ` · ${item.todo.dueTime}` : ''}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getTodoPriorityBadgeClass(item.todo.priority)}`}
                      title={t('priorityLabel', { label: t(`todo:priorityLabel.${item.todo.priority}`) })}
                    >
                      {t(`todo:priorityLabel.${item.todo.priority}`)}
                    </span>
                  </div>
                  <p className={`max-sm:mt-2.5 flex items-start gap-2 text-base leading-snug ${item.todo.done ? 'line-through text-(--text-muted)' : 'text-(--text-primary)'}`}>
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-[#6b7280]" />
                    {item.todo.text}
                  </p>
                  {/* Mobile: actions in two rows */}
                  <div className="mt-3 flex flex-col gap-2 sm:hidden">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTodo(item.todo.id, !item.todo.done)}
                        className="p-2 rounded-lg border border-(--border) hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--accent) shrink-0"
                        aria-label={item.todo.done ? t('markUndone') : t('markDone')}
                      >
                        {item.todo.done ? <CheckSquare2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                      <input
                        type="date"
                        value={rescheduleDateByTodoId[item.todo.id] ?? item.todo.dueDate ?? localISODate()}
                        onChange={(e) =>
                          setRescheduleDateByTodoId((prev) => ({ ...prev, [item.todo.id]: e.target.value }))
                        }
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-sm border border-(--border) bg-(--bg-card) text-(--text-muted)"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => rescheduleTodoToDate(item.todo)}
                        className="flex-1 px-3 py-1.5 rounded-lg text-sm border border-(--border) text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-card-hover)"
                        title={t('rescheduleTitle')}
                      >
                        {t('reschedule')}
                      </button>
                      <button
                        onClick={() => navigate('/todo')}
                        className="flex-1 px-3 py-1.5 rounded-lg text-sm border border-(--border) text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-card-hover)"
                      >
                        {t('goToTodo')}
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
