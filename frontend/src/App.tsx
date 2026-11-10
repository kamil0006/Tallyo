import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DemoDataProvider } from './context/DemoDataContext'
import { MonthProvider } from './context/MonthContext'
import { ChartPeriodProvider } from './context/ChartPeriodContext'
import { LearningProvider } from './context/LearningContext'
import { PomodoroProvider } from './context/PomodoroContext'
import { NotesProvider } from './context/NotesContext'
import { GlobalSearchProvider } from './context/GlobalSearchContext'
import { QuickAddProvider } from './context/QuickAddContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { SettingsProvider } from './context/SettingsContext'
import { Login } from './pages/Login'
import { ResetPassword } from './pages/ResetPassword'
import { useAuth } from './context/AuthContext'

/**
 * Pages are lazy-loaded (code-splitting). Thanks to this, entering e.g. the Dashboard
 * doesn't download the code for Habits / Calendar / Learning / recharts etc.
 * Named exports are wrapped in `{ default }` because `lazy` requires a default export.
 */
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const FinancesLayout = lazy(() => import('./pages/Finances/FinancesLayout').then((m) => ({ default: m.FinancesLayout })))
const Overview = lazy(() => import('./pages/Finances/Overview').then((m) => ({ default: m.Overview })))
const Transactions = lazy(() => import('./pages/Finances/Transactions').then((m) => ({ default: m.Transactions })))
const Recurring = lazy(() => import('./pages/Finances/Recurring').then((m) => ({ default: m.Recurring })))
const Analytics = lazy(() => import('./pages/Finances/Analytics').then((m) => ({ default: m.Analytics })))
const FinancesNetWorth = lazy(() => import('./pages/Finances/FinancesNetWorth').then((m) => ({ default: m.FinancesNetWorth })))
const Todo = lazy(() => import('./pages/Todo').then((m) => ({ default: m.Todo })))
const Calendar = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })))
const Habits = lazy(() => import('./pages/Habits').then((m) => ({ default: m.Habits })))
const LearningLayout = lazy(() => import('./pages/Learning/LearningLayout').then((m) => ({ default: m.LearningLayout })))
const LearningOverview = lazy(() => import('./pages/Learning/LearningOverview').then((m) => ({ default: m.LearningOverview })))
const LearningTime = lazy(() => import('./pages/Learning/LearningTime').then((m) => ({ default: m.LearningTime })))
const LearningCourses = lazy(() => import('./pages/Learning/LearningCourses').then((m) => ({ default: m.LearningCourses })))
const LearningProjects = lazy(() => import('./pages/Learning/LearningProjects').then((m) => ({ default: m.LearningProjects })))
const LearningBooks = lazy(() => import('./pages/Learning/LearningBooks').then((m) => ({ default: m.LearningBooks })))
const LearningCertificates = lazy(() => import('./pages/Learning/LearningCertificates').then((m) => ({ default: m.LearningCertificates })))
const NotesLayout = lazy(() => import('./pages/Notes/NotesLayout').then((m) => ({ default: m.NotesLayout })))
const NotesOverview = lazy(() => import('./pages/Notes/NotesOverview').then((m) => ({ default: m.NotesOverview })))
const NotesPage = lazy(() => import('./pages/Notes/NotesPage').then((m) => ({ default: m.NotesPage })))
const NotesArchive = lazy(() => import('./pages/Notes/NotesArchive').then((m) => ({ default: m.NotesArchive })))

function RouteFallback() {
  return <div className="min-h-[60vh]" aria-hidden />
}

function App() {
  const { sessionReady, isDemoMode, user, isLoggedIn } = useAuth()
  const dataScopeKey = isDemoMode ? 'demo' : `u-${user?.id ?? 'x'}`

  if (!sessionReady) {
    return <RouteFallback />
  }

  const isAuthenticated = isDemoMode || isLoggedIn

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <DemoDataProvider>
      <MonthProvider>
        <ChartPeriodProvider>
        <LearningProvider key={dataScopeKey}>
        <PomodoroProvider>
        <NotesProvider key={dataScopeKey}>
        <GlobalSearchProvider>
        <QuickAddProvider>
        <OnboardingProvider>
        <SettingsProvider>
        <Layout>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/finances" element={<FinancesLayout />}>
          <Route index element={<Overview />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="recurring" element={<Recurring />} />
          <Route path="net-worth" element={<FinancesNetWorth />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route path="/expenses" element={<Navigate to="/finances/transactions" replace />} />
        <Route path="/income" element={<Navigate to="/finances/transactions" replace />} />
        <Route path="/wishes" element={<Navigate to="/finances" replace />} />
        <Route path="/todo" element={<Todo />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/notes" element={<NotesLayout />}>
          <Route index element={<NotesOverview />} />
          <Route path="inbox" element={<NotesPage type="inbox" />} />
          <Route path="quick" element={<Navigate to="/notes/inbox" replace />} />
          <Route path="ideas" element={<NotesPage type="idea" />} />
          <Route path="references" element={<NotesPage type="reference" />} />
          <Route path="archive" element={<NotesArchive />} />
        </Route>
        <Route path="/learning" element={<LearningLayout />}>
          <Route index element={<LearningOverview />} />
          <Route path="hours" element={<LearningTime />} />
          <Route path="courses" element={<LearningCourses />} />
          <Route path="projects" element={<LearningProjects />} />
          <Route path="books" element={<LearningBooks />} />
          <Route path="certificates" element={<LearningCertificates />} />
        </Route>
        <Route path="/nauka" element={<Navigate to="/learning" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </Layout>
        </SettingsProvider>
        </OnboardingProvider>
        </QuickAddProvider>
        </GlobalSearchProvider>
        </NotesProvider>
        </PomodoroProvider>
        </LearningProvider>
        </ChartPeriodProvider>
      </MonthProvider>
    </DemoDataProvider>
  )
}

export default App
