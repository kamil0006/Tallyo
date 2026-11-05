import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Wallet,
  CheckSquare,
  Calendar as CalendarIcon,
  Target,
  GraduationCap,
  StickyNote,
  LogOut,
  HelpCircle,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useGlobalSearch } from '../context/GlobalSearchContext'
import { useOnboarding } from '../context/OnboardingContext'
import { useSettings } from '../context/SettingsContext'
import { Tooltip } from './Tooltip'

const navSections = [
  {
    labelKey: null,
    items: [{ to: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' }],
  },
  {
    labelKey: 'sectionOrganization',
    items: [
      { to: '/calendar', icon: CalendarIcon, labelKey: 'calendar' },
      { to: '/todo', icon: CheckSquare, labelKey: 'todo' },
      { to: '/notes', icon: StickyNote, labelKey: 'notes' },
    ],
  },
  {
    labelKey: 'sectionFinances',
    items: [{ to: '/finances', icon: Wallet, labelKey: 'finances' }],
  },
  {
    labelKey: 'sectionDevelopment',
    items: [
      { to: '/habits', icon: Target, labelKey: 'habits' },
      { to: '/learning', icon: GraduationCap, labelKey: 'learning' },
    ],
  },
] as const

export type AppNavPanelProps = {
  /** Called after navigating (e.g. closing the mobile menu). */
  onNavigate?: () => void
  /** When set, shows the X button (mobile drawer only). */
  mobileClose?: () => void
}

export function AppNavPanel({ onNavigate, mobileClose }: AppNavPanelProps) {
  const { t } = useTranslation('nav')
  const { user, logout, isDemoMode } = useAuth()
  const { open: openSearch } = useGlobalSearch()
  const { open: openOnboarding } = useOnboarding()
  const { open: openSettings } = useSettings()
  const navigate = useNavigate()

  const handleLogout = async () => {
    onNavigate?.()
    await logout()
    navigate('/login')
  }

  return (
    <>
      <div className="p-6 border-b border-(--border)">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              to="/dashboard"
              onClick={() => onNavigate?.()}
              className="block text-xl font-bold tracking-widest font-display hover:opacity-90 transition-opacity outline-none focus:outline-none"
              title={t('homeAria')}
            >
              <span className="text-(--accent)">Tally</span>
              <span className="text-(--text-primary)">o</span>
            </Link>
            <p className="text-sm text-(--text-muted) mt-1 font-mono tracking-wider">{t('version')}</p>
            <div className="mt-2 grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
              <Tooltip content={t('tutorialTooltip')} align="start">
                <button
                  type="button"
                  onClick={() => {
                    openOnboarding()
                    onNavigate?.()
                  }}
                  className="grid size-11 place-items-center rounded-lg border border-(--border) bg-(--bg-dark) p-0 text-(--text-muted) transition-colors hover:border-(--accent)/50 hover:text-(--accent)"
                  aria-label={t('tutorialAria')}
                >
                  <HelpCircle
                    className="size-[18px] shrink-0 text-current [stroke-linecap:round] [stroke-linejoin:round]"
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              </Tooltip>
              <Tooltip content={t('searchTooltip')} wrapperClassName="min-w-0 w-full">
                <button
                  type="button"
                  onClick={() => {
                    openSearch()
                    onNavigate?.()
                  }}
                  className="flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-(--border) bg-(--bg-dark) px-3 py-2.5 text-sm font-display text-(--text-muted) transition-colors hover:border-(--accent)/50 hover:text-(--accent)"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t('search')}</span>
                </button>
              </Tooltip>
            </div>
          </div>
          {mobileClose && (
            <button
              type="button"
              onClick={mobileClose}
              className="lg:hidden shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-muted) transition-colors hover:border-(--accent)/50 hover:text-(--accent)"
              aria-label={t('closeMenuAria')}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      <nav className="scrollbar-hidden min-h-0 flex-1 space-y-7 overflow-y-auto overflow-x-hidden p-5">
        {navSections.map((section) => (
          <div key={section.labelKey ?? 'dashboard'}>
            {section.labelKey && (
              <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                {t(section.labelKey)}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => onNavigate?.()}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-lg border px-4 py-3 outline-none transition-[background-color,color,border-color,box-shadow] duration-200 ease-out focus:outline-none ${
                      isActive
                        ? 'border border-(--accent)/40 bg-(--accent)/10 text-(--accent)'
                        : 'border-transparent text-(--text-muted) hover:bg-(--bg-card-hover) hover:text-(--text-primary)'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="font-medium tracking-wide">{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-(--border) p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Tooltip content={t('settingsTooltip')} align="start">
          <button
            type="button"
            onClick={() => {
              openSettings()
              onNavigate?.()
            }}
            className="grid size-11 place-items-center rounded-lg border border-(--border) bg-(--bg-dark) p-0 text-(--text-muted) transition-colors hover:border-(--accent)/50 hover:text-(--accent)"
            aria-label={t('settingsAria')}
          >
            <Settings className="size-[18px] shrink-0 text-current [stroke-linecap:round] [stroke-linejoin:round]" strokeWidth={2} aria-hidden />
          </button>
        </Tooltip>
        {isDemoMode ? (
          <>
            <p className="text-sm text-(--text-muted) font-mono">{t('demoLabel')}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-[44px] items-center gap-2 text-sm text-(--text-muted) transition-colors hover:text-(--accent)"
            >
              <LogOut className="h-3 w-3" />
              {t('exitDemo')}
            </button>
          </>
        ) : (
          <>
            <p className="truncate text-sm text-(--text-muted)" title={user?.email}>
              {user?.email}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-[44px] items-center gap-2 text-sm text-(--text-muted) transition-colors hover:text-(--accent)"
            >
              <LogOut className="h-3 w-3" />
              {t('logout')}
            </button>
          </>
        )}
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="relative hidden h-full min-h-0 w-64 shrink-0 overflow-hidden border-r border-(--border) bg-(--bg-card)/95 lg:flex lg:flex-col">
      <div className="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-(--accent)/50 to-transparent" />
      <AppNavPanel />
    </aside>
  )
}
