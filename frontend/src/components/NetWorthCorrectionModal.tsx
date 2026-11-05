import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ModalShell } from './ModalShell'
import {
  getNetWorthAccountIcon,
  getNetWorthAccountIconKey,
  NW_ASSET_ICON_OPTIONS,
  NW_LIABILITY_ICON_OPTIONS,
} from '../lib/netWorthAccountIcons'
import {
  DEFAULT_NW_ASSET_ACCENT_KEY,
  getNwAssetAccentClasses,
  NW_ASSET_ACCENT_OPTIONS,
  normalizeNwAssetAccentKey,
} from '../lib/netWorthAssetAccent'
import { formatNumberPl } from '../lib/currency'

export type NetWorthCorrectionAccountRef = {
  id: string
  name: string
  kind: 'asset' | 'liability'
  iconKey?: string
  accentKey?: string
}

export interface NetWorthCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  account: NetWorthCorrectionAccountRef | null
  currentBalance: number
  onSubmit: (data: {
    amount: number
    description: string
    iconKey: string
    accentKey: string | null
  }) => void | Promise<void>
}

export function NetWorthCorrectionModal({
  isOpen,
  onClose,
  account,
  currentBalance,
  onSubmit,
}: NetWorthCorrectionModalProps) {
  const { t } = useTranslation('finances')
  const [amountStr, setAmountStr] = useState('')
  const [description, setDescription] = useState('')
  const [iconKey, setIconKey] = useState('')
  const [accentKey, setAccentKey] = useState(DEFAULT_NW_ASSET_ACCENT_KEY)

  const accountId = account?.id
  const accountKind = account?.kind
  const accountIconKey = account?.iconKey
  const accountAccentKey = account?.accentKey

  useEffect(() => {
    if (!isOpen || accountId == null || accountKind == null) return
    setAmountStr('')
    setDescription('')
    setIconKey(accountIconKey ?? getNetWorthAccountIconKey(accountKind))
    setAccentKey(
      accountKind === 'asset'
        ? normalizeNwAssetAccentKey(accountAccentKey)
        : DEFAULT_NW_ASSET_ACCENT_KEY
    )
  }, [isOpen, accountId, accountKind, accountIconKey, accountAccentKey])

  const parsedAmount = amountStr.trim() === '' ? 0 : Number(amountStr.replace(',', '.'))
  const amountInvalid = amountStr.trim() !== '' && Number.isNaN(parsedAmount)
  const preview =
    account != null && amountStr.trim() !== '' && !amountInvalid
      ? currentBalance + parsedAmount
      : null

  const iconOptions =
    account?.kind === 'asset' ? NW_ASSET_ICON_OPTIONS : NW_LIABILITY_ICON_OPTIONS

  const defaultIcon = account?.iconKey ?? (account ? getNetWorthAccountIconKey(account.kind) : '')
  const iconChanged = account != null && iconKey !== defaultIcon
  const accentChanged =
    account != null &&
    account.kind === 'asset' &&
    normalizeNwAssetAccentKey(accentKey) !== normalizeNwAssetAccentKey(account.accentKey)

  const hasAmount = parsedAmount !== 0
  const canSubmit =
    account != null && !amountInvalid && (hasAmount || iconChanged || accentChanged)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (account == null || !canSubmit) return
    await onSubmit({
      amount: parsedAmount,
      description: description.trim(),
      iconKey,
      accentKey: account.kind === 'asset' ? accentKey : null,
    })
    onClose()
  }

  if (account == null) return null

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      backdropKey="nw-cor-backdrop"
      panelKey="nw-cor-panel"
    >
              <div className="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-(--accent)/40 to-transparent" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-(--text-primary) font-display">{t('netWorthCorrectionModal.title')}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-(--bg-card-hover) text-(--text-muted) hover:text-(--text-primary) transition-colors"
                  aria-label={t('common:close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-base text-(--text-primary) font-medium mb-1">{account.name}</p>
              <p className="text-base text-(--text-muted) mb-4">
                {t('netWorthCorrectionModal.currentBalanceLine', {
                  kind: account.kind === 'asset' ? t('netWorthCorrectionModal.kindAsset') : t('netWorthCorrectionModal.kindLiability'),
                  balance: formatNumberPl(currentBalance),
                })}
              </p>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                <div>
                  <span className="mb-2 block text-base text-(--text-muted) font-display">{t('netWorthAccountCreateModal.iconLabel')}</span>
                  <div className="flex flex-wrap gap-2">
                    {iconOptions.map(({ key: ik, label }) => {
                      const Icon = getNetWorthAccountIcon(ik)
                      const selected = iconKey === ik
                      return (
                        <button
                          key={ik}
                          type="button"
                          onClick={() => setIconKey(ik)}
                          title={label}
                          aria-label={label}
                          aria-pressed={selected}
                          className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors ${
                            selected
                              ? account.kind === 'asset'
                                ? 'border-(--accent)/55 bg-(--accent)/20 text-(--accent)'
                                : 'border-[#e74c3c]/50 bg-[#e74c3c]/15 text-[#e74c3c]'
                              : 'border-(--border) bg-(--bg-dark) text-(--text-muted) hover:border-(--accent)/35 hover:text-(--text-primary)'
                          }`}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {account.kind === 'asset' ? (
                  <div>
                    <span className="mb-2 block text-base text-(--text-muted) font-display">{t('netWorthAccountCreateModal.colorLabel')}</span>
                    <div className="flex flex-wrap gap-3">
                      {NW_ASSET_ACCENT_OPTIONS.map(({ key: ck, label }) => {
                        const { swatch } = getNwAssetAccentClasses(ck)
                        const selected = accentKey === ck
                        return (
                          <button
                            key={ck}
                            type="button"
                            onClick={() => setAccentKey(ck)}
                            title={label}
                            aria-label={label}
                            aria-pressed={selected}
                            className={`relative h-10 w-10 rounded-full ${swatch} transition-transform ${
                              selected
                                ? 'ring-2 ring-(--text-primary) ring-offset-2 ring-offset-(--bg-card) scale-105'
                                : 'opacity-80 hover:opacity-100 hover:scale-[1.02]'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-(--border)/60 pt-4">
                  <p className="text-sm text-(--text-muted) mb-3">
                    {account.kind === 'asset'
                      ? t('netWorthCorrectionModal.assetAmountHint')
                      : t('netWorthCorrectionModal.liabilityAmountHint')}
                  </p>
                  <label className="block text-base text-(--text-muted) font-display mb-1">{t('netWorthCorrectionModal.correctionAmountLabel')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9,.-]/g, ''))}
                    placeholder={t('netWorthCorrectionModal.amountPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base font-mono focus:border-(--accent) focus:outline-none"
                  />
                </div>
                {preview != null && !Number.isNaN(preview) && (
                  <div className="rounded-lg border border-(--border) bg-(--bg-dark)/50 px-3 py-2">
                    <p className="text-base text-(--text-muted) font-display">{t('netWorthCorrectionModal.afterCorrectionLabel')}</p>
                    <p className="text-base font-mono text-(--text-primary) mt-0.5">
                      {t('netWorth.balanceArrow', { from: formatNumberPl(currentBalance), to: formatNumberPl(preview) })}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-base text-(--text-muted) font-display mb-1">
                    {hasAmount ? t('netWorthCorrectionModal.descriptionLabelWithAmount') : t('netWorthCorrectionModal.descriptionLabelOptional')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={200}
                    placeholder={t('netWorthCorrectionModal.descriptionPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base focus:border-(--accent) focus:outline-none resize-y min-h-[88px]"
                  />
                  <p className="text-base text-(--text-muted) mt-1">{description.length}/200</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg border border-(--border) text-(--text-muted) font-display hover:bg-(--bg-card-hover) transition-colors"
                  >
                    {t('common:cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-lg bg-(--accent)/20 text-(--accent) border border-(--accent)/45 font-display hover:bg-(--accent)/30 transition-colors disabled:opacity-50"
                    disabled={!canSubmit}
                  >
                    {t('transactions.saveChanges')}
                  </button>
                </div>
              </form>
    </ModalShell>
  )
}
