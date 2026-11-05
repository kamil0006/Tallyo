/** Central security configuration — validated at server startup. */

const DEV_JWT_FALLBACK = 'dev-secret-change-in-production'

export const isProduction = process.env.NODE_ENV === 'production'

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (isProduction) {
    if (!secret || secret === DEV_JWT_FALLBACK) {
      throw new Error(
        'JWT_SECRET musi być ustawiony na silny losowy klucz (min. 32 znaki) w NODE_ENV=production'
      )
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET musi mieć co najmniej 32 znaki w produkcji')
    }
    return secret
  }
  return secret && secret !== DEV_JWT_FALLBACK ? secret : DEV_JWT_FALLBACK
}

export function isRegistrationEnabled(): boolean {
  if (process.env.REGISTRATION_ENABLED === 'true') return true
  if (process.env.REGISTRATION_ENABLED === 'false') return false
  return !isProduction
}

/** Max number of accounts (MAX_USERS). Unset/invalid = no limit. */
export function getMaxUsers(): number | null {
  const raw = process.env.MAX_USERS?.trim()
  if (!raw || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n > 0 ? n : null
}

export function isEncryptionEnabled(): boolean {
  return process.env.ENCRYPTION_ENABLED === 'true'
}

export function getEncryptionKey(): Buffer | null {
  if (!isEncryptionEnabled()) return null
  const raw = process.env.ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error('ENCRYPTION_ENABLED=true wymaga ENCRYPTION_KEY (32 bajty, base64)')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY musi dekodować się do dokładnie 32 bajtów (AES-256)')
  }
  return key
}

export function isOpenAiReportEnabled(): boolean {
  return (
    process.env.AI_REPORT_ENABLED === 'true' &&
    process.env.AI_USE_OPENAI === 'true' &&
    Boolean(process.env.OPENAI_API_KEY?.trim())
  )
}

export function getCorsOrigins(): string[] {
  const frontend = process.env.FRONTEND_URL?.trim()
  if (isProduction) {
    if (!frontend) {
      throw new Error('FRONTEND_URL musi być ustawiony w NODE_ENV=production')
    }
    return [frontend]
  }
  return [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    frontend,
  ].filter((o): o is string => Boolean(o))
}

/** Call before server start — throws on invalid production configuration. */
export function validateSecurityConfig(): void {
  getJwtSecret()
  getCorsOrigins()
  if (isEncryptionEnabled()) {
    getEncryptionKey()
  }
  if (isProduction && process.env.AI_USE_OPENAI === 'true' && process.env.AI_REPORT_ENABLED !== 'true') {
    console.warn(
      '[security] AI_USE_OPENAI=true bez AI_REPORT_ENABLED=true — raport AI wyłączony'
    )
  }
}
