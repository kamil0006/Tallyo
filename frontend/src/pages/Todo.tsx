import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModalShell } from '../components/ModalShell'
import { TodoDueQuickPick, type TodoDuePickMode } from '../components/todo/TodoDueQuickPick'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Plus,
  Trash2,
  Circle,
  CheckCircle2,
  ClipboardList,
  Pencil,
  X,
  CalendarDays,
  Target,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { useTodos, type TodoItem } from '../context/TodosContext'
import { useEvents, normalizeEventDate } from '../context/EventsContext'
import { useHabits } from '../context/HabitsContext'
import { SimplePageSkeleton } from '../components/skeletons'
import { TODO_ITEM_SPRING, todoItemEnterVariants } from '../lib/todoMotion'
import { parseQuickTodoInput } from '../lib/todoQuickParse'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  TODO_CATEGORIES,
  compareTodosForDisplay,
  formatTodoDueSummary,
  isArchivedTodo,
  isTodoDueToday,
  isTodoOverdue,
  localISODate,
  todoDateStatus,
  todoInTodayBucket,
  todoMatchesTab,
  type TodoCategory,
  type TodoPriority,
  type TodoTabFilter,
} from '../lib/todoDomain'
import { useTodoDueLabels } from '../lib/useTodoDueLabels'

const TAB_IDS: TodoTabFilter[] = ['today', 'upcoming', 'all', 'done']
const PRIORITY_IDS: TodoPriority[] = ['low', 'medium', 'high']

/** Display: sentence-case first letter (without changing the stored text). */
function formatTodoTitleForDisplay(text: string, locale: string): string {
  const s = text.trim()
  if (!s) return text
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}

function TodoQuickParseHintContent() {
  const { t, i18n } = useTranslation('todo')
  const priorityLabel = (p: TodoPriority) => t(`priorityLabel.${p}`)
  const categoryLabel = (c: TodoCategory) => t(`categoryLabel.${c}`)
  const categoryTags = TODO_CATEGORIES.map((c) => `#${c}`).join(' ')
  const dueWordTokens =
    i18n.language === 'pl'
      ? { today: 'dziś', tomorrow: 'jutro', dayAfterTomorrow: 'pojutrze' }
      : { today: 'today', tomorrow: 'tomorrow', dayAfterTomorrow: 'the day after tomorrow' }

  return (
    <div className="space-y-4 text-base text-(--text-muted)">
      <p className="leading-relaxed">{t('quickParseHint.intro')}</p>

      <section className="space-y-2">
        <h4 className="font-display text-sm tracking-wide text-(--text-primary)">{t('quickParseHint.priorityTitle')}</h4>
        <ul className="space-y-1.5 leading-relaxed">
          <li>
            <code className="text-(--text-primary)">?</code> — {priorityLabel('low')}
          </li>
          <li>{t('quickParseHint.priorityMediumDefault', { label: priorityLabel('medium') })}</li>
          <li>
            <code className="text-(--text-primary)">!</code> — {priorityLabel('high')}
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h4 className="font-display text-sm tracking-wide text-(--text-primary)">{t('quickParseHint.dueTitle')}</h4>
        <ul className="space-y-1.5 leading-relaxed">
          <li>
            {t('quickParseHint.dueWordsLabel')}{' '}
            <code className="text-(--text-primary)">{dueWordTokens.today}</code>,{' '}
            <code className="text-(--text-primary)">{dueWordTokens.tomorrow}</code>,{' '}
            <code className="text-(--text-primary)">{dueWordTokens.dayAfterTomorrow}</code>
          </li>
          <li>{t('quickParseHint.dueDate')}</li>
          <li>{t('quickParseHint.dueTime')}</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h4 className="font-display text-sm tracking-wide text-(--text-primary)">{t('quickParseHint.areaTitle')}</h4>
        <p className="leading-relaxed">
          {t('quickParseHint.areaHint')}{' '}
          <code className="wrap-break-word text-(--text-primary)">{categoryTags}</code>
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-(--border)/70 bg-(--bg-dark)/40 px-3 py-2.5">
        <h4 className="font-display text-sm tracking-wide text-(--text-primary)">{t('quickParseHint.exampleTitle')}</h4>
        <p>
          <code className="text-(--text-primary)">Zapłacić rachunki jutro 14:30 #finanse !</code>
        </p>
        <ul className="mt-2 space-y-1 text-sm leading-relaxed">
          <li>
            <span className="text-(--text-primary)">{t('quickParseHint.exampleTitleField')}</span> {t('quickParseHint.exampleTitleValue')}
          </li>
          <li>
            <span className="text-(--text-primary)">{t('quickParseHint.exampleDueField')}</span> {t('quickParseHint.exampleDueValue')}
          </li>
          <li>
            <span className="text-(--text-primary)">{t('quickParseHint.exampleAreaField')}</span> {categoryLabel('finanse')}
          </li>
          <li>
            <span className="text-(--text-primary)">{t('quickParseHint.examplePriorityField')}</span> {priorityLabel('high')}
          </li>
        </ul>
      </section>

      <p className="leading-relaxed">{t('quickParseHint.optionsHint')}</p>
    </div>
  )
}

function TodoQuickParseHint() {
  const { t } = useTranslation('todo')
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || isMobile) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, isMobile])

  useEffect(() => {
    if (!open || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isMobile])

  return (
    <>
      <div className="relative shrink-0" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-muted) transition-colors hover:border-(--border) hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
          aria-label={t('quickParseHint.buttonAria')}
          aria-expanded={open}
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        {open && !isMobile && (
          <div
            role="dialog"
            aria-label={t('quickParseHint.buttonAria')}
            className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-[min(26rem,calc(100vw-2rem))] max-h-[min(70vh,28rem)] overflow-y-auto rounded-lg border border-(--border) bg-(--bg-card) p-4 shadow-lg"
          >
            <p className="mb-3 font-display text-sm tracking-wide text-(--text-primary)">{t('quickParseHint.title')}</p>
            <TodoQuickParseHintContent />
          </div>
        )}
      </div>
      {open && isMobile && (
        <ModalShell
          isOpen={open}
          onClose={() => setOpen(false)}
          maxWidth="max-w-md"
          backdropKey="todo-hint-backdrop"
          panelKey="todo-hint-panel"
          zBackdrop={60}
          zPanel={70}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-display text-sm tracking-wide text-(--text-primary)">{t('quickParseHint.title')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
              aria-label={t('quickParseHint.closeAria')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <TodoQuickParseHintContent />
        </ModalShell>
      )}
    </>
  )
}

const pageEnter = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const itemEnter = todoItemEnterVariants

function chipClass(kind: 'priority' | 'date', variant: string) {
  const base =
    'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 font-display text-xs tracking-wide'
  if (kind === 'priority') {
    if (variant === 'high')
      return `${base} border-(--warning)/40 bg-(--warning)/10 text-(--warning)`
    if (variant === 'medium')
      return `${base} border-(--border) bg-(--bg-dark)/60 text-(--text-muted)`
    return `${base} border-(--border) bg-(--bg-dark)/80 text-(--text-muted)`
  }
  if (variant === 'overdue')
    return `${base} border-red-500/35 bg-red-500/10 text-red-400`
  if (variant === 'today')
    return `${base} border-(--border) bg-(--bg-dark)/50 text-(--text-muted)`
  return `${base} border-(--border) text-(--text-muted)`
}

function TodoMetaChips({ todo }: { todo: TodoItem }) {
  const { t } = useTranslation('todo')
  const ds = todoDateStatus(todo.dueDate)
  const pri =
    todo.priority === 'high' ? 'high' : todo.priority === 'medium' ? 'medium' : 'low'

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className={chipClass('priority', pri)}>{t(`priorityLabel.${todo.priority}`)}</span>
      {ds === 'overdue' && <span className={chipClass('date', 'overdue')}>{t('priorityOverdue')}</span>}
      {ds === 'today' && <span className={chipClass('date', 'today')}>{t('priorityToday')}</span>}
      {ds === 'none' && (
        <span className={chipClass('date', 'none')}>{t('priorityNone')}</span>
      )}
    </div>
  )
}

function TodoTaskCard({
  todo,
  compact,
  onToggle,
  onRemove,
  onEdit,
}: {
  todo: TodoItem
  compact?: boolean
  onToggle: () => void
  onRemove: () => void
  onEdit: () => void
}) {
  const { t, i18n } = useTranslation('todo')
  const dueLabels = useTodoDueLabels()
  const reduceMotion = useReducedMotion()
  const layoutTransition = reduceMotion
    ? { duration: 0.2 }
    : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.85 }

  return (
    <motion.div
      layout
      layoutId={`todo-card-${todo.id}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduceMotion ? { layout: layoutTransition } : { layout: layoutTransition, ...TODO_ITEM_SPRING }
      }
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.92, filter: 'blur(4px)', transition: { duration: 0.2 } }
      }
      className={`group relative flex flex-col overflow-hidden rounded-lg border transition-colors sm:flex-row sm:items-start ${
        compact ? 'gap-1.5 p-2 sm:p-2.5' : 'gap-2 p-3'
      } ${
        todo.done
          ? 'border-(--border) bg-(--bg-dark)/50'
          : 'border-(--border) bg-(--bg-dark) hover:border-(--border)'
      }`}
    >
      {todo.done ? (
        <motion.span
          aria-hidden
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-(--positive)/70"
          layout
          initial={false}
          animate={{ opacity: 0.45, scaleY: 0.65 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      ) : (
        (todo.priority === 'high' || (todo.dueDate && isTodoOverdue(todo.dueDate))) && (
          <motion.span
            aria-hidden
            className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${
              todo.dueDate && isTodoOverdue(todo.dueDate)
                ? 'bg-red-500/75'
                : 'bg-(--warning)/70'
            }`}
            layout
            initial={false}
            animate={{ opacity: 0.95, scaleY: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )
      )}
      <div className={`relative z-1 flex min-w-0 flex-1 ${compact ? 'gap-2' : 'gap-3'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors ${
            todo.done
              ? 'text-(--positive)'
              : 'border border-(--border) text-(--text-muted) hover:border-(--border) hover:text-(--text-primary)'
          }`}
        >
          <motion.span
            key={todo.done ? 'done' : 'open'}
            initial={reduceMotion ? false : { scale: 0.6, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            {todo.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
          </motion.span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-(--border)"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span
              className={`text-base font-medium leading-snug ${
                todo.done ? 'text-(--text-muted) line-through decoration-(--positive)/50' : 'text-(--text-primary)'
              }`}
            >
              {formatTodoTitleForDisplay(todo.text, i18n.language === 'pl' ? 'pl-PL' : 'en-US')}
            </span>
            <TodoMetaChips todo={todo} />
          </div>
          <p className={`text-base text-(--text-muted) ${compact ? 'mt-0.5' : 'mt-1'}`}>
            {t(`categoryLabel.${todo.category}`)}
            {' · '}
            {formatTodoDueSummary(todo.dueDate, todo.dueTime, dueLabels)}
          </p>
          {todo.noteId && (
            <p className={compact ? 'mt-0.5' : 'mt-1'}>
              <Link
                to="/notes/inbox"
                className="font-display text-xs tracking-wide text-(--text-muted) underline-offset-2 hover:text-(--text-primary) hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {t('linkedNote')}
              </Link>
            </p>
          )}
        </button>
      </div>
      <div className={`relative z-1 flex shrink-0 justify-end gap-1 sm:flex-col ${compact ? 'sm:pt-0' : 'sm:pt-0.5'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="rounded p-1.5 text-(--text-muted) opacity-70 transition-all hover:text-(--text-primary) group-hover:opacity-100"
          aria-label={t('editAria')}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="rounded p-1.5 text-(--text-muted) opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
          aria-label={t('deleteAria')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

function TodoEditModal({
  todo,
  onClose,
  onSave,
}: {
  todo: TodoItem
  onClose: () => void
  onSave: (patch: {
    text: string
    dueDate: string | null
    dueTime: string | null
    priority: TodoPriority
    category: TodoCategory
  }) => void
}) {
  const { t } = useTranslation('todo')
  const [text, setText] = useState(todo.text)
  const [dueDate, setDueDate] = useState(todo.dueDate ?? '')
  const [dueTime, setDueTime] = useState(todo.dueTime ?? '')
  const [priority, setPriority] = useState<TodoPriority>(todo.priority)
  const [category, setCategory] = useState<TodoCategory>(todo.category)

  useEffect(() => {
    setText(todo.text)
    setDueDate(todo.dueDate ?? '')
    setDueTime(todo.dueTime ?? '')
    setPriority(todo.priority)
    setCategory(todo.category)
  }, [todo.id, todo.text, todo.dueDate, todo.dueTime, todo.priority, todo.category])

  const save = () => {
    const value = text.trim()
    if (!value) return
    onSave({
      text: value,
      dueDate: dueDate.trim() || null,
      dueTime: dueTime.trim() || null,
      priority,
      category,
    })
    onClose()
  }

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      maxWidth="max-w-md"
      backdropKey="todo-edit-backdrop"
      panelKey="todo-edit-panel"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-(--text-primary)">{t('editModal.title')}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-(--text-muted) hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
          aria-label={t('editModal.closeAria')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-base text-(--text-muted)">{t('editModal.textLabel')}</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none"
          />
        </div>
        <TodoDueQuickPick
          mode="explicit"
          onModeExplicit={() => {}}
          hideInheritHint
          quickDueDate={dueDate}
          quickDueTime={dueTime}
          onChangeQuickDueDate={setDueDate}
          onChangeQuickDueTime={setDueTime}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-base text-(--text-muted)">{t('editModal.priorityLabel')}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none"
            >
              {PRIORITY_IDS.map((p) => (
                <option key={p} value={p}>
                  {t(`priorityLabel.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-base text-(--text-muted)">{t('editModal.areaLabel')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TodoCategory)}
              className="w-full rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--accent)/50 focus:outline-none"
            >
              {TODO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categoryLabel.${c}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg border border-(--border) px-4 py-2.5 text-base text-(--text-muted) hover:bg-(--bg-card-hover) hover:text-(--text-primary) sm:w-auto"
        >
          {t('editModal.cancel')}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!text.trim()}
          className="w-full rounded-lg border border-(--accent)/40 bg-(--accent)/20 px-4 py-2.5 font-display text-base text-(--accent) hover:bg-(--accent)/30 disabled:opacity-40 sm:w-auto"
        >
          {t('editModal.save')}
        </button>
      </div>
    </ModalShell>
  )
}

function partitionTodayTodos(items: TodoItem[]) {
  const overdue = items.filter((t) => t.dueDate && isTodoOverdue(t.dueDate))
  const todayDated = items.filter(
    (t) => t.dueDate && !isTodoOverdue(t.dueDate) && isTodoDueToday(t.dueDate)
  )
  const undated = items.filter((t) => !t.dueDate)
  return { overdue, todayDated, undated }
}

export function Todo() {
  const { t } = useTranslation('todo')
  const isMobile = useIsMobile()
  const { isDemoMode } = useAuth()
  const { todos, addTodo, updateTodo, toggleTodo, removeTodo, clearCompletedTodos, loading } =
    useTodos()
  const { events } = useEvents()
  const { habits } = useHabits()
  const [tab, setTab] = useState<TodoTabFilter>('today')
  const [categoryFilter, setCategoryFilter] = useState<TodoCategory | 'all'>('all')
  const [newText, setNewText] = useState('')
  const [duePickMode, setDuePickMode] = useState<TodoDuePickMode>('inherit')
  const [quickDueDate, setQuickDueDate] = useState('')
  const [quickDueTime, setQuickDueTime] = useState('')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [draftPriority, setDraftPriority] = useState<TodoPriority | null>(null)
  const [draftCategory, setDraftCategory] = useState<TodoCategory | null>(null)
  const [editing, setEditing] = useState<TodoItem | null>(null)
  const [clearPrompt, setClearPrompt] = useState(false)
  const [undatedCollapsed, setUndatedCollapsed] = useState(false)
  const reduceMotion = useReducedMotion()

  const todayIso = localISODate()

  const todayBucketTodos = useMemo(
    () => todos.filter((t) => todoMatchesTab(t, 'today')),
    [todos]
  )

  const todosTodayOpen = useMemo(
    () => todayBucketTodos.filter((t) => !t.done),
    [todayBucketTodos]
  )

  const planStats = useMemo(() => {
    const todosToday = todosTodayOpen.length
    const eventsToday = events.filter((e) => normalizeEventDate(e.date) === todayIso).length
    const activeHabits = habits.filter((h) => !h.archivedAt).length
    return { todosToday, eventsToday, activeHabits }
  }, [todosTodayOpen, events, habits, todayIso])

  const todayDoneCount = useMemo(
    () => todos.filter((t) => t.done && !isArchivedTodo(t) && todoInTodayBucket(t)).length,
    [todos]
  )

  const filtered = useMemo(() => {
    let list = todos.filter((t) => todoMatchesTab(t, tab))
    if (categoryFilter !== 'all') {
      list = list.filter((t) => t.category === categoryFilter)
    }
    return [...list].sort(compareTodosForDisplay)
  }, [todos, tab, categoryFilter])

  const todaySummary = useMemo(() => {
    const openToday = todayBucketTodos.filter((t) => !t.done)
    const high = openToday.filter((t) => t.priority === 'high').length
    return { count: openToday.length, high }
  }, [todayBucketTodos])

  const add = () => {
    const raw = newText.trim()
    if (!raw) return
    const parsed = parseQuickTodoInput(raw)
    if (!parsed.text) return
    const dueDate =
      duePickMode === 'explicit' ? quickDueDate.trim() || null : parsed.dueDate ?? null
    const dueTime =
      duePickMode === 'explicit' ? quickDueTime.trim() || null : parsed.dueTime ?? null
    addTodo({
      text: parsed.text,
      dueDate,
      dueTime,
      priority: draftPriority ?? parsed.priority,
      category: draftCategory ?? parsed.category,
    })
    setNewText('')
    setDuePickMode('inherit')
    setQuickDueDate('')
    setQuickDueTime('')
    setOptionsOpen(false)
    setDraftPriority(null)
    setDraftCategory(null)
  }

  const toggle = (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return
    toggleTodo(id, !todo.done)
  }

  const optionsDirty =
    Boolean(quickDueDate || quickDueTime) || draftPriority !== null || draftCategory !== null

  if (loading) {
    return <SimplePageSkeleton titleWidth="w-32" />
  }

  const renderList = () => {
    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={ClipboardList}
          title={tab === 'done' ? t('emptyDoneTitle') : t('emptyDefaultTitle')}
          description={tab === 'done' ? t('emptyDoneDescription') : t('emptyDefaultDescription')}
          compact
        />
      )
    }

    if (tab === 'today') {
      const { overdue, todayDated, undated } = partitionTodayTodos(filtered)
      const renderGroup = (label: string | null, items: TodoItem[]) => {
        if (items.length === 0) return null
        return (
          <div key={label ?? 'rest'} className="space-y-2">
            {label && (
              <h3 className="font-display text-base tracking-wide text-(--text-muted)">{label}</h3>
            )}
            <AnimatePresence mode="popLayout">
              {items.map((todo) => (
                <TodoTaskCard
                  key={todo.id}
                  todo={todo}
                  compact={!todo.dueDate && !todo.done}
                  onToggle={() => toggle(todo.id)}
                  onRemove={() => removeTodo(todo.id)}
                  onEdit={() => setEditing(todo)}
                />
              ))}
            </AnimatePresence>
          </div>
        )
      }
      return (
        <div className="space-y-6">
          {renderGroup(t('groupOverdue'), overdue)}
          {renderGroup(t('groupToday'), todayDated)}
          {undated.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setUndatedCollapsed((c) => !c)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-1 py-0.5 text-left font-display text-base tracking-wide text-(--text-muted) transition-colors hover:border-(--border)/60 hover:bg-(--bg-dark)/40 hover:text-(--text-primary)"
                aria-expanded={!undatedCollapsed}
              >
                <span>{t('groupUndated', { count: undated.length })}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${undatedCollapsed ? '-rotate-90' : 'rotate-0'}`}
                  aria-hidden
                />
              </button>
              {!undatedCollapsed && (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2">
                    {undated.map((todo) => (
                      <TodoTaskCard
                        key={todo.id}
                        todo={todo}
                        compact={!todo.dueDate && !todo.done}
                        onToggle={() => toggle(todo.id)}
                        onRemove={() => removeTodo(todo.id)}
                        onEdit={() => setEditing(todo)}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((todo) => (
            <TodoTaskCard
              key={todo.id}
              todo={todo}
              compact={!todo.dueDate && !todo.done}
              onToggle={() => toggle(todo.id)}
              onRemove={() => removeTodo(todo.id)}
              onEdit={() => setEditing(todo)}
            />
          ))}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <motion.div
      className="relative space-y-6"
      variants={pageEnter}
      initial="hidden"
      animate="show"
    >
      {!reduceMotion && (
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -right-20 top-0 h-72 max-w-none overflow-hidden opacity-[0.2] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 30% 20%, rgba(130,167,207,0.08), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 40%, rgba(201,163,92,0.05), transparent 50%)',
          }}
        />
      )}

      <motion.div variants={itemEnter} className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-2xl font-bold tracking-wider text-(--text-primary)">TO-DO</h1>
        {isDemoMode && (
          <span className="font-display text-sm tracking-wide text-(--text-muted)">{t('demoLabel')}</span>
        )}
      </motion.div>

      <motion.div
        variants={itemEnter}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--border)/80 bg-(--bg-card)/25 px-3 py-2"
      >
        <p className="min-w-0 text-base text-(--text-muted)">
          <span className="font-display text-(--text-primary)">{t('todayCard.label')}</span>{' '}
          {planStats.todosToday} {t('taskWord', { count: planStats.todosToday })} · {planStats.eventsToday}{' '}
          {t('eventWord', { count: planStats.eventsToday })} · {planStats.activeHabits} {t('habitWord', { count: planStats.activeHabits })}
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to="/calendar"
            className="inline-flex items-center gap-1.5 rounded-md border border-(--border) px-2.5 py-1.5 font-display text-sm text-(--text-muted) transition-colors hover:border-(--border) hover:bg-(--bg-dark) hover:text-(--text-primary)"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {t('todayCard.calendarLink')}
          </Link>
          <Link
            to="/habits"
            className="inline-flex items-center gap-1.5 rounded-md border border-(--border) px-2.5 py-1.5 font-display text-sm text-(--text-muted) transition-colors hover:border-(--border) hover:bg-(--bg-dark) hover:text-(--text-primary)"
          >
            <Target className="h-3.5 w-3.5" />
            {t('todayCard.habitsLink')}
          </Link>
        </div>
      </motion.div>

      <motion.div variants={itemEnter} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={isMobile ? t('quickAddPlaceholderMobile') : t('quickAddPlaceholderDesktop')}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--border) focus:outline-none focus:ring-1 focus:ring-(--text-primary)/15"
          />
          <TodoQuickParseHint />
          <motion.button
            type="button"
            onClick={add}
            title={t('addTaskTitle')}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-(--accent)/45 bg-(--accent)/18 px-4 font-display text-sm tracking-wide text-(--accent) shadow-[0_0_0_1px_rgba(130,167,207,0.08)] transition-colors hover:bg-(--accent)/26"
            aria-label={t('addTaskTitle')}
          >
            <Plus className="h-5 w-5 shrink-0" />
            <span className="hidden sm:inline">{t('addButton')}</span>
          </motion.button>
        </div>
        <button
          type="button"
          onClick={() => setOptionsOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-(--border) bg-(--bg-card)/30 px-3 py-2.5 font-display text-sm tracking-wide text-(--text-muted) transition-colors hover:border-(--border) hover:bg-(--bg-dark) hover:text-(--text-primary) sm:inline-flex sm:w-auto sm:py-2"
          aria-expanded={optionsOpen}
        >
          {optionsOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <span>{t('optionsButton')}</span>
          {!optionsOpen && optionsDirty && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--warning)/80" title={t('optionsDirtyHint')} />
          )}
        </button>
        {optionsOpen && (
          <div className="space-y-4 rounded-lg border border-(--border)/80 bg-(--bg-card)/25 p-3 sm:p-4">
            <TodoDueQuickPick
              embedded
              mode={duePickMode}
              onModeExplicit={() => setDuePickMode('explicit')}
              hideInheritHint
              quickDueDate={quickDueDate}
              quickDueTime={quickDueTime}
              onChangeQuickDueDate={setQuickDueDate}
              onChangeQuickDueTime={setQuickDueTime}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-base text-(--text-muted)">{t('priorityFieldLabel')}</span>
                <select
                  value={draftPriority ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraftPriority(v === '' ? null : (v as TodoPriority))
                  }}
                  className="min-h-11 rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--border) focus:outline-none focus:ring-1 focus:ring-(--text-primary)/15"
                >
                  <option value="">—</option>
                  {PRIORITY_IDS.map((p) => (
                    <option key={p} value={p}>
                      {t(`priorityLabel.${p}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-base text-(--text-muted)">{t('areaFieldLabel')}</span>
                <select
                  value={draftCategory ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraftCategory(v === '' ? null : (v as TodoCategory))
                  }}
                  className="min-h-11 rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2 text-base text-(--text-primary) focus:border-(--border) focus:outline-none focus:ring-1 focus:ring-(--text-primary)/15"
                >
                  <option value="">—</option>
                  {TODO_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`categoryLabel.${c}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        variants={itemEnter}
        className="flex flex-col gap-1.5 rounded-lg border border-(--border)/70 bg-(--bg-card)/20 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap gap-1">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md border px-2.5 py-1.5 font-display text-sm tracking-wide transition-colors ${
                tab === id
                  ? 'border-(--border) bg-(--bg-dark) text-(--text-primary)'
                  : 'border-transparent bg-transparent text-(--text-muted) hover:bg-(--bg-card-hover)/50 hover:text-(--text-primary)'
              }`}
            >
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {tab === 'done' && todos.some((t) => t.done) && (
            <button
              type="button"
              onClick={() => setClearPrompt(true)}
              className="rounded-md border border-red-500/25 bg-red-500/5 px-2.5 py-1.5 font-display text-sm text-red-400/90 hover:bg-red-500/10"
            >
              {t('clearCompleted')}
            </button>
          )}
          <label className="flex items-center gap-1.5 whitespace-nowrap font-display text-sm text-(--text-muted)">
            {t('areaFieldLabel')}
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value === 'all' ? 'all' : (e.target.value as TodoCategory))
              }
              className="max-w-44 rounded-md border border-(--border) bg-(--bg-dark) px-2 py-1.5 text-base text-(--text-primary) focus:border-(--border) focus:outline-none focus:ring-1 focus:ring-(--text-primary)/15"
            >
              <option value="all">{t('areaAllOption')}</option>
              {TODO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categoryLabel.${c}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </motion.div>

      {tab === 'today' && (
        <motion.div variants={itemEnter} className="space-y-0.5">
          <h2 className="font-display text-lg font-semibold tracking-wide text-(--text-primary)">{t('todaySection.title')}</h2>
          <p className="text-base text-(--text-muted)">
            {todaySummary.count} {t('taskWord', { count: todaySummary.count })}
            {todaySummary.high > 0 && <>{t('todaySection.highCount', { count: todaySummary.high })}</>}
            {todayDoneCount > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => setTab('done')}
                  className="font-display text-(--text-muted) underline-offset-2 hover:text-(--text-primary) hover:underline"
                  title={t('todaySection.doneLinkTitle')}
                >
                  {t('todaySection.doneLink', { count: todayDoneCount })}
                </button>
              </>
            )}
          </p>
        </motion.div>
      )}

      <motion.section variants={itemEnter} className="space-y-3">
        {renderList()}
      </motion.section>

      {editing && (
        <TodoEditModal
          key={editing.id}
          todo={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) =>
            updateTodo(editing.id, {
              text: patch.text,
              dueDate: patch.dueDate,
              dueTime: patch.dueTime,
              priority: patch.priority,
              category: patch.category,
            })
          }
        />
      )}

      <ConfirmDialog
        isOpen={clearPrompt}
        onClose={() => setClearPrompt(false)}
        onConfirm={() => {
          clearCompletedTodos()
          setClearPrompt(false)
        }}
        title={t('clearCompletedConfirm.title')}
        description={t('clearCompletedConfirm.description')}
        variant="danger"
        confirmLabel={t('clearCompletedConfirm.confirmLabel')}
      />
    </motion.div>
  )
}
