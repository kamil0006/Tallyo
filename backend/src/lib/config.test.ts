import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// `isProduction` in config.ts is a module-level const computed once at import
// time, so each test that needs a different NODE_ENV must reset the module
// registry and re-import config.ts *after* setting process.env.NODE_ENV.
const DEV_JWT_FALLBACK = 'dev-secret-change-in-production'
const VALID_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

let envBackup: NodeJS.ProcessEnv

beforeEach(() => {
  envBackup = { ...process.env }
})

afterEach(() => {
  process.env = { ...envBackup }
  vi.resetModules()
})

async function loadConfig() {
  vi.resetModules()
  return import('./config.js')
}

describe('getJwtSecret', () => {
  it('dev mode: returns fallback when JWT_SECRET is unset', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    const { getJwtSecret } = await loadConfig()
    expect(getJwtSecret()).toBe(DEV_JWT_FALLBACK)
  })

  it('dev mode: returns the real value when set and not the fallback', async () => {
    process.env.NODE_ENV = 'development'
    process.env.JWT_SECRET = 'my-dev-secret'
    const { getJwtSecret } = await loadConfig()
    expect(getJwtSecret()).toBe('my-dev-secret')
  })

  it('production mode: throws when unset', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    const { getJwtSecret } = await loadConfig()
    expect(() => getJwtSecret()).toThrow()
  })

  it('production mode: throws when equal to the dev fallback', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = DEV_JWT_FALLBACK
    const { getJwtSecret } = await loadConfig()
    expect(() => getJwtSecret()).toThrow()
  })

  it('production mode: throws when shorter than 32 characters', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'short-secret'
    const { getJwtSecret } = await loadConfig()
    expect(() => getJwtSecret()).toThrow()
  })

  it('production mode: returns the secret when valid', async () => {
    process.env.NODE_ENV = 'production'
    const secret = 'a'.repeat(32)
    process.env.JWT_SECRET = secret
    const { getJwtSecret } = await loadConfig()
    expect(getJwtSecret()).toBe(secret)
  })
})

describe('isRegistrationEnabled', () => {
  it('respects explicit true/false overrides regardless of NODE_ENV', async () => {
    process.env.NODE_ENV = 'production'
    process.env.REGISTRATION_ENABLED = 'true'
    expect((await loadConfig()).isRegistrationEnabled()).toBe(true)

    process.env.NODE_ENV = 'development'
    process.env.REGISTRATION_ENABLED = 'false'
    expect((await loadConfig()).isRegistrationEnabled()).toBe(false)
  })

  it('defaults to !isProduction when unset', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.REGISTRATION_ENABLED
    expect((await loadConfig()).isRegistrationEnabled()).toBe(false)

    process.env.NODE_ENV = 'development'
    delete process.env.REGISTRATION_ENABLED
    expect((await loadConfig()).isRegistrationEnabled()).toBe(true)
  })
})

describe('isEncryptionEnabled / getEncryptionKey', () => {
  it('returns null when encryption is disabled', async () => {
    delete process.env.ENCRYPTION_ENABLED
    const { isEncryptionEnabled, getEncryptionKey } = await loadConfig()
    expect(isEncryptionEnabled()).toBe(false)
    expect(getEncryptionKey()).toBeNull()
  })

  it('throws when enabled without ENCRYPTION_KEY', async () => {
    process.env.ENCRYPTION_ENABLED = 'true'
    delete process.env.ENCRYPTION_KEY
    const { getEncryptionKey } = await loadConfig()
    expect(() => getEncryptionKey()).toThrow()
  })

  it('throws when ENCRYPTION_KEY does not decode to 32 bytes', async () => {
    process.env.ENCRYPTION_ENABLED = 'true'
    process.env.ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64')
    const { getEncryptionKey } = await loadConfig()
    expect(() => getEncryptionKey()).toThrow()
  })

  it('returns a 32-byte Buffer for a valid key', async () => {
    process.env.ENCRYPTION_ENABLED = 'true'
    process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY
    const { getEncryptionKey } = await loadConfig()
    const key = getEncryptionKey()
    expect(key).toBeInstanceOf(Buffer)
    expect(key?.length).toBe(32)
  })
})

describe('getCorsOrigins', () => {
  it('production: throws when FRONTEND_URL is unset', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.FRONTEND_URL
    const { getCorsOrigins } = await loadConfig()
    expect(() => getCorsOrigins()).toThrow()
  })

  it('production: returns only FRONTEND_URL when set', async () => {
    process.env.NODE_ENV = 'production'
    process.env.FRONTEND_URL = 'https://tallyo.example.com'
    const { getCorsOrigins } = await loadConfig()
    expect(getCorsOrigins()).toEqual(['https://tallyo.example.com'])
  })

  it('dev mode: includes localhost ports and filters out unset FRONTEND_URL', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.FRONTEND_URL
    const { getCorsOrigins } = await loadConfig()
    const origins = getCorsOrigins()
    expect(origins).toEqual([
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ])
  })

  it('dev mode: appends FRONTEND_URL when set', async () => {
    process.env.NODE_ENV = 'development'
    process.env.FRONTEND_URL = 'http://localhost:9999'
    const { getCorsOrigins } = await loadConfig()
    expect(getCorsOrigins()).toContain('http://localhost:9999')
  })
})
