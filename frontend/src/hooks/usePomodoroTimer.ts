import { useMemo } from 'react'
import { useLearning } from '../context/LearningContext'
import { usePomodoro } from '../context/PomodoroContext'

export const POMODORO_MODES = [
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '1.5 h', minutes: 90 },
  { label: '2 h', minutes: 120 },
] as const

export const POMODORO_RING = {
  SIZE: 280,
  CX: 140,
  RADIUS: 124,
  STROKE: 12,
} as const

const CIRCUMFERENCE = 2 * Math.PI * POMODORO_RING.RADIUS

/**
 * View model for the timer UI. The timer itself lives in PomodoroContext (app-wide), so it keeps
 * running when the modal is closed, on other pages and in background tabs.
 */
export function usePomodoroTimer() {
  const learning = useLearning()
  const pomodoro = usePomodoro()
  const { status, selectedMinutes, timeLeft } = pomodoro

  const isRunning = status === 'running'
  const completed = status === 'completed'
  const started = status !== 'idle'

  const totalSeconds = selectedMinutes * 60
  const progress = completed ? 0 : totalSeconds > 0 ? timeLeft / totalSeconds : 1
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)

  const ringColor = useMemo(() => {
    if (completed) return 'var(--positive)'
    if (progress > 0.5) return 'var(--accent)'
    if (progress > 0.25) return 'var(--warning)'
    return '#e74c3c'
  }, [completed, progress])

  return {
    selectedMinutes,
    timeLeft,
    isRunning,
    completed,
    started,
    topic: pomodoro.topic,
    setTopic: pomodoro.setTopic,
    sessionType: pomodoro.sessionType,
    setSessionType: pomodoro.setSessionType,
    handleModeChange: pomodoro.selectMinutes,
    handleReset: pomodoro.reset,
    pause: pomodoro.pause,
    startOrResume: pomodoro.start,
    progress,
    strokeDashoffset,
    ringColor,
    minutesDisplay: Math.floor(timeLeft / 60),
    secondsDisplay: timeLeft % 60,
    sessionCategories: learning?.sessionCategories ?? [],
    circumference: CIRCUMFERENCE,
  }
}
