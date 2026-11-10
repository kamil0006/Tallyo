import { describe, it, expect } from 'vitest'
import { mergeExpensesWithScheduled, type ExpenseLike, type ScheduledExpenseLike } from './expensesUtils'
import { recordAmountChange } from './scheduledAmountHistory'

const expense = (overrides: Partial<ExpenseLike> = {}): ExpenseLike => ({
  id: 'exp-1',
  name: 'Rent',
  amount: 100,
  category: 'housing',
  date: '2026-07-10',
  ...overrides,
})

const scheduled = (overrides: Partial<ScheduledExpenseLike> = {}): ScheduledExpenseLike => ({
  id: 'sched-1',
  name: 'Rent',
  amount: 2000,
  category: 'housing',
  dayOfMonth: 10,
  active: true,
  ...overrides,
})

// month is 0-indexed (JS Date convention), matching mergeExpensesWithScheduled's signature.
const JULY = 6
const FEBRUARY = 1

describe('mergeExpensesWithScheduled', () => {
  it('passes through a real expense with no matching scheduled entry', () => {
    const result = mergeExpensesWithScheduled(
      [expense({ name: 'Groceries', date: '2026-07-05' })],
      [],
      JULY,
      2026
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ name: 'Groceries', isScheduled: false })
  })

  it('excludes a real expense that matches an active scheduled entry by name (case-insensitive) and day', () => {
    const result = mergeExpensesWithScheduled(
      [expense({ name: 'rent', date: '2026-07-10' })],
      [scheduled({ name: 'Rent', dayOfMonth: 10 })],
      JULY,
      2026
    )
    // the real duplicate is dropped, only the generated virtual entry remains
    expect(result).toHaveLength(1)
    expect(result[0].isScheduled).toBe(true)
  })

  it('generates a virtual expense from an active scheduled entry', () => {
    const result = mergeExpensesWithScheduled([], [scheduled()], JULY, 2026)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'scheduled-sched-1-2026-07-10',
      scheduledId: 'sched-1',
      date: '2026-07-10',
      isScheduled: true,
    })
  })

  it('clamps dayOfMonth to the last day of a shorter month', () => {
    // February 2026 has 28 days
    const result = mergeExpensesWithScheduled([], [scheduled({ dayOfMonth: 31 })], FEBRUARY, 2026)
    expect(result[0].date).toBe('2026-02-28')
  })

  it('produces no virtual entry for an inactive scheduled expense', () => {
    const result = mergeExpensesWithScheduled([], [scheduled({ active: false })], JULY, 2026)
    expect(result).toHaveLength(0)
  })

  it('excludes a scheduled expense created after the target month ends', () => {
    const result = mergeExpensesWithScheduled(
      [],
      [scheduled({ createdAt: '2026-08-01' })],
      JULY,
      2026
    )
    expect(result).toHaveLength(0)
  })

  it('includes a scheduled expense with an invalid or missing createdAt', () => {
    expect(mergeExpensesWithScheduled([], [scheduled({ createdAt: undefined })], JULY, 2026)).toHaveLength(1)
    expect(
      mergeExpensesWithScheduled([], [scheduled({ createdAt: 'not-a-date' })], JULY, 2026)
    ).toHaveLength(1)
  })

  it('excludes a scheduled expense paused through the generated date', () => {
    const paused = mergeExpensesWithScheduled(
      [],
      [scheduled({ pausedUntil: '2026-07-10' })],
      JULY,
      2026
    )
    expect(paused).toHaveLength(0)

    const notPaused = mergeExpensesWithScheduled(
      [],
      [scheduled({ pausedUntil: '2026-07-01' })],
      JULY,
      2026
    )
    expect(notPaused).toHaveLength(1)
  })

  describe('ended (soft-deleted) scheduled expense', () => {
    // Netflix charged on the 1st, user cancels on the 10th of July 2026
    const ended = scheduled({ dayOfMonth: 1, endedAt: '2026-07-10T12:00:00.000Z' })

    it('keeps past occurrences up to and including the end date', () => {
      const july = mergeExpensesWithScheduled([], [ended], JULY, 2026)
      expect(july).toHaveLength(1)
      expect(july[0].date).toBe('2026-07-01')

      const june = mergeExpensesWithScheduled([], [ended], JULY - 1, 2026)
      expect(june).toHaveLength(1)
    })

    it('generates no occurrences after the end date', () => {
      const august = mergeExpensesWithScheduled([], [ended], JULY + 1, 2026)
      expect(august).toHaveLength(0)

      const endedBeforeCharge = scheduled({ dayOfMonth: 15, endedAt: '2026-07-10T12:00:00.000Z' })
      const july = mergeExpensesWithScheduled([], [endedBeforeCharge], JULY, 2026)
      expect(july).toHaveLength(0)
    })

    it('does not suppress a real expense dated after the end date', () => {
      // user cancelled the recurring cost, then added a one-off with the same name and day
      const result = mergeExpensesWithScheduled(
        [expense({ name: 'Rent', date: '2026-08-01' })],
        [ended],
        JULY + 1,
        2026
      )
      expect(result).toHaveLength(1)
      expect(result[0].isScheduled).toBe(false)
    })
  })

  describe('skipped (removed) payment', () => {
    it('keeps a payment that was actually made when the cost is ended later the same month', () => {
      // paid the subscription on the 1st, cancelled it on the 12th
      const cancelled = scheduled({ dayOfMonth: 1, endedAt: '2026-07-12T10:00:00.000Z' })
      const july = mergeExpensesWithScheduled([], [cancelled], JULY, 2026)
      expect(july.map((r) => r.date)).toEqual(['2026-07-01'])
    })

    it('removes only the payment charged by mistake and keeps the other months', () => {
      // forgot to cancel: August was generated although it was never paid
      const forgotten = scheduled({ dayOfMonth: 1, skippedDates: ['2026-08-01'] })
      expect(mergeExpensesWithScheduled([], [forgotten], JULY + 1, 2026)).toHaveLength(0)
      expect(mergeExpensesWithScheduled([], [forgotten], JULY, 2026)).toHaveLength(1)
      expect(mergeExpensesWithScheduled([], [forgotten], JULY + 2, 2026)).toHaveLength(1)
    })

    it('does not suppress a real expense on a skipped date', () => {
      const skipped = scheduled({ name: 'Rent', dayOfMonth: 10, skippedDates: ['2026-07-10'] })
      const result = mergeExpensesWithScheduled([expense({ name: 'Rent', date: '2026-07-10' })], [skipped], JULY, 2026)
      expect(result).toHaveLength(1)
      expect(result[0].isScheduled).toBe(false)
    })
  })

  it('sorts the merged result by date ascending', () => {
    const result = mergeExpensesWithScheduled(
      [expense({ id: 'e1', date: '2026-07-20', name: 'Late' })],
      [scheduled({ id: 's1', name: 'Early', dayOfMonth: 5 })],
      JULY,
      2026
    )
    expect(result.map((r) => r.date)).toEqual(['2026-07-05', '2026-07-20'])
  })

  describe('amount history', () => {
    const changed = (now: Partial<ScheduledExpenseLike> = {}) => {
      const before = scheduled({ amount: 2000 })
      return scheduled({ ...now, amountHistory: recordAmountChange(before, '2026-08-01') })
    }

    it('keeps the old amount for payments before the change', () => {
      const [july] = mergeExpensesWithScheduled([], [changed({ amount: 1500 })], JULY, 2026)
      expect(july.amount).toBe(2000)
    })

    it('uses the new amount from the change date on', () => {
      const [august] = mergeExpensesWithScheduled([], [changed({ amount: 1500 })], 7, 2026)
      expect(august.amount).toBe(1500)
    })
  })

  describe('single payment edited in transactions', () => {
    it('shows the edited expense instead of the recurring payment', () => {
      const result = mergeExpensesWithScheduled(
        [expense({ id: 'edited', amount: 1800, date: '2026-07-10' })],
        [scheduled({ skippedDates: ['2026-07-10'] })],
        JULY,
        2026
      )
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ id: 'edited', amount: 1800, isScheduled: false })
    })
  })
})
