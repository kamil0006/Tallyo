import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Settings as SettingsIcon, X, Download, Upload, AlertTriangle, Languages } from 'lucide-react'
import { ModalShell } from './ModalShell'
import { ConfirmDialog } from './ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { backupApi } from '../lib/api/backupApi'
import { queryKeys } from '../lib/queryKeys'
import { queryClient } from '../lib/queryClient'

const STALE_AFTER_DAYS = 14

function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

const KNOWN_ERROR_CODES = ['NO_USER', 'INVALID_BACKUP_FILE', 'INVALID_ACCOUNT_REFERENCE', 'INVALID_HABIT_REFERENCE', 'IMPORT_FAILED'] as const

function resolveErrorMessage(e: unknown, t: (key: string) => string, fallbackKey: string): string {
  const code = e instanceof Error ? e.message : ''
  if ((KNOWN_ERROR_CODES as readonly string[]).includes(code)) {
    return t(`errorCode.${code}`)
  }
  return code || t(fallbackKey)
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function SettingsModal() {
  const { t, i18n } = useTranslation('settings')
  const { isOpen, close } = useSettings()
  const { user, isDemoMode } = useAuth()
  const userId = user?.id ?? ''
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exportBusy, setExportBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<unknown>(null)
  const [importBusy, setImportBusy] = useState(false)

  const statusQuery = useQuery({
    queryKey: queryKeys.backupStatus(userId),
    queryFn: () => backupApi.status(),
    enabled: isOpen && !isDemoMode && !!userId,
  })

  const handleExport = async () => {
    setError(null)
    setSuccessMsg(null)
    setExportBusy(true)
    try {
      const backup = await backupApi.export()
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(backup, `tallyo-backup-${date}.json`)
      setSuccessMsg(t('exportSuccess'))
      await queryClient.invalidateQueries({ queryKey: queryKeys.backupStatus(userId) })
    } catch (e) {
      setError(resolveErrorMessage(e, t, 'exportError'))
    } finally {
      setExportBusy(false)
    }
  }

  const handleFilePicked = async (file: File) => {
    setError(null)
    setSuccessMsg(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setPendingImport(parsed)
    } catch {
      setError(t('fileReadError'))
    }
  }

  const handleConfirmImport = async () => {
    setImportBusy(true)
    setError(null)
    try {
      await backupApi.import(pendingImport)
      queryClient.clear()
      window.location.reload()
    } catch (e) {
      setError(resolveErrorMessage(e, t, 'importError'))
      setImportBusy(false)
    }
  }

  const lastBackupAt = statusQuery.data?.lastBackupAt ?? null
  const stale = daysSince(lastBackupAt) > STALE_AFTER_DAYS
  const dateLocale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'

  return (
    <>
      <ModalShell isOpen={isOpen} onClose={close} maxWidth="max-w-lg" backdropKey="settings-backdrop" panelKey="settings-panel">
        <div className="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-(--accent)/45 to-transparent" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="h-5 w-5 text-(--accent)" />
            <h3 className="text-lg font-bold font-display tracking-wide text-(--text-primary)">{t('title')}</h3>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg p-2 text-(--text-muted) transition-colors hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
            aria-label={t('closeAria')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="mb-6">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
            <Languages className="h-3.5 w-3.5" />
            {t('languageSection')}
          </h4>
          <div className="flex gap-2">
            {(['pl', 'en'] as const).map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => void i18n.changeLanguage(lng)}
                className={`flex-1 rounded-lg border py-2.5 font-display transition-colors ${
                  i18n.language === lng
                    ? 'border-(--accent)/45 bg-(--accent)/15 text-(--accent)'
                    : 'border-(--border) text-(--text-muted) hover:bg-(--bg-card-hover) hover:text-(--text-primary)'
                }`}
              >
                {lng === 'pl' ? t('languagePolish') : t('languageEnglish')}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-(--text-muted)">{t('backupSection')}</h4>

          {isDemoMode ? (
            <p className="rounded-lg border border-(--border) bg-(--bg-dark) p-3 text-sm text-(--text-muted)">
              {t('demoUnavailable')}
            </p>
          ) : (
            <div className="space-y-3">
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  stale
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-(--border) bg-(--bg-dark) text-(--text-muted)'
                }`}
              >
                {stale && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>
                  {lastBackupAt
                    ? t('lastBackup', { date: new Date(lastBackupAt).toLocaleString(dateLocale) })
                    : t('neverBackedUp')}
                  {stale && t('staleWarning')}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  disabled={exportBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-(--accent)/45 bg-(--accent)/15 py-2.5 font-display text-(--accent) transition-colors hover:bg-(--accent)/25 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exportBusy ? t('exportButtonBusy') : t('exportButton')}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-(--border) py-2.5 font-display text-(--text-muted) transition-colors hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
                >
                  <Upload className="h-4 w-4" />
                  {t('importButton')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void handleFilePicked(file)
                  }}
                />
              </div>

              {error && <p className="text-sm text-[#e74c3c]">{error}</p>}
              {successMsg && <p className="text-sm text-(--positive,#2ecc71)">{successMsg}</p>}
            </div>
          )}
        </section>
      </ModalShell>

      <ConfirmDialog
        isOpen={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title={t('confirmTitle')}
        emphasis={t('confirmEmphasis')}
        description={t('confirmDescription')}
        variant="danger"
        confirmLabel={importBusy ? t('confirmLabelBusy') : t('confirmLabel')}
        onConfirm={handleConfirmImport}
        zBackdrop={10020}
        zPanel={10021}
      />
    </>
  )
}
