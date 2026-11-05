import type { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { isProduction } from '../lib/config.js'
import { HttpError } from '../lib/httpError.js'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[API]', err)
  if (res.headersSent) return

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message })
  }

  if (err instanceof ZodError) {
    const first = err.issues[0]
    const field = first?.path.join('.') || 'dane'
    return res.status(400).json({
      error: isProduction ? 'Nieprawidłowe dane wejściowe' : `Walidacja (${field}): ${first?.message ?? 'błąd'}`,
    })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2022') {
    return res.status(503).json({
      error:
        'Schemat bazy nie jest zsynchronizowany z aplikacją. W katalogu backend uruchom: npx prisma migrate deploy',
    })
  }

  res.status(500).json({
    error: isProduction ? 'Błąd serwera' : err instanceof Error ? err.message : 'Błąd serwera',
  })
}
