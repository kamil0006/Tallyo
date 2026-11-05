import 'dotenv/config'
import express from 'express'
import 'express-async-errors'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { prisma } from './lib/prisma.js'
import { validateSecurityConfig, getCorsOrigins, isProduction } from './lib/config.js'
import { authRouter } from './routes/auth.js'
import { expensesRouter } from './routes/expenses.js'
import { incomeRouter } from './routes/income.js'
import { todosRouter } from './routes/todos.js'
import { eventsRouter } from './routes/events.js'
import { habitsRouter } from './routes/habits.js'
import { goalsRouter } from './routes/goals.js'
import { scheduledExpensesRouter } from './routes/scheduledExpenses.js'
import { expenseCategoriesRouter } from './routes/expenseCategories.js'
import { netWorthRouter } from './routes/netWorth.js'
import { notesRouter } from './routes/notes.js'
import { learningRouter } from './routes/learning.js'
import { aiRouter } from './routes/ai.js'
import { backupRouter } from './routes/backup.js'
import { exchangeRatesRouter } from './routes/exchangeRates.js'
import { authMiddleware } from './middleware/auth.js'
import { errorHandler } from './middleware/errorHandler.js'
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimit.js'

validateSecurityConfig()

const app = express()
const PORT = process.env.PORT || 3002

app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

app.use(
  cors({
    origin: getCorsOrigins(),
    credentials: true,
  })
)
app.use(express.json({ limit: '8mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRateLimiter, authRouter)
app.use('/api', apiRateLimiter)
app.use('/api/exchange-rates', exchangeRatesRouter)
app.use('/api/expenses', authMiddleware, expensesRouter)
app.use('/api/income', authMiddleware, incomeRouter)
app.use('/api/todos', authMiddleware, todosRouter)
app.use('/api/events', authMiddleware, eventsRouter)
app.use('/api/habits', authMiddleware, habitsRouter)
app.use('/api/goals', authMiddleware, goalsRouter)
app.use('/api/scheduled-expenses', authMiddleware, scheduledExpensesRouter)
app.use('/api/expense-categories', authMiddleware, expenseCategoriesRouter)
app.use('/api/net-worth', authMiddleware, netWorthRouter)
app.use('/api/notes', authMiddleware, notesRouter)
app.use('/api/learning', authMiddleware, learningRouter)
app.use('/api/ai', authMiddleware, aiRouter)
app.use('/api/backup', authMiddleware, backupRouter)

app.use(errorHandler)

const server = app.listen(PORT, async () => {
  console.log(`Tallyo API running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`)
  try {
    await prisma.$connect()
    console.log('Połączenie z bazą danych OK')
  } catch (e) {
    console.error('\nBŁĄD: Nie można połączyć z bazą danych!')
    console.error('Sprawdź DATABASE_URL w .env i czy PostgreSQL działa.')
    console.error('Uruchom migracje: npx prisma migrate dev\n')
  }
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nBłąd: Port ${PORT} jest zajęty.`)
    console.error('Zatrzymaj inny proces lub ustaw PORT w .env (np. PORT=3002)\n')
    process.exit(1)
  }
  throw err
})
