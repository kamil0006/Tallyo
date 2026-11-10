import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Play, Pause, RotateCcw, CheckCircle2, X, Timer } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SESSION_TYPE_OPTIONS } from '../../pages/Learning/learningUtils'
import { usePomodoroTimer, POMODORO_MODES, POMODORO_RING } from '../../hooks/usePomodoroTimer'
import { usePomodoro, formatClock } from '../../context/PomodoroContext'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

const { SIZE, CX, RADIUS, STROKE } = POMODORO_RING

// ─── MODAL (prezentacja) ────────────────────────────────────────────────────────

function PomodoroModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('learning')
  const {
    selectedMinutes,
    isRunning,
    completed,
    started,
    topic,
    setTopic,
    sessionType,
    setSessionType,
    handleModeChange,
    handleReset,
    pause,
    startOrResume,
    progress,
    strokeDashoffset,
    ringColor,
    minutesDisplay,
    secondsDisplay,
    sessionCategories,
    circumference,
  } = usePomodoroTimer()

  // Closing only hides the modal — the timer keeps running in the background.
  const handleClose = onClose

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-9998 bg-black/75 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          className="pointer-events-auto relative w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-card) shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          <div
            className="h-1 w-full transition-colors duration-500"
            style={{ background: ringColor }}
          />

          <div className="p-7">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <Timer className="w-6 h-6 text-(--accent)" />
                <h3 className="text-xl font-bold font-display text-(--text-primary) tracking-wide">
                  {t('pomodoro.title')}
                </h3>
                {isRunning && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-display bg-(--accent)/15 text-(--accent) border border-(--accent)/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-(--accent) animate-pulse" />
                    live
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-dark) transition-colors"
                aria-label={t('pomodoro.closeAria')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-8">
              {POMODORO_MODES.map((m) => (
                <button
                  key={m.minutes}
                  type="button"
                  onClick={() => handleModeChange(m.minutes)}
                  disabled={isRunning}
                  className={`py-2.5 rounded-xl font-display text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                    selectedMinutes === m.minutes
                      ? 'bg-(--accent)/20 text-(--accent) border-2 border-(--accent)/60'
                      : 'bg-(--bg-dark) text-(--text-muted) border-2 border-(--border) hover:border-(--accent)/40 hover:text-(--text-primary) disabled:opacity-35'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex justify-center mb-7">
              <div className="relative" style={{ width: SIZE, height: SIZE }}>
                {isRunning && !completed && (
                  <motion.div
                    animate={{ opacity: [0.35, 0.7, 0.35] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${ringColor}22 0%, transparent 70%)`,
                    }}
                  />
                )}

                <svg
                  width={SIZE}
                  height={SIZE}
                  viewBox={`0 0 ${SIZE} ${SIZE}`}
                  className="-rotate-90"
                >
                  <circle
                    cx={CX}
                    cy={CX}
                    r={RADIUS}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={STROKE}
                  />
                  <circle
                    cx={CX}
                    cy={CX}
                    r={RADIUS}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.4s ease' }}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  {completed ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', damping: 12 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <CheckCircle2
                        className="w-20 h-20"
                        style={{ color: 'var(--positive)' }}
                      />
                      <span className="font-display text-base text-(--positive)">
                        {t('pomodoro.completed')}
                      </span>
                    </motion.div>
                  ) : (
                    <>
                      <span
                        className="font-mono font-black tabular-nums leading-none text-(--text-primary)"
                        style={{ fontSize: '4.5rem', letterSpacing: '-0.02em' }}
                      >
                        {pad(minutesDisplay)}:{pad(secondsDisplay)}
                      </span>
                      <span
                        className="font-display tracking-widest uppercase text-sm"
                        style={{ color: ringColor }}
                      >
                        {isRunning ? t('pomodoro.running') : started ? t('pomodoro.paused') : t('pomodoro.ready')}
                      </span>
                      <span className="text-xs text-(--text-muted) font-mono mt-0.5">
                        {t('pomodoro.remainingPercent', { percent: Math.round(progress * 100) })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {completed ? (
              <div className="text-center space-y-4">
                <p className="text-lg font-display text-(--text-primary)">
                  {t('pomodoro.sessionAdded', { minutes: selectedMinutes })}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 py-3 rounded-xl border-2 border-(--border) text-(--text-muted) font-display font-semibold hover:bg-(--bg-dark) hover:text-(--text-primary) transition-colors"
                  >
                    {t('pomodoro.newSession')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl font-display font-bold text-base hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--positive)', color: 'var(--bg-dark)' }}
                  >
                    {t('pomodoro.close')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t('pomodoro.topicPlaceholder')}
                    className="w-full px-4 py-3 rounded-xl bg-(--bg-dark) border-2 border-(--border) text-(--text-primary) font-display focus:border-(--accent)/60 focus:outline-none transition-colors placeholder:text-(--text-muted)/60"
                  />
                </div>

                {sessionCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {sessionCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTopic((prev) => (prev === cat ? '' : cat))}
                        className={`px-3 py-1.5 rounded-lg font-display text-sm transition-colors border ${
                          topic === cat
                            ? 'bg-(--accent)/20 text-(--accent) border-(--accent)/50'
                            : 'bg-(--bg-dark) text-(--text-muted) border-(--border) hover:border-(--accent)/40 hover:text-(--text-primary)'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-7">
                  {SESSION_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSessionType(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display text-sm transition-colors border ${
                        sessionType === opt.value
                          ? 'bg-(--accent)/20 text-(--accent) border-(--accent)/50'
                          : 'bg-(--bg-dark) text-(--text-muted) border-(--border) hover:border-(--accent)/40 hover:text-(--text-primary)'
                      }`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      {t(`sessionType.${opt.value}`)}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!started}
                    className="flex items-center justify-center w-14 h-14 rounded-xl border-2 border-(--border) text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-dark) transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                    aria-label={t('pomodoro.resetAria')}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={isRunning ? pause : startOrResume}
                    className="flex-1 flex items-center justify-center gap-3 h-14 rounded-xl font-display font-bold text-lg hover:opacity-90 active:scale-[0.98] transition-all"
                    style={{
                      background: isRunning ? 'var(--warning)' : 'var(--accent)',
                      color: 'var(--bg-dark)',
                      boxShadow: isRunning
                        ? '0 0 20px rgba(255,193,7,0.35)'
                        : '0 0 20px rgba(130,167,207,0.35)',
                    }}
                  >
                    {isRunning ? (
                      <>
                        <Pause className="w-6 h-6" />
                        {t('pomodoro.pause')}
                      </>
                    ) : (
                      <>
                        <Play className="w-6 h-6" />
                        {started ? t('pomodoro.resume') : t('pomodoro.start')}
                      </>
                    )}
                  </button>
                </div>
                {started && (
                  <p className="mt-4 text-center text-sm text-(--text-muted)">{t('pomodoro.keepsRunning')}</p>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  )
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────────

/** Timer modal plus a small floating indicator, rendered once for the whole app (in Layout),
 * so a running session stays visible and reachable from any page. */
export function GlobalPomodoro() {
  const { t } = useTranslation('learning')
  const { isOpen, open, close, status, timeLeft, reset } = usePomodoro()

  const handleClose = () => {
    // A finished session has been saved — clear it so the indicator goes away.
    if (status === 'completed') reset()
    close()
  }

  const showIndicator = !isOpen && status !== 'idle'

  return (
    <>
      <AnimatePresence>{isOpen && <PomodoroModal key="pomodoro" onClose={handleClose} />}</AnimatePresence>
      <AnimatePresence>
        {showIndicator && (
          <motion.button
            key="pomodoro-indicator"
            type="button"
            onClick={open}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            aria-label={t('pomodoro.indicatorAria')}
            className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 font-display text-base shadow-xl backdrop-blur-md transition-colors lg:right-6 lg:bottom-6 ${
              status === 'completed'
                ? 'border-(--positive)/50 bg-(--bg-card)/95 text-(--positive)'
                : status === 'paused'
                  ? 'border-(--warning)/50 bg-(--bg-card)/95 text-(--warning)'
                  : 'border-(--accent)/50 bg-(--bg-card)/95 text-(--accent)'
            }`}
          >
            {status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : status === 'paused' ? (
              <Pause className="h-5 w-5" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-(--accent) animate-pulse" />
            )}
            <span className="tabular-nums">
              {status === 'completed' ? t('pomodoro.completed') : formatClock(timeLeft)}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

export function PomodoroCardButton() {
  const { t } = useTranslation('learning')
  const { open } = usePomodoro()
  return (
    <button
      type="button"
      onClick={open}
      className="w-full flex items-center justify-between px-5 py-5 rounded-xl border border-(--accent)/30 bg-(--accent)/5 hover:bg-(--accent)/10 hover:border-(--accent)/60 transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-(--accent)/15 flex items-center justify-center group-hover:bg-(--accent)/25 transition-colors shrink-0">
          <Timer className="w-6 h-6 text-(--accent)" />
        </div>
        <div className="text-left">
          <p className="font-display font-bold text-(--text-primary) text-base tracking-wide">
            {t('pomodoro.cardTitle')}
          </p>
          <p className="text-sm text-(--text-muted) mt-0.5">
            {t('pomodoro.cardSubtitle')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-(--accent) opacity-70 group-hover:opacity-100 transition-opacity">
        <span className="font-display text-sm hidden sm:block">{t('pomodoro.run')}</span>
        <Play className="w-5 h-5" />
      </div>
    </button>
  )
}

export function PomodoroInlineButton({ className }: { className?: string }) {
  const { t } = useTranslation('learning')
  const { open } = usePomodoro()
  return (
    <button
      type="button"
      onClick={open}
      className={
        className ??
        'flex items-center gap-1.5 rounded-lg border border-(--accent)/30 bg-(--accent)/10 px-3 py-1.5 text-sm font-display text-(--accent) transition-colors hover:bg-(--accent)/20'
      }
      title={t('pomodoro.inlineButtonTitle')}
    >
      <Timer className="h-3.5 w-3.5 shrink-0" />
      {t('pomodoro.inlineButton')}
    </button>
  )
}
