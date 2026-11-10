import { describe, expect, it } from 'vitest'
import { amountAt, dayBefore, parseAmountHistory, recordAmountChange } from './scheduledAmountHistory.js'

const base = { amount: 100, currency: 'PLN', originalAmount: null, amountHistory: [] as unknown }

describe('scheduledAmountHistory', () => {
  it('dayBefore crosses month and year boundaries', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
    expect(dayBefore('2026-01-01')).toBe('2025-12-31')
  })

  it('keeps the old amount for payments before the change', () => {
    const history = recordAmountChange(base, '2026-11-10')
    const after = { ...base, amount: 60, amountHistory: history }
    expect(amountAt(after, '2026-10-15').amount).toBe(100)
    expect(amountAt(after, '2026-11-09').amount).toBe(100)
    expect(amountAt(after, '2026-11-10').amount).toBe(60)
    expect(amountAt(after, '2026-12-15').amount).toBe(60)
  })

  it('handles several changes in a row', () => {
    const first = { ...base, amount: 80, amountHistory: recordAmountChange(base, '2026-06-01') }
    const second = { ...first, amount: 60, amountHistory: recordAmountChange(first, '2026-09-01') }
    expect(amountAt(second, '2026-05-15').amount).toBe(100)
    expect(amountAt(second, '2026-07-15').amount).toBe(80)
    expect(amountAt(second, '2026-10-15').amount).toBe(60)
  })

  it('a backdated change replaces later history', () => {
    const first = { ...base, amount: 80, amountHistory: recordAmountChange(base, '2026-06-01') }
    const second = { ...first, amount: 60, amountHistory: recordAmountChange(first, '2026-03-01') }
    expect(amountAt(second, '2026-02-15').amount).toBe(100)
    expect(amountAt(second, '2026-04-15').amount).toBe(60)
    expect(amountAt(second, '2026-07-15').amount).toBe(60)
  })

  it('remembers the foreign currency amount', () => {
    const usd = { amount: 40, currency: 'USD', originalAmount: 10, amountHistory: [] }
    const history = recordAmountChange(usd, '2026-11-01')
    expect(history[0]).toEqual({ until: '2026-10-31', amount: 40, currency: 'USD', originalAmount: 10 })
  })

  it('ignores malformed stored history', () => {
    expect(parseAmountHistory('nope')).toEqual([])
    expect(parseAmountHistory([{ until: 'x', amount: 1 }])).toEqual([])
  })
})
