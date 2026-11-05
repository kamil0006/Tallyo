import type { CookieOptions, Request, Response } from 'express'
import { isProduction } from './config.js'

export const AUTH_COOKIE_NAME = 'tallyo_session'
export const REFRESH_COOKIE_NAME = 'tallyo_refresh'
// Cookie names from before the LifeOS -> Tallyo rename; still read so existing sessions survive.
const LEGACY_AUTH_COOKIE_NAME = 'lifeos_session'
const LEGACY_REFRESH_COOKIE_NAME = 'lifeos_refresh'

const ACCESS_MAX_AGE_MS = 60 * 60 * 1000
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function baseCookieOptions(): Pick<CookieOptions, 'httpOnly' | 'secure' | 'sameSite' | 'path'> {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  }
}

export function setAccessCookie(res: Response, accessToken: string): void {
  res.cookie(AUTH_COOKIE_NAME, accessToken, {
    ...baseCookieOptions(),
    maxAge: ACCESS_MAX_AGE_MS,
  })
}

export function setRefreshCookie(res: Response, refreshToken: string, rememberMe: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions(),
    ...(rememberMe ? { maxAge: REFRESH_MAX_AGE_MS } : {}),
  })
}

/** @deprecated use setAccessCookie + setRefreshCookie */
export function setAuthCookie(res: Response, token: string, rememberMe: boolean): void {
  setAccessCookie(res, token)
  setRefreshCookie(res, token, rememberMe)
}

export function clearAuthCookies(res: Response): void {
  const opts = baseCookieOptions()
  res.clearCookie(AUTH_COOKIE_NAME, opts)
  res.clearCookie(REFRESH_COOKIE_NAME, opts)
  res.clearCookie(LEGACY_AUTH_COOKIE_NAME, opts)
  res.clearCookie(LEGACY_REFRESH_COOKIE_NAME, opts)
}

export function clearAuthCookie(res: Response): void {
  clearAuthCookies(res)
}

export function getTokenFromRequest(req: Request): string | null {
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAME] ?? req.cookies?.[LEGACY_AUTH_COOKIE_NAME]
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return null
}

export function getRefreshTokenFromRequest(req: Request): string | null {
  const fromCookie = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.cookies?.[LEGACY_REFRESH_COOKIE_NAME]
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie
  return null
}
