import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Card } from '../Card'
import { dashboardSectionStaggerVariants, getDashboardTileVariants } from '../../lib/dashboardMotion'
import { formatNumberPl } from '../../lib/currency'

function formatEventDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export type DashboardQuickStatsProps = {
  upcomingEvents: { id: string; title: string; date: string; time?: string; color?: string }[]
  todoCount: number
  goals: { id: string; name: string; target: number; current: number; unit?: string }[]
  habitsToday: { done: number; total: number }
  reduceMotion: boolean | null
}

const TILE_BASE = 6

export function DashboardQuickStats({
  upcomingEvents,
  todoCount,
  goals,
  habitsToday,
  reduceMotion,
}: DashboardQuickStatsProps) {
  const { t, i18n } = useTranslation('dashboard')
  const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'
  return (
    <motion.div
      variants={dashboardSectionStaggerVariants}
      className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6 items-stretch"
    >
      <motion.div variants={getDashboardTileVariants(reduceMotion, TILE_BASE + 0)} className="min-w-0 flex">
        <Card title={t('upcomingEvents')} className="border-(--accent)/20 p-3 flex flex-col h-full w-full" animateEntrance={false}>
          <div className="flex-1 min-h-0">
            {upcomingEvents.length > 0 ? (
              <ul className="space-y-1.5">
                {upcomingEvents.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: ev.color ?? 'var(--accent)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <Link
                        to="/calendar"
                        className="text-sm text-(--text-primary) hover:text-(--accent) transition-colors truncate block outline-none focus:outline-none"
                      >
                        {ev.title}
                      </Link>
                      <p className="text-xs text-(--text-muted) font-mono">
                        {formatEventDate(ev.date, locale)} {ev.time && `• ${ev.time}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-(--text-muted) text-sm">{t('noUpcomingEvents')}</p>
            )}
          </div>
          <Link
            to="/calendar"
            className="mt-auto pt-2 inline-block text-sm text-(--accent) hover:underline outline-none focus:outline-none"
          >
            {t('viewCalendar')}
          </Link>
        </Card>
      </motion.div>
      <motion.div variants={getDashboardTileVariants(reduceMotion, TILE_BASE + 1)} className="min-w-0 flex">
        <Card title={t('todoTitle')} className="border-(--warning)/20 p-3 flex flex-col h-full w-full" animateEntrance={false}>
          <div className="flex-1 min-h-0">
            <p className="text-xl sm:text-2xl font-bold text-(--warning) font-display">{todoCount}</p>
            <p className="text-xs sm:text-sm text-(--text-muted) mt-1">{t('activeTasks')}</p>
          </div>
          <Link
            to="/todo"
            className="mt-auto pt-2 inline-block text-sm text-(--accent) hover:underline outline-none focus:outline-none"
          >
            {t('viewTodo')}
          </Link>
        </Card>
      </motion.div>
      <motion.div variants={getDashboardTileVariants(reduceMotion, TILE_BASE + 2)} className="min-w-0 flex">
        <Card title={t('activeGoals')} className="border-(--accent)/20 p-3 flex flex-col h-full w-full" animateEntrance={false}>
          <div className="flex-1 min-h-0">
            {goals.length > 0 ? (
              <div className="space-y-2">
                {goals.slice(0, 3).map((g) => {
                  const pct = Math.min(100, (g.current / g.target) * 100)
                  return (
                    <div key={g.id} className="space-y-1">
                      <p className="text-sm text-(--text-primary) truncate font-medium">{g.name}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-(--bg-card) overflow-hidden">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-(--accent) to-(--positive) transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-(--text-muted) shrink-0 font-mono">
                          {formatNumberPl(g.current)}/{formatNumberPl(g.target)} {g.unit ?? ''}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-(--text-muted) text-sm">{t('noActiveGoals')}</p>
            )}
          </div>
          <Link
            to="/habits"
            className="mt-auto pt-2 inline-block text-sm text-(--accent) hover:underline outline-none focus:outline-none"
          >
            {goals.length > 0 ? t('viewGoals') : t('addGoal')}
          </Link>
        </Card>
      </motion.div>
      <motion.div variants={getDashboardTileVariants(reduceMotion, TILE_BASE + 3)} className="min-w-0 flex">
        <Card title={t('habitsToday')} className="border-(--positive)/20 p-3 flex flex-col h-full w-full" animateEntrance={false}>
          <div className="flex-1 min-h-0">
            {habitsToday.total > 0 ? (
              <>
                <p className="text-xl sm:text-2xl font-bold text-(--positive) font-display">
                  {habitsToday.done}/{habitsToday.total}
                </p>
                <p className="text-xs sm:text-sm text-(--text-muted) mt-1">{t('checkedOffToday')}</p>
                <div className="mt-2 h-1.5 rounded-full bg-(--bg-dark) overflow-hidden">
                  <div
                    className="h-full rounded-full bg-(--positive) transition-all"
                    style={{ width: `${habitsToday.total > 0 ? (habitsToday.done / habitsToday.total) * 100 : 0}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-(--text-muted) text-sm">{t('noHabits')}</p>
            )}
          </div>
          <Link
            to="/habits"
            className="mt-auto pt-2 inline-block text-sm text-(--accent) hover:underline outline-none focus:outline-none"
          >
            {t('viewHabits')}
          </Link>
        </Card>
      </motion.div>
    </motion.div>
  )
}
