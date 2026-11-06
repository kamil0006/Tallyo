import { createContext, useContext, type ReactNode } from 'react'
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { learningApi } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuthenticatedQueryEnabled } from '../hooks/useAuthenticatedQueryEnabled'

export type SessionType = 'kurs' | 'ksiazka' | 'projekt' | 'praktyka' | 'powtorka' | 'inne'

export interface LearningSession {
  id: string
  date: string
  minutes: number
  topic: string
  type: SessionType
  category?: string
  note?: string
  courseId?: string
  projectId?: string
  bookId?: string
}

export interface Course {
  id: string
  name: string
  platform?: string
  platformUrl?: string
  progress: number
  status: 'w_trakcie' | 'ukonczony' | 'zaplanowany'
  startedAt?: string
  completedAt?: string
  nextLesson?: string
}

export type ProjectStatus = 'pomysl' | 'w_trakcie' | 'mvp' | 'ukonczony' | 'porzucony'

export interface Project {
  id: string
  name: string
  description?: string
  tech?: string
  status: ProjectStatus
  url?: string
  githubUrl?: string
  nextStep?: string
  priority?: 'niski' | 'sredni' | 'wysoki'
}

export type ReadingStatus = 'chce_przeczytac' | 'czytam' | 'przeczytane'

export interface Book {
  id: string
  title: string
  author?: string
  category?: string
  status: ReadingStatus
  finishedAt?: string
  startedAt?: string
  rating?: number
  notes?: string
  keyTakeaway?: string
}

export interface Certification {
  id: string
  name: string
  issuer: string
  date: string
  url?: string
  expiryDate?: string
  verificationUrl?: string
  renewalReminderDays?: number
}

const currentYear = new Date().getFullYear()

/** Demo dates relative to today, so "this week" and charts always have data. */
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DEMO_SESSIONS: LearningSession[] = [
  { id: '1', date: daysAgo(1), minutes: 180, topic: 'Tallyo', type: 'projekt', category: 'Backend' },
  { id: '2', date: daysAgo(2), minutes: 120, topic: 'Backend API', type: 'projekt', category: 'Backend' },
  { id: '3', date: daysAgo(4), minutes: 240, topic: 'Node.js API', type: 'kurs', category: 'Backend' },
  { id: '4', date: daysAgo(7), minutes: 90, topic: 'Powtórka algorytmów', type: 'powtorka', category: 'Algorytmy' },
  { id: '5', date: daysAgo(9), minutes: 300, topic: 'React + TypeScript', type: 'kurs', category: 'Frontend' },
  { id: '6', date: daysAgo(20), minutes: 180, topic: 'Czysty Kod', type: 'ksiazka', category: 'Programowanie' },
  { id: '7', date: daysAgo(33), minutes: 150, topic: 'PostgreSQL', type: 'kurs', category: 'Backend' },
  { id: '8', date: daysAgo(42), minutes: 240, topic: 'Tallyo backend', type: 'projekt', category: 'Backend' },
  { id: '9', date: daysAgo(60), minutes: 180, topic: 'TypeScript generics', type: 'praktyka', category: 'Frontend' },
  { id: '10', date: daysAgo(90), minutes: 120, topic: 'Pragmatyczny Programista', type: 'ksiazka', category: 'Programowanie' },
]

const DEMO_SESSION_CATEGORIES = ['Frontend', 'Backend', 'Algorytmy', 'Programowanie', 'Angielski', 'Matematyka']

const DEMO_COURSES: Course[] = [
  {
    id: '1',
    name: 'React + TypeScript',
    platform: 'Udemy',
    platformUrl: 'https://udemy.com',
    progress: 100,
    status: 'ukonczony',
    startedAt: `${currentYear}-01-10`,
    completedAt: `${currentYear}-02-15`,
  },
  {
    id: '2',
    name: 'Node.js API',
    platform: 'YouTube',
    platformUrl: 'https://youtube.com',
    progress: 65,
    status: 'w_trakcie',
    startedAt: `${currentYear}-02-01`,
    nextLesson: 'Middleware i autoryzacja',
  },
  {
    id: '3',
    name: 'PostgreSQL dla zaawansowanych',
    platform: 'Udemy',
    progress: 0,
    status: 'zaplanowany',
  },
]

const DEMO_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Tallyo',
    description: 'Aplikacja do zarządzania życiem',
    tech: 'React, Node, PostgreSQL',
    status: 'w_trakcie',
    githubUrl: 'https://github.com/example/tallyo',
    priority: 'wysoki',
    nextStep: 'Zaimplementować sekcję nauki',
  },
  {
    id: '2',
    name: 'Portfolio',
    tech: 'Next.js',
    status: 'ukonczony',
    url: 'https://example.com',
    githubUrl: 'https://github.com/example/portfolio',
  },
]

const DEMO_BOOKS: Book[] = [
  {
    id: '1',
    title: 'Czysty kod',
    author: 'Robert C. Martin',
    category: 'Programowanie',
    status: 'przeczytane',
    finishedAt: `${currentYear}-02-20`,
    rating: 5,
    keyTakeaway: 'Piszę kod tak, żeby dało się go łatwo czytać',
  },
  {
    id: '2',
    title: 'Pragmatyczny programista',
    author: 'David Thomas, Andrew Hunt',
    category: 'Programowanie',
    status: 'przeczytane',
    finishedAt: `${currentYear}-01-05`,
    rating: 5,
  },
  {
    id: '3',
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Rozwój osobisty',
    status: 'czytam',
    startedAt: `${currentYear}-04-01`,
  },
]

const DEMO_CERTIFICATES: Certification[] = [
  {
    id: '1',
    name: 'AWS Cloud Practitioner',
    issuer: 'Amazon',
    date: '2024-12-01',
    expiryDate: '2027-12-01',
    verificationUrl: 'https://aws.amazon.com/verify',
    renewalReminderDays: 90,
  },
]

const DEFAULT_WEEKLY_GOAL_MINUTES = 600

interface LearningSettings {
  weeklyGoalMinutes: number
  sessionCategories: string[]
  bookCategories: string[]
}

const DEFAULT_SETTINGS: LearningSettings = {
  weeklyGoalMinutes: DEFAULT_WEEKLY_GOAL_MINUTES,
  sessionCategories: [],
  bookCategories: [],
}

const DEMO_SETTINGS: LearningSettings = {
  weeklyGoalMinutes: DEFAULT_WEEKLY_GOAL_MINUTES,
  sessionCategories: DEMO_SESSION_CATEGORIES,
  bookCategories: [],
}

interface LearningContextType {
  sessions: LearningSession[]
  courses: Course[]
  projects: Project[]
  books: Book[]
  bookCategories: string[]
  sessionCategories: string[]
  certifications: Certification[]
  weeklyGoalMinutes: number
  setWeeklyGoalMinutes: (m: number) => void
  addSession: (s: Omit<LearningSession, 'id'>) => void
  updateSession: (id: string, u: Partial<LearningSession>) => void
  deleteSession: (id: string) => void
  addSessionCategory: (name: string) => void
  removeSessionCategory: (name: string) => void
  addCourse: (c: Omit<Course, 'id'>) => void
  updateCourse: (id: string, u: Partial<Course>) => void
  deleteCourse: (id: string) => void
  addProject: (p: Omit<Project, 'id'>) => void
  updateProject: (id: string, u: Partial<Project>) => void
  deleteProject: (id: string) => void
  addBook: (b: Omit<Book, 'id'>) => void
  updateBook: (id: string, u: Partial<Book>) => void
  deleteBook: (id: string) => void
  addBookCategory: (name: string) => void
  removeBookCategory: (name: string) => void
  addCertification: (c: Omit<Certification, 'id'>) => void
  updateCertification: (id: string, u: Partial<Certification>) => void
  deleteCertification: (id: string) => void
}

const LearningContext = createContext<LearningContextType | null>(null)

/** The API returns null for optional fields; the UI expects undefined. */
function cleanNulls<T>(row: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    out[k] = v === null ? undefined : v
  }
  return out as T
}

interface ResourceApi<T extends { id: string }> {
  getAll: () => Promise<T[]>
  create: (data: Omit<T, 'id'>) => Promise<T>
  update: (id: string, data: Partial<Omit<T, 'id'>>) => Promise<T>
  delete: (id: string) => Promise<unknown>
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const { isDemoMode, user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  const scope = userId || 'demo'
  const queryEnabled = useAuthenticatedQueryEnabled() && !!userId
  const enabled = isDemoMode || queryEnabled

  function useList<T extends { id: string }>(key: QueryKey, demoData: T[], resource: ResourceApi<T>): T[] {
    const { data } = useQuery({
      queryKey: key,
      queryFn: isDemoMode
        ? () => demoData
        : () => resource.getAll().then((rows) => rows.map(cleanNulls)),
      enabled,
      staleTime: isDemoMode ? Infinity : undefined,
      gcTime: isDemoMode ? Infinity : undefined,
    })
    return data ?? []
  }

  function makeCrud<T extends { id: string }>(key: QueryKey, resource: ResourceApi<T>) {
    const setList = (updater: (prev: T[]) => T[]) =>
      queryClient.setQueryData<T[]>(key, (old) => updater(old ?? []))

    const add = (data: Omit<T, 'id'>) => {
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setList((prev) => [...prev, { ...(data as object), id: tempId } as T])
      if (isDemoMode) return
      resource
        .create(data)
        .then((created) => {
          const row = cleanNulls(created)
          setList((prev) => prev.map((x) => (x.id === tempId ? row : x)))
        })
        .catch(() => queryClient.invalidateQueries({ queryKey: key }))
    }

    const update = (id: string, u: Partial<Omit<T, 'id'>>) => {
      setList((prev) => prev.map((x) => (x.id === id ? { ...x, ...u } : x)))
      if (isDemoMode || id.startsWith('tmp-')) return
      resource
        .update(id, u)
        .then((updated) => {
          const row = cleanNulls(updated)
          setList((prev) => prev.map((x) => (x.id === id ? row : x)))
        })
        .catch(() => queryClient.invalidateQueries({ queryKey: key }))
    }

    const remove = (id: string) => {
      setList((prev) => prev.filter((x) => x.id !== id))
      if (isDemoMode || id.startsWith('tmp-')) return
      resource.delete(id).catch(() => queryClient.invalidateQueries({ queryKey: key }))
    }

    return { add, update, remove }
  }

  const sessionsKey = queryKeys.learningSessions(scope)
  const coursesKey = queryKeys.learningCourses(scope)
  const projectsKey = queryKeys.learningProjects(scope)
  const booksKey = queryKeys.learningBooks(scope)
  const certsKey = queryKeys.learningCertifications(scope)
  const settingsKey = queryKeys.learningSettings(scope)

  const sessions = useList<LearningSession>(sessionsKey, DEMO_SESSIONS, learningApi.sessions)
  const courses = useList<Course>(coursesKey, DEMO_COURSES, learningApi.courses)
  const projects = useList<Project>(projectsKey, DEMO_PROJECTS, learningApi.projects)
  const books = useList<Book>(booksKey, DEMO_BOOKS, learningApi.books)
  const certifications = useList<Certification>(certsKey, DEMO_CERTIFICATES, learningApi.certifications)

  const { data: settingsData } = useQuery({
    queryKey: settingsKey,
    queryFn: isDemoMode ? () => DEMO_SETTINGS : () => learningApi.getSettings(),
    enabled,
    staleTime: isDemoMode ? Infinity : undefined,
    gcTime: isDemoMode ? Infinity : undefined,
  })
  const settings = settingsData ?? (isDemoMode ? DEMO_SETTINGS : DEFAULT_SETTINGS)

  const sessionsCrud = makeCrud<LearningSession>(sessionsKey, learningApi.sessions)
  const coursesCrud = makeCrud<Course>(coursesKey, learningApi.courses)
  const projectsCrud = makeCrud<Project>(projectsKey, learningApi.projects)
  const booksCrud = makeCrud<Book>(booksKey, learningApi.books)
  const certsCrud = makeCrud<Certification>(certsKey, learningApi.certifications)

  const patchSettings = (patch: Partial<LearningSettings>) => {
    queryClient.setQueryData<LearningSettings>(settingsKey, (old) => ({
      ...(old ?? DEFAULT_SETTINGS),
      ...patch,
    }))
    if (isDemoMode) return
    learningApi.updateSettings(patch).catch(() => queryClient.invalidateQueries({ queryKey: settingsKey }))
  }

  const setWeeklyGoalMinutes = (m: number) => patchSettings({ weeklyGoalMinutes: Math.max(30, m) })

  const addSessionCategory = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || settings.sessionCategories.includes(trimmed)) return
    patchSettings({
      sessionCategories: [...settings.sessionCategories, trimmed].sort((a, b) => a.localeCompare(b)),
    })
  }
  const removeSessionCategory = (name: string) =>
    patchSettings({ sessionCategories: settings.sessionCategories.filter((c) => c !== name) })

  const addBookCategory = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || settings.bookCategories.includes(trimmed)) return
    patchSettings({
      bookCategories: [...settings.bookCategories, trimmed].sort((a, b) => a.localeCompare(b)),
    })
  }
  const removeBookCategory = (name: string) =>
    patchSettings({ bookCategories: settings.bookCategories.filter((c) => c !== name) })

  return (
    <LearningContext.Provider
      value={{
        sessions,
        courses,
        projects,
        books,
        bookCategories: settings.bookCategories,
        sessionCategories: settings.sessionCategories,
        certifications,
        weeklyGoalMinutes: settings.weeklyGoalMinutes,
        setWeeklyGoalMinutes,
        addSession: sessionsCrud.add,
        updateSession: sessionsCrud.update,
        deleteSession: sessionsCrud.remove,
        addSessionCategory,
        removeSessionCategory,
        addCourse: coursesCrud.add,
        updateCourse: coursesCrud.update,
        deleteCourse: coursesCrud.remove,
        addProject: projectsCrud.add,
        updateProject: projectsCrud.update,
        deleteProject: projectsCrud.remove,
        addBook: booksCrud.add,
        updateBook: booksCrud.update,
        deleteBook: booksCrud.remove,
        addBookCategory,
        removeBookCategory,
        addCertification: certsCrud.add,
        updateCertification: certsCrud.update,
        deleteCertification: certsCrud.remove,
      }}
    >
      {children}
    </LearningContext.Provider>
  )
}

export function useLearning() {
  return useContext(LearningContext)
}
