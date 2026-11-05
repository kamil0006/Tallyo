import { api } from './api/client'

export type ForeignCurrency = 'USD' | 'EUR'
export type Currency = 'PLN' | ForeignCurrency

export const CURRENCIES: Currency[] = ['PLN', 'USD', 'EUR']

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  PLN: 'zł',
  USD: '$',
  EUR: '€',
}

export interface ExchangeRatesResponse {
  base: 'PLN'
  rates: Record<ForeignCurrency, number>
  updatedAt: string
}

/** Public endpoint (no auth) — also works in demo mode. */
export function fetchExchangeRates(): Promise<ExchangeRatesResponse> {
  return api<ExchangeRatesResponse>('/exchange-rates')
}

export function convertToPln(amount: number, currency: Currency, rates: Record<ForeignCurrency, number> | null): number | null {
  if (currency === 'PLN') return amount
  const rate = rates?.[currency]
  if (!rate) return null
  return Math.round(amount * rate * 100) / 100
}

export function formatCurrencyAmount(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  const formatted = amount.toLocaleString(currency === 'PLN' ? 'pl-PL' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency === 'USD' || currency === 'EUR' ? `${symbol}${formatted}` : `${formatted} ${symbol}`
}

const NBSP = ' '

const plnNumber = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // pl-PL skips grouping for 4-digit numbers by default ("1200" vs "12 000")
  useGrouping: 'always' as unknown as boolean,
})
const plnInteger = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' as unknown as boolean })
const plnCompact = new Intl.NumberFormat('pl-PL', { notation: 'compact', maximumFractionDigits: 1 })

/** Polish-formatted number: "1 200", "23 456,78". Whole amounts drop the decimals. */
export function formatNumberPl(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (Object.is(rounded, -0) || rounded === 0) return '0'
  return Number.isInteger(rounded) ? plnInteger.format(rounded) : plnNumber.format(rounded)
}

/** "23 456,78 zł" with non-breaking spaces, so the amount never wraps mid-way. */
export function formatPln(value: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && Math.round(value * 100) > 0 ? '+' : ''
  return `${sign}${formatNumberPl(value)}${NBSP}zł`
}

/** Short number: "200 tys.", "1,3 mln". */
export function formatNumberCompactPl(value: number): string {
  return plnCompact.format(value).replace(/\s/g, NBSP)
}

/** Short form for chart axes: "200 tys. zł", "1,3 mln zł". */
export function formatPlnCompact(value: number): string {
  return `${formatNumberCompactPl(value)}${NBSP}zł`
}
