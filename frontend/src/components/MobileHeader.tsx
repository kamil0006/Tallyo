import { Menu, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGlobalSearch } from '../context/GlobalSearchContext'

type MobileHeaderProps = {
  onMenuClick: () => void
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { t } = useTranslation('nav')
  const { open: openSearch } = useGlobalSearch()

  return (
    <header
      className="mobile-header-bar lg:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-2 border-b border-(--border) bg-(--bg-card)/95 backdrop-blur-md"
      role="banner"
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-primary) hover:border-(--accent)/50 hover:text-(--accent) transition-colors"
        aria-label={t('openMenuAria')}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <Link
        to="/dashboard"
        className="min-w-0 font-display text-lg font-bold tracking-widest outline-none focus:outline-none"
      >
        <span className="text-(--accent)">Tally</span>
        <span className="text-(--text-primary)">o</span>
      </Link>
      <button
        type="button"
        onClick={openSearch}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-(--border) bg-(--bg-dark) text-(--text-muted) hover:border-(--accent)/50 hover:text-(--accent) transition-colors"
        aria-label={t('searchAria')}
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>
    </header>
  )
}
