import { createContext, useContext, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { notesApi } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuthenticatedQueryEnabled } from '../hooks/useAuthenticatedQueryEnabled'
import {
  type Note,
  type NoteType,
  type IdeaStatus,
  type ReferenceKind,
  type NoteCreateInput,
  normalizeNoteFromStorage,
  normalizeNotesArray,
  createNotePayloadFromInput,
} from '../lib/notesModel'

export type { Note, NoteType, IdeaStatus, ReferenceKind, NoteCreateInput }

export type NoteUpdate = Partial<
  Pick<
    Note,
    | 'content'
    | 'tags'
    | 'type'
    | 'title'
    | 'pinned'
    | 'archivedAt'
    | 'ideaStatus'
    | 'referenceKind'
    | 'referenceUrl'
    | 'referenceSource'
  >
>

interface NotesContextType {
  notes: Note[]
  addNote: (n: NoteCreateInput) => void
  updateNote: (id: string, u: NoteUpdate) => void
  archiveNote: (id: string) => void
  restoreNote: (id: string) => void
  deleteNotePermanently: (id: string) => void
  togglePin: (id: string) => void
}

const NotesContext = createContext<NotesContextType | null>(null)

/** Demo timestamps relative to now (n days ago), so the demo never looks stale. */
const demoTimestamp = (daysBack: number) => new Date(Date.now() - daysBack * 86400000).toISOString()

const DEMO_NOTES: Note[] = normalizeNotesArray([
  {
    id: '1',
    type: 'inbox',
    content: '**Spotkanie** o 15:00 – przygotować prezentację.\n\n- Slajdy 1–5\n- Demo',
    tags: ['spotkanie', 'prezentacja'],
    createdAt: demoTimestamp(0),
    updatedAt: demoTimestamp(0),
  },
  {
    id: '2',
    type: 'idea',
    content: '## Pomysł: aplikacja do śledzenia nawyków\n\nIntegracja z kalendarzem i przypomnieniami.',
    tags: ['pomysł', 'app'],
    createdAt: demoTimestamp(1),
    updatedAt: demoTimestamp(1),
    ideaStatus: 'nowy',
  },
  {
    id: '3',
    type: 'reference',
    content: '[React docs](https://react.dev) – hooks, useEffect, useMemo',
    tags: ['react', 'docs'],
    createdAt: demoTimestamp(3),
    updatedAt: demoTimestamp(3),
    referenceKind: 'link',
    referenceUrl: 'https://react.dev',
  },
])

function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const { isDemoMode, user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  const queryEnabled = useAuthenticatedQueryEnabled() && !!userId
  const key = queryKeys.notes(userId || 'demo')

  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: isDemoMode
      ? () => sortNotes(DEMO_NOTES)
      : () => notesApi.getAll().then((rows) => sortNotes(normalizeNotesArray(rows))),
    enabled: isDemoMode || queryEnabled,
    staleTime: isDemoMode ? Infinity : undefined,
    gcTime: isDemoMode ? Infinity : undefined,
  })

  const setNotes = (updater: (prev: Note[]) => Note[]) => {
    queryClient.setQueryData<Note[]>(key, (old) => sortNotes(updater(old ?? [])))
  }

  const addNote = (n: NoteCreateInput) => {
    const now = new Date().toISOString()
    const payload = createNotePayloadFromInput(n)
    const tempId = `tmp-${Date.now()}`
    const optimistic: Note = { ...payload, id: tempId, createdAt: now, updatedAt: now }
    setNotes((prev) => [optimistic, ...prev])

    if (isDemoMode) return

    notesApi
      .create({
        type: payload.type,
        content: payload.content,
        tags: payload.tags,
        title: payload.title,
        pinned: payload.pinned,
        archivedAt: payload.archivedAt,
        ideaStatus: payload.ideaStatus,
        referenceKind: payload.referenceKind,
        referenceUrl: payload.referenceUrl,
        referenceSource: payload.referenceSource,
      })
      .then((created) => {
        const normalized = normalizeNoteFromStorage(created)
        if (!normalized) return
        setNotes((prev) => prev.map((x) => (x.id === tempId ? normalized : x)))
      })
      .catch(() => queryClient.invalidateQueries({ queryKey: key }))
  }

  const applyLocalUpdate = (id: string, u: NoteUpdate, now: string) => {
    setNotes((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x
        const next = { ...x, ...u, updatedAt: now }
        if (u.type !== undefined && u.type !== x.type) {
          if (u.type !== 'idea') next.ideaStatus = 'nowy'
          if (u.type !== 'reference') {
            next.referenceKind = 'link'
            next.referenceUrl = null
            next.referenceSource = null
          }
        }
        return next
      })
    )
  }

  const updateNote = (id: string, u: NoteUpdate) => {
    const now = new Date().toISOString()
    applyLocalUpdate(id, u, now)

    if (isDemoMode || id.startsWith('tmp-')) return

    notesApi
      .update(id, {
        ...(u.type !== undefined && { type: u.type }),
        ...(u.content !== undefined && { content: u.content }),
        ...(u.tags !== undefined && { tags: u.tags }),
        ...(u.title !== undefined && { title: u.title }),
        ...(u.pinned !== undefined && { pinned: u.pinned }),
        ...(u.archivedAt !== undefined && { archivedAt: u.archivedAt }),
        ...(u.ideaStatus !== undefined && { ideaStatus: u.ideaStatus }),
        ...(u.referenceKind !== undefined && { referenceKind: u.referenceKind }),
        ...(u.referenceUrl !== undefined && { referenceUrl: u.referenceUrl }),
        ...(u.referenceSource !== undefined && { referenceSource: u.referenceSource }),
      })
      .then((updated) => {
        const normalized = normalizeNoteFromStorage(updated)
        if (!normalized) return
        setNotes((prev) => prev.map((x) => (x.id === id ? normalized : x)))
      })
      .catch(() => queryClient.invalidateQueries({ queryKey: key }))
  }

  const archiveNote = (id: string) => {
    updateNote(id, { archivedAt: new Date().toISOString() })
  }

  const restoreNote = (id: string) => {
    updateNote(id, { archivedAt: null })
  }

  const deleteNotePermanently = (id: string) => {
    setNotes((prev) => prev.filter((x) => x.id !== id))
    if (isDemoMode || id.startsWith('tmp-')) return
    notesApi.delete(id).catch(() => queryClient.invalidateQueries({ queryKey: key }))
  }

  const togglePin = (id: string) => {
    const current = notes.find((x) => x.id === id)
    if (!current) return
    updateNote(id, { pinned: !current.pinned })
  }

  return (
    <NotesContext.Provider
      value={{
        notes,
        addNote,
        updateNote,
        archiveNote,
        restoreNote,
        deleteNotePermanently,
        togglePin,
      }}
    >
      {children}
    </NotesContext.Provider>
  )
}

export function useNotes() {
  return useContext(NotesContext)
}
