import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { expenseCategoriesApi } from '../lib/api'
import { capitalizeFirstPl } from '../lib/capitalizeFirst'
import {
  BUILTIN_EXPENSE_CATEGORY_ID_PREFIX,
  EXPENSE_CATEGORY_DISPLAY_NONE,
} from '../lib/expenseCategoryConstants'
import { FINANCE_CATEGORIES } from '../lib/financeCategories'
import { queryKeys } from '../lib/queryKeys'

export interface FinanceCategory {
  id: string
  label: string
  name: string
  color: string
}

const DEMO_STORAGE_KEY = 'tallyo_demo_categories'
const HIDDEN_BUILTIN_STORAGE_PREFIX = 'tallyo_fin_hidden_builtin:'

/** Names of the default expense categories (same as seed) — filtered out of `loaded` during merge. */
const DEFAULT_EXPENSE_NAMES_LOWER = new Set(
  FINANCE_CATEGORIES.filter((c) => c.id !== 'Dochód').map((c) => c.id.toLowerCase())
)

function hiddenBuiltinStorageKey(userId: string) {
  return `${HIDDEN_BUILTIN_STORAGE_PREFIX}${userId || 'anon'}`
}

function readHiddenBuiltinSet(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(hiddenBuiltinStorageKey(userId))
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.map((x) => String(x).toLowerCase()))
  } catch {
    return new Set()
  }
}

function writeHiddenBuiltinSet(userId: string, set: Set<string>) {
  localStorage.setItem(hiddenBuiltinStorageKey(userId), JSON.stringify([...set]))
}

/** Saves the default set (like on first start) and returns objects for React Query. */
function resetDemoCategoriesStorageToDefaults(): FinanceCategory[] {
  const rows = FINANCE_CATEGORIES.filter((c) => c.id !== 'Dochód').map((c) => ({
    name: c.id,
    color: c.color,
  }))
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(rows))
  return rows.map((c, i) => ({
    id: `demo-${i}-${c.name}`,
    label: c.name,
    name: c.name,
    color: c.color,
  }))
}

function loadDemoCategories(): FinanceCategory[] {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    if (!raw) {
      return resetDemoCategoriesStorageToDefaults()
    }
    const parsed = JSON.parse(raw) as { name: string; color: string }[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return resetDemoCategoriesStorageToDefaults()
    }
    return parsed.map((c, i) => ({
      id: `demo-${i}-${c.name}`,
      label: c.name,
      name: c.name,
      color: c.color,
    }))
  } catch {
    return resetDemoCategoriesStorageToDefaults()
  }
}

function saveDemoCategories(cats: FinanceCategory[]) {
  localStorage.setItem(
    DEMO_STORAGE_KEY,
    JSON.stringify(cats.map((c) => ({ name: c.name, color: c.color })))
  )
}

function mapApiCategories(
  data: { id: string; name: string; color: string }[]
): FinanceCategory[] {
  return data.map((c) => ({
    id: c.id,
    label: c.name,
    name: c.name,
    color: c.color,
  }))
}

function builtInExpenseCategories(): FinanceCategory[] {
  return FINANCE_CATEGORIES.filter((c) => c.id !== 'Dochód').map((c) => ({
    id: `${BUILTIN_EXPENSE_CATEGORY_ID_PREFIX}${c.id}`,
    label: c.label,
    name: c.id,
    color: c.color,
  }))
}

/**
 * Default categories (same as seed); API entries override matching names.
 * `hidden` — names deleted by the user (not shown even as fallback).
 */
function mergeLoadedWithBuiltIn(loaded: FinanceCategory[], hidden: Set<string>): FinanceCategory[] {
  const mergedBase: FinanceCategory[] = []
  for (const b of builtInExpenseCategories()) {
    const ln = b.name.toLowerCase()
    if (hidden.has(ln)) continue
    const fromStore = loaded.find((l) => l.name.toLowerCase() === ln)
    mergedBase.push(fromStore ?? b)
  }
  const extra = loaded.filter((l) => {
    const ln = l.name.toLowerCase()
    if (hidden.has(ln)) return false
    if (DEFAULT_EXPENSE_NAMES_LOWER.has(ln)) return false
    return true
  })
  extra.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
  return [...mergedBase, ...extra]
}

export function useFinanceCategories() {
  const { isDemoMode, user, isLoggedIn, sessionReady } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  /** API only with a cookie session and outside demo mode (demo always uses localStorage). */
  const fetchFromApi = sessionReady && isLoggedIn && !isDemoMode
  const key = queryKeys.expenseCategories(userId)

  const [hiddenBuiltinLower, setHiddenBuiltinLower] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    setHiddenBuiltinLower(readHiddenBuiltinSet(userId))
  }, [userId])

  const hideBuiltinName = useCallback(
    (nameLower: string) => {
      if (!nameLower) return
      setHiddenBuiltinLower((prev) => {
        const next = new Set(prev)
        next.add(nameLower)
        writeHiddenBuiltinSet(userId, next)
        return next
      })
    },
    [userId]
  )

  const unhideBuiltinName = useCallback(
    (nameLower: string) => {
      if (!nameLower) return
      setHiddenBuiltinLower((prev) => {
        if (!prev.has(nameLower)) return prev
        const next = new Set(prev)
        next.delete(nameLower)
        writeHiddenBuiltinSet(userId, next)
        return next
      })
    },
    [userId]
  )

  const { data: customCategories = [], isPending } = useQuery({
    queryKey: key,
    queryFn: fetchFromApi
      ? () => expenseCategoriesApi.getAll().then(mapApiCategories)
      : () => Promise.resolve(loadDemoCategories()),
    enabled: true,
    staleTime: isDemoMode && !fetchFromApi ? Infinity : undefined,
    gcTime: isDemoMode && !fetchFromApi ? Infinity : undefined,
  })

  const isLoading = fetchFromApi && isPending
  const categories = useMemo(
    () => mergeLoadedWithBuiltIn(customCategories, hiddenBuiltinLower),
    [customCategories, hiddenBuiltinLower]
  )

  const getColor = useCallback(
    (categoryName: string): string => {
      if (!categoryName?.trim()) return '#6b6b8a'
      const lower = categoryName.toLowerCase()
      const cat = categories.find(
        (c) =>
          c.name.toLowerCase() === lower ||
          c.id.toLowerCase() === lower ||
          c.label.toLowerCase() === lower
      )
      return cat?.color ?? '#6b6b8a'
    },
    [categories]
  )

  const getLabel = useCallback(
    (categoryNameOrId: string): string => {
      if (!categoryNameOrId?.trim()) return EXPENSE_CATEGORY_DISPLAY_NONE
      const cat = categories.find((c) => c.name === categoryNameOrId || c.id === categoryNameOrId)
      if (cat) return capitalizeFirstPl(cat.label)
      return EXPENSE_CATEGORY_DISPLAY_NONE
    },
    [categories]
  )

  const addCategory = async (name: string, color: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const normalized = capitalizeFirstPl(trimmed)
    if (categories.some((c) => c.name.toLowerCase() === normalized.toLowerCase())) return

    if (fetchFromApi) {
      await expenseCategoriesApi.create({ name: normalized, color })
      unhideBuiltinName(normalized.toLowerCase())
      queryClient.invalidateQueries({ queryKey: key })
    } else {
      unhideBuiltinName(normalized.toLowerCase())
      const prev = loadDemoCategories()
      const newCat: FinanceCategory = {
        id: `demo-${Date.now()}-${normalized}`,
        label: normalized,
        name: normalized,
        color,
      }
      const updated = [...prev, newCat]
      saveDemoCategories(updated)
      await queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const deleteCategory = async (id: string) => {
    if (id.startsWith(BUILTIN_EXPENSE_CATEGORY_ID_PREFIX)) {
      const raw = id.slice(BUILTIN_EXPENSE_CATEGORY_ID_PREFIX.length).trim()
      if (raw) hideBuiltinName(raw.toLowerCase())
      return
    }

    if (fetchFromApi) {
      const victim = customCategories.find((c) => c.id === id)
      const nameLower = (victim?.name ?? '').toLowerCase()
      await expenseCategoriesApi.delete(id)
      if (nameLower) hideBuiltinName(nameLower)
      queryClient.invalidateQueries({ queryKey: key })
    } else {
      const prev = loadDemoCategories()
      const victimDemo = prev.find((c) => c.id === id)
      const nameLower = (victimDemo?.name ?? '').toLowerCase()
      const updated = prev.filter((c) => c.id !== id)
      if (nameLower) hideBuiltinName(nameLower)
      if (updated.length === 0) {
        resetDemoCategoriesStorageToDefaults()
      } else {
        saveDemoCategories(updated)
      }
      await queryClient.invalidateQueries({ queryKey: key })
    }
  }

  return {
    categories,
    /** @deprecated alias — all categories are "custom"; use `categories`. */
    customCategories: categories,
    getColor,
    getLabel,
    addCategory,
    deleteCategory,
    isLoading,
  }
}
