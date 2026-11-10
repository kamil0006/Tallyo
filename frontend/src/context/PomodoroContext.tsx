import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLearning, type SessionType } from './LearningContext'
import { useAuth } from './AuthContext'

/** One timer per account (and one for demo mode). */
const storageKeyFor = (scope: string) => `tallyo_pomodoro_v1:${scope}`

export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'completed'

/** Timer state kept in localStorage, so it survives page changes, reloads and other tabs. */
interface PomodoroState {
  status: PomodoroStatus
  selectedMinutes: number
  /** When running: the moment (epoch ms) the session ends. Based on the clock, not on counting ticks,
   * so a throttled or frozen background tab still ends on time. */
  endsAt: number | null
  /** When paused or idle: time left in ms. */
  remainingMs: number
  topic: string
  sessionType: SessionType
}

const DEFAULT_MINUTES = 30

const initialState = (minutes = DEFAULT_MINUTES): PomodoroState => ({
  status: 'idle',
  selectedMinutes: minutes,
  endsAt: null,
  remainingMs: minutes * 60_000,
  topic: '',
  sessionType: 'praktyka',
})

function isState(x: unknown): x is PomodoroState {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    ['idle', 'running', 'paused', 'completed'].includes(o.status as string) &&
    typeof o.selectedMinutes === 'number' &&
    (o.endsAt === null || typeof o.endsAt === 'number') &&
    typeof o.remainingMs === 'number' &&
    typeof o.topic === 'string' &&
    typeof o.sessionType === 'string'
  )
}

function loadState(key: string): PomodoroState {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return isState(parsed) ? parsed : initialState()
  } catch {
    return initialState()
  }
}

function saveState(key: string, state: PomodoroState) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    /* storage unavailable — the timer still works in this tab */
  }
}

function localIsoDate(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const schedule = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }
    schedule(880, 0, 0.3)
    schedule(1100, 0.35, 0.3)
    schedule(880, 0.7, 0.5)
  } catch {
    /* Web Audio or autoplay unavailable */
  }
}

/** System notification, so the end of a session is noticed while working in another tab or app. */
async function notify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const options = { body, icon: '/icons/icon-192.png', tag: 'tallyo-pomodoro' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, options)
      return
    }
  } catch {
    /* fall back to a page notification */
  }
  try {
    new Notification(title, options)
  } catch {
    /* notifications unavailable (e.g. mobile browsers without a service worker) */
  }
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface PomodoroContextValue {
  status: PomodoroStatus
  selectedMinutes: number
  /** Whole seconds left. */
  timeLeft: number
  topic: string
  sessionType: SessionType
  isOpen: boolean
  open: () => void
  close: () => void
  setTopic: (topic: string | ((prev: string) => string)) => void
  setSessionType: (type: SessionType) => void
  selectMinutes: (minutes: number) => void
  start: () => void
  pause: () => void
  reset: () => void
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null)

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('learning')
  const learning = useLearning()
  const { user } = useAuth()
  const storageKey = storageKeyFor(user?.id ?? 'demo')
  const [state, setState] = useState<PomodoroState>(() => loadState(storageKey))
  const [now, setNow] = useState(() => Date.now())
  const [isOpen, setIsOpen] = useState(false)

  const learningRef = useRef(learning)
  const tRef = useRef(t)
  useEffect(() => {
    learningRef.current = learning
    tRef.current = t
  }, [learning, t])

  const update = useCallback((next: PomodoroState | ((prev: PomodoroState) => PomodoroState)) => {
    setState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      saveState(storageKey, value)
      return value
    })
  }, [storageKey])

  /** Ends a running session once its time is up. Re-reads storage first, so when several tabs are open
   * only the first one saves the session. */
  const completeIfDue = useCallback(() => {
    const stored = loadState(storageKey)
    if (stored.status !== 'running' || stored.endsAt === null) {
      setState(stored)
      return
    }
    if (Date.now() < stored.endsAt) return
    const done: PomodoroState = { ...stored, status: 'completed', endsAt: null, remainingMs: 0 }
    saveState(storageKey, done)
    setState(done)
    const mins = stored.selectedMinutes
    learningRef.current?.addSession({
      date: localIsoDate(stored.endsAt),
      minutes: mins,
      topic: stored.topic.trim() || 'Sesja pomodoro',
      type: stored.sessionType,
      note: `Pomodoro ${mins} min`,
    })
    playBeep()
    void notify(tRef.current('pomodoro.notifyTitle'), tRef.current('pomodoro.sessionAdded', { minutes: mins }))
  }, [storageKey])

  // Finish exactly on time, also when the session ended while the tab or app was in the background.
  useEffect(() => {
    if (state.status !== 'running' || state.endsAt === null) return
    const timeout = window.setTimeout(completeIfDue, Math.max(0, state.endsAt - Date.now()))
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    const onWake = () => {
      setNow(Date.now())
      completeIfDue()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [state.status, state.endsAt, completeIfDue])

  // Keep other open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setState(loadState(storageKey))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const timeLeft =
    state.status === 'running' && state.endsAt !== null
      ? Math.max(0, Math.ceil((state.endsAt - now) / 1000))
      : Math.round(state.remainingMs / 1000)

  // Show the time left in the tab title while a session runs.
  const baseTitleRef = useRef<string | null>(null)
  useEffect(() => {
    if (baseTitleRef.current === null) baseTitleRef.current = document.title
    const base = baseTitleRef.current
    document.title = state.status === 'running' ? `${formatClock(timeLeft)} · ${base}` : base
  }, [state.status, timeLeft])
  useEffect(() => {
    return () => {
      if (baseTitleRef.current !== null) document.title = baseTitleRef.current
    }
  }, [])

  const start = useCallback(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => undefined)
    }
    const current = Date.now()
    setNow(current)
    update((prev) => {
      if (prev.status === 'running') return prev
      const remaining = prev.status === 'completed' ? prev.selectedMinutes * 60_000 : prev.remainingMs
      return { ...prev, status: 'running', endsAt: current + remaining, remainingMs: remaining }
    })
  }, [update])

  const pause = useCallback(() => {
    update((prev) => {
      if (prev.status !== 'running' || prev.endsAt === null) return prev
      return { ...prev, status: 'paused', remainingMs: Math.max(0, prev.endsAt - Date.now()), endsAt: null }
    })
  }, [update])

  const reset = useCallback(() => {
    update((prev) => ({ ...initialState(prev.selectedMinutes), topic: prev.topic, sessionType: prev.sessionType }))
  }, [update])

  const selectMinutes = useCallback(
    (minutes: number) => {
      update((prev) =>
        prev.status === 'running'
          ? prev
          : { ...initialState(minutes), topic: prev.topic, sessionType: prev.sessionType }
      )
    },
    [update]
  )

  const setTopic = useCallback(
    (topic: string | ((prev: string) => string)) =>
      update((prev) => ({ ...prev, topic: typeof topic === 'function' ? topic(prev.topic) : topic })),
    [update]
  )

  const setSessionType = useCallback((sessionType: SessionType) => update((prev) => ({ ...prev, sessionType })), [update])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const value: PomodoroContextValue = {
    status: state.status,
    selectedMinutes: state.selectedMinutes,
    timeLeft,
    topic: state.topic,
    sessionType: state.sessionType,
    isOpen,
    open,
    close,
    setTopic,
    setSessionType,
    selectMinutes,
    start,
    pause,
    reset,
  }

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}

export function usePomodoro() {
  const ctx = useContext(PomodoroContext)
  if (!ctx) throw new Error('usePomodoro must be used inside PomodoroProvider')
  return ctx
}

export { formatClock }
