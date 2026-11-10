import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ModalShell } from './ModalShell'
import { ExpenseCategoryPicker, DEFAULT_NEW_EXPENSE_CATEGORY_COLOR } from './finance/ExpenseCategoryPicker'
import { PaymentMethodPicker } from './finance/PaymentMethodPicker'
import { EXPENSE_CATEGORY_NONE } from '../lib/expenseCategoryConstants'
import type { PaymentMethod } from '../lib/paymentMethod'
import { isPaymentMethod } from '../lib/paymentMethod'
import { todayIso } from '../lib/scheduledAmountHistory'
import { CURRENCIES, convertToPln, fetchExchangeRates, formatCurrencyAmount, type Currency, type ForeignCurrency } from '../lib/currency'

function leadingUpperPl(s: string) {
  const t = s.trim()
  if (!t) return ''
  return t[0].toLocaleUpperCase('pl-PL') + t.slice(1)
}

export type RecurringFormPayload = {
  name: string
  /** Amount in the `currency` currency — exactly as entered by the user. */
  amount: number
  currency: Currency
  /** PLN conversion preview (used for saving in demo mode, where no backend computes the rate). */
  convertedAmount: number | null
  category: string
  dayOfMonth: number
  paymentMethod: PaymentMethod
  note?: string | null
  /** Set when editing changed the amount: first payment date that uses it — earlier payments keep the old one. */
  amountEffectiveFrom?: string
}

export type RecurringModalEditing = {
  id: string
  name: string
  /** Always in PLN. */
  amount: number
  currency?: Currency
  originalAmount?: number | null
  category: string
  dayOfMonth: number
  paymentMethod?: PaymentMethod | null
  note?: string | null
}

interface Category {
  id: string
  name: string
  label: string
  color: string
}

interface RecurringModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: RecurringFormPayload) => void | Promise<void>
  onUpdate?: (id: string, data: RecurringFormPayload) => void | Promise<void>
  editing?: RecurringModalEditing | null
  categories: Category[]
  onAddCategory?: (name: string, color: string) => Promise<void>
  onDeleteCategory?: (id: string) => Promise<void>
}

export function RecurringModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  editing,
  categories,
  onAddCategory,
  onDeleteCategory,
}: RecurringModalProps) {
  const { t } = useTranslation('finances')
  const buildInitialForm = useCallback(
    () => ({
      name: '',
      amount: '',
      currency: 'PLN' as Currency,
      category: categories[0]?.name ?? EXPENSE_CATEGORY_NONE,
      dayOfMonthStr: '',
      paymentMethod: '' as PaymentMethod | '',
      note: '',
      amountEffectiveFrom: todayIso(),
      showAddCategory: false,
      newCategoryName: '',
      newCategoryColor: DEFAULT_NEW_EXPENSE_CATEGORY_COLOR,
    }),
    [categories]
  )
  const [form, setForm] = useState(buildInitialForm)
  const updateField = <K extends keyof ReturnType<typeof buildInitialForm>>(key: K, value: ReturnType<typeof buildInitialForm>[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const [rates, setRates] = useState<Record<ForeignCurrency, number> | null>(null)
  const ratesFetchedRef = useRef(false)

  useEffect(() => {
    if (!isOpen || ratesFetchedRef.current) return
    ratesFetchedRef.current = true
    fetchExchangeRates()
      .then((res) => setRates(res.rates))
      .catch(() => setRates(null))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (editing) {
      const currency = editing.currency ?? 'PLN'
      const displayAmount =
        currency !== 'PLN' && editing.originalAmount != null ? editing.originalAmount : editing.amount
      setForm({
        name: leadingUpperPl(editing.name),
        amount: String(displayAmount),
        currency,
        category: editing.category,
        dayOfMonthStr: String(editing.dayOfMonth),
        paymentMethod:
          editing.paymentMethod && isPaymentMethod(editing.paymentMethod) ? editing.paymentMethod : '',
        note: editing.note ?? '',
        amountEffectiveFrom: todayIso(),
        showAddCategory: false,
        newCategoryName: '',
        newCategoryColor: DEFAULT_NEW_EXPENSE_CATEGORY_COLOR,
      })
    } else {
      setForm(buildInitialForm())
    }
  }, [isOpen, editing, buildInitialForm])

  const { name, amount, currency, category, dayOfMonthStr, paymentMethod, note, amountEffectiveFrom, showAddCategory, newCategoryName, newCategoryColor } = form

  const amountChanged = useMemo(() => {
    if (!editing) return false
    const prevCurrency = editing.currency ?? 'PLN'
    const prevAmount =
      prevCurrency !== 'PLN' && editing.originalAmount != null ? editing.originalAmount : editing.amount
    return currency !== prevCurrency || parseFloat(amount) !== prevAmount
  }, [editing, amount, currency])

  const convertedPreview = useMemo(() => {
    if (currency === 'PLN') return null
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return null
    return convertToPln(amt, currency, rates)
  }, [amount, currency, rates])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    const day = parseInt(dayOfMonthStr.trim(), 10)
    const displayName = leadingUpperPl(name)
    if (!displayName || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 31) return
    if (!isPaymentMethod(paymentMethod)) {
      alert(t('transactionModal.selectPaymentAlert'))
      return
    }
    const payload: RecurringFormPayload = {
      name: displayName,
      amount: amt,
      currency,
      convertedAmount: currency === 'PLN' ? amt : convertToPln(amt, currency, rates),
      category: category || EXPENSE_CATEGORY_NONE,
      dayOfMonth: day,
      paymentMethod,
      note: note.trim() ? note.trim() : null,
      ...(amountChanged && amountEffectiveFrom ? { amountEffectiveFrom } : {}),
    }
    if (editing && onUpdate) {
      await onUpdate(editing.id, payload)
    } else {
      await onSubmit(payload)
    }
    onClose()
  }

  const isEdit = Boolean(editing)

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      backdropKey="recurring-backdrop"
      panelKey="recurring-panel"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-(--text-primary) font-display">
          {isEdit ? t('transactions.editRecurring') : t('recurringModal.newTitle')}
        </h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors"
          aria-label={t('common:close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-base text-(--text-muted) font-display mb-1">{t('transactionModal.nameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              const v = e.target.value
              updateField('name', v.length ? v[0].toLocaleUpperCase('pl-PL') + v.slice(1) : '')
            }}
            required
            autoFocus={!isEdit}
            className="w-full px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-display focus:border-(--accent) focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base text-(--text-muted) font-display mb-1">{t('transactionModal.amountLabel')}</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => updateField('amount', e.target.value)}
                required
                className="no-spinners w-full min-w-0 flex-1 px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-display focus:border-(--accent) focus:outline-none"
              />
              <select
                value={currency}
                onChange={(e) => updateField('currency', e.target.value as Currency)}
                aria-label={t('recurringModal.currencyLabel')}
                className="shrink-0 rounded-lg bg-(--bg-dark) border border-(--border) px-2.5 py-2.5 text-base font-display text-(--text-primary) focus:border-(--accent) focus:outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {currency !== 'PLN' && (
              <p className="mt-1.5 text-sm text-(--text-muted)">
                {convertedPreview != null
                  ? t('recurringModal.convertedPreview', { amount: formatCurrencyAmount(convertedPreview, 'PLN') })
                  : t('recurringModal.ratesUnavailable')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-base text-(--text-muted) font-display mb-1">{t('recurringModal.dayOfMonthLabel')}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={dayOfMonthStr}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
                updateField('dayOfMonthStr', digits)
              }}
              placeholder=""
              required
              className="no-spinners w-full px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-display focus:border-(--accent) focus:outline-none"
            />
          </div>
        </div>
        {amountChanged && (
          <div>
            <label htmlFor="recurring-effective-from" className="block text-base text-(--text-muted) font-display mb-1">
              {t('recurringModal.effectiveFromLabel')}
            </label>
            <input
              id="recurring-effective-from"
              type="date"
              value={amountEffectiveFrom}
              onChange={(e) => updateField('amountEffectiveFrom', e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-display focus:border-(--accent) focus:outline-none"
            />
            <p className="mt-1.5 text-sm text-(--text-muted)">{t('recurringModal.effectiveFromHint')}</p>
          </div>
        )}
        <ExpenseCategoryPicker
          categories={categories}
          category={category}
          onCategoryChange={(v) => updateField('category', v)}
          onDeleteCategory={onDeleteCategory}
          onAddCategory={onAddCategory}
          showAddCategory={showAddCategory}
          setShowAddCategory={(v) => updateField('showAddCategory', v)}
          newCategoryName={newCategoryName}
          setNewCategoryName={(v) => updateField('newCategoryName', v)}
          newCategoryColor={newCategoryColor}
          setNewCategoryColor={(v) => updateField('newCategoryColor', v)}
          onAddedCategory={(normalized) => updateField('category', normalized)}
        />
        <PaymentMethodPicker
          value={paymentMethod}
          onChange={(method) => updateField('paymentMethod', method)}
          id="recurring-payment"
        />
        <div>
          <label className="block text-base text-(--text-muted) font-display mb-1">
            {t('transactionModal.noteLabel')}
          </label>
          <textarea
            value={note}
            onChange={(e) => updateField('note', e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t('transactionModal.notePlaceholder')}
            className="w-full px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base focus:border-(--accent) focus:outline-none resize-y"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-(--border) text-(--text-muted) font-display hover:text-(--text-primary)"
          >
            {t('common:cancel')}
          </button>
          <button
            type="submit"
            disabled={!isPaymentMethod(paymentMethod)}
            className="px-4 py-2 rounded-lg bg-(--warning)/15 text-(--warning) border border-(--warning)/40 font-display hover:bg-(--warning)/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEdit ? t('transactions.saveChanges') : t('common:save')}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
