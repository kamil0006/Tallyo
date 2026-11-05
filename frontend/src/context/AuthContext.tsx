import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { queryClient } from '../lib/queryClient'
import { authApi, type AuthUser } from '../lib/api/authApi'
import { onApiAuthEvent } from '../lib/api/client'

const DEMO_SESSION_KEY = 'tallyo_demo_session'
const LEGACY_TOKEN_KEY = 'lifeos_token'
const LEGACY_USER_KEY = 'lifeos_user'

interface AuthContextType {
  user: AuthUser | null
  sessionReady: boolean
  isLoggedIn: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
  enterDemoMode: () => void
  isDemoMode: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const ENV_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

function clearLegacyAuthStorage() {
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  localStorage.removeItem(LEGACY_USER_KEY)
  sessionStorage.removeItem(LEGACY_TOKEN_KEY)
  sessionStorage.removeItem(LEGACY_USER_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [demoSession, setDemoSession] = useState(() => localStorage.getItem(DEMO_SESSION_KEY) === 'true')

  const isLoggedIn = Boolean(user && user.id !== 'demo')
  const isDemoMode = Boolean((ENV_DEMO_MODE || demoSession) && !isLoggedIn)

  useEffect(() => {
    clearLegacyAuthStorage()

    if (localStorage.getItem(DEMO_SESSION_KEY) === 'true') {
      setUser({ id: 'demo', email: 'demo@tallyo.app' })
      setSessionReady(true)
      return
    }

    let cancelled = false
    authApi
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return onApiAuthEvent((event) => {
      if (event === 'session-expired') {
        queryClient.clear()
        setUser(null)
        setDemoSession(false)
        localStorage.removeItem(DEMO_SESSION_KEY)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    })
  }, [])

  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem(DEMO_SESSION_KEY, 'true')
    } else if (sessionReady && !user) {
      localStorage.removeItem(DEMO_SESSION_KEY)
    }
  }, [isDemoMode, sessionReady, user])

  const login = async (email: string, password: string, rememberMe = true) => {
    clearLegacyAuthStorage()
    localStorage.removeItem(DEMO_SESSION_KEY)
    const { user: u } = await authApi.login(email, password, rememberMe)
    queryClient.clear()
    setDemoSession(false)
    setUser(u)
    setSessionReady(true)
  }

  const register = async (email: string, password: string, rememberMe = true) => {
    clearLegacyAuthStorage()
    localStorage.removeItem(DEMO_SESSION_KEY)
    const { user: u } = await authApi.register(email, password, rememberMe)
    queryClient.clear()
    setDemoSession(false)
    setUser(u)
    setSessionReady(true)
  }

  const enterDemoMode = () => {
    queryClient.clear()
    clearLegacyAuthStorage()
    setUser({ id: 'demo', email: 'demo@tallyo.app' })
    setDemoSession(true)
    setSessionReady(true)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // the cookie may have expired — we clear local state regardless
    }
    queryClient.clear()
    setUser(null)
    setDemoSession(false)
    localStorage.removeItem(DEMO_SESSION_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionReady,
        isLoggedIn,
        login,
        register,
        logout,
        enterDemoMode,
        isDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
