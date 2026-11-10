import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ModalShell } from './ModalShell'
import { ExpenseCategoryPicker, DEFAULT_NEW_EXPENSE_CATEGORY_COLOR } from './finance/ExpenseCategoryPicker'
import { PaymentMethodPicker } from './finance/PaymentMethodPicker'
import { EXPENSE_CATEGORY_NONE } from '../lib/expenseCategoryConstants'
import type { PaymentMethod } from '../lib/paymentMethod'
import { isPaymentMethod } from '../lib/paymentMethod'

export type TransactionFormPayload = {
  name: string
  amount: number
  category?: string
  date: string
  paymentMethod: PaymentMethod
  note?: string | null
}

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TransactionFormPayload) => void | Promise<void>
  type: 'income' | 'expense'
  categories: { id: string; name: string; label: string; color: string }[]
  onAddCategory?: (name: string, color: string) => Promise<void>
  onDeleteCategory?: (id: string) => Promise<void>
  initialData?: {
    name: string
    amount: number
    category?: string
    date: string
    paymentMethod?: PaymentMethod | null
    note?: string | null
  } | null
  submitLabel?: string
  title?: string
  /** Short explanation shown under the title. */
  hint?: string
}

export function TransactionModal({
  isOpen,
  onClose,
  onSubmit,
  type,
  categories,
  onAddCategory,
  onDeleteCategory,
  initialData,
  submitLabel,
  title,
  hint,
}: TransactionModalProps) {
  const { t } = useTranslation('finances')
  const initialDataKey =
    initialData == null
      ? 'new'
      : `${initialData.name}\t${initialData.amount}\t${initialData.date}\t${initialData.category ?? ''}\t${initialData.paymentMethod ?? ''}\t${initialData.note ?? ''}`

  const formDefaults = (
    cats: typeof categories,
    init: typeof initialData
  ): {
    name: string
    amount: string
    category: string
    date: string
    paymentMethod: PaymentMethod | ''
    note: string
    showAddCategory: boolean
    newCategoryName: string
    newCategoryColor: string
  } => {
    const raw = init?.category ?? EXPENSE_CATEGORY_NONE
    const category =
      raw === EXPENSE_CATEGORY_NONE || cats.some((c) => c.name === raw) ? raw : EXPENSE_CATEGORY_NONE
    const paymentMethod =
      init?.paymentMethod && isPaymentMethod(init.paymentMethod) ? init.paymentMethod : ''
    return {
      name: init?.name ?? '',
      amount: init?.amount != null ? String(init.amount) : '',
      category,
      date: init?.date ?? new Date().toISOString().split('T')[0],
      paymentMethod,
      note: init?.note ?? '',
      showAddCategory: false,
      newCategoryName: '',
      newCategoryColor: DEFAULT_NEW_EXPENSE_CATEGORY_COLOR,
    }
  }

  const [form, setForm] = useState(() => formDefaults(categories, initialData))
  type FormState = typeof form
  const formRef = useRef(form)
  formRef.current = form

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const wasOpenRef = useRef(false)
  const prevTypeRef = useRef(type)
  const prevInitialKeyRef = useRef(initialDataKey)

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true

    const typeChanged = prevTypeRef.current !== type
    prevTypeRef.current = type

    const initialChanged = prevInitialKeyRef.current !== initialDataKey
    prevInitialKeyRef.current = initialDataKey

    if (justOpened || typeChanged || initialChanged) {
      setForm(formDefaults(categories, initialData))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type, initialDataKey])

  const { name, amount, category, date, paymentMethod, note, showAddCategory, newCategoryName, newCategoryColor } = form

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const f = formRef.current
    const normalized = String(f.amount).replace(/\s/g, '').replace(',', '.')
    const amt = parseFloat(normalized)
    if (!f.name.trim() || isNaN(amt)) return
    if (!isPaymentMethod(f.paymentMethod)) {
      alert(t('transactionModal.selectPaymentAlert'))
      return
    }
    try {
      await Promise.resolve(
        onSubmit({
          name: f.name.trim(),
          amount: amt,
          category: f.category || EXPENSE_CATEGORY_NONE,
          date: f.date,
          paymentMethod: f.paymentMethod,
          note: f.note.trim() ? f.note.trim() : null,
        })
      )
      onClose()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : t('transactionModal.saveFailedAlert'))
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      backdropKey="transaction-backdrop"
      panelKey="transaction-panel"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-(--text-primary) font-display">
          {title ?? (type === 'income' ? t('transactionModal.newIncomeTitle') : t('transactionModal.newExpenseTitle'))}
        </h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors"
          aria-label={t('common:close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {hint && <p className="-mt-2 mb-4 text-sm text-(--text-muted)">{hint}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-base text-(--text-muted) font-display mb-1">
            {type === 'income' ? t('transactionModal.sourceLabel') : t('transactionModal.nameLabel')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => updateField('name', e.target.value)}
            required
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-display focus:border-(--accent) focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-base text-(--text-muted) font-display mb-1">{t('transactionModal.dateLabel')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => updateField('date', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-display focus:border-(--accent) focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-base text-(--text-muted) font-display mb-1">{t('transactionModal.amountLabel')}</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => updateField('amount', e.target.value)}
            required
            className="no-spinners w-full px-4 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-display focus:border-(--accent) focus:outline-none"
          />
        </div>
        <PaymentMethodPicker
          value={paymentMethod}
          onChange={(method) => updateField('paymentMethod', method)}
        />
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
            className="px-4 py-2 rounded-lg bg-(--accent) text-(--bg-dark) font-display hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitLabel ?? t('common:save')}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
