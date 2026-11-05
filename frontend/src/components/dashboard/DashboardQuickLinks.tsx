import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { StickyNote, Calendar, GraduationCap, Target } from 'lucide-react'
import { dashboardSectionStaggerVariants, getDashboardTileVariants } from '../../lib/dashboardMotion'

export type DashboardQuickLinksProps = {
  notesCount: number
  habitsCount: number
  reduceMotion: boolean | null
}

const LINK_BASE = 11

const linkShell =
  'group relative rounded-lg border border-(--border) bg-(--bg-card) p-5 transition-[border-color,box-shadow] duration-200 ease-out hover:border-(--accent)/40 overflow-hidden block h-full'

export function DashboardQuickLinks({ notesCount, habitsCount, reduceMotion }: DashboardQuickLinksProps) {
  const { t } = useTranslation('dashboard')
  return (
    <motion.div
      variants={dashboardSectionStaggerVariants}
      className="grid grid-cols-2 md:grid-cols-4 gap-6"
    >
      <motion.div variants={getDashboardTileVariants(reduceMotion, LINK_BASE + 0)} className="h-full min-w-0">
        <Link to="/notes" className={linkShell}>
          <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--accent)/40 to-transparent" />
          <StickyNote className="w-8 h-8 text-(--accent) mb-2 group-" />
          <p className="text-base font-semibold text-(--text-primary) font-display">{t('linkNotes')}</p>
          <p className="text-sm text-(--text-muted) mt-0.5">{t('notesCount', { count: notesCount })}</p>
        </Link>
      </motion.div>
      <motion.div variants={getDashboardTileVariants(reduceMotion, LINK_BASE + 1)} className="h-full min-w-0">
        <Link to="/calendar" className={linkShell}>
          <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--accent)/40 to-transparent" />
          <Calendar className="w-8 h-8 text-(--accent) mb-2 group-" />
          <p className="text-base font-semibold text-(--text-primary) font-display">{t('linkCalendar')}</p>
          <p className="text-sm text-(--text-muted) mt-0.5">{t('linkCalendarDesc')}</p>
        </Link>
      </motion.div>
      <motion.div variants={getDashboardTileVariants(reduceMotion, LINK_BASE + 2)} className="h-full min-w-0">
        <Link to="/learning" className={linkShell}>
          <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--accent)/40 to-transparent" />
          <GraduationCap className="w-8 h-8 text-(--accent) mb-2 group-" />
          <p className="text-base font-semibold text-(--text-primary) font-display">{t('linkLearning')}</p>
          <p className="text-sm text-(--text-muted) mt-0.5">{t('linkLearningDesc')}</p>
        </Link>
      </motion.div>
      <motion.div variants={getDashboardTileVariants(reduceMotion, LINK_BASE + 3)} className="h-full min-w-0">
        <Link to="/habits" className={linkShell}>
          <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--accent)/40 to-transparent" />
          <Target className="w-8 h-8 text-(--accent) mb-2 group-" />
          <p className="text-base font-semibold text-(--text-primary) font-display">{t('linkHabits')}</p>
          <p className="text-sm text-(--text-muted) mt-0.5">{t('habitsCount', { count: habitsCount })}</p>
        </Link>
      </motion.div>
    </motion.div>
  )
}
