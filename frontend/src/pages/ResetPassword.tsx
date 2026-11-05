import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { authApi } from '../lib/api'

export function ResetPassword() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== passwordConfirm) {
      setError(t('passwordsMustMatch'))
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, newPassword)
      setSuccess(t('passwordResetSuccess'))
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unexpectedError'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--bg-dark) p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <h1 className="text-4xl font-bold font-display tracking-widest text-center mb-8">
          <span className="text-(--accent)">Tally</span>
          <span className="text-(--text-primary)">o</span>
        </h1>
        <div className="rounded-lg border border-(--border) bg-(--bg-card) p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--accent)/50 to-transparent" />
          <p className="text-base text-(--text-muted) mb-4 font-display tracking-wide">
            {t('setNewPasswordPrompt')}
          </p>

          {!token ? (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
              {t('resetLinkInvalid')}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3 rounded-lg bg-green-500/10 text-green-400 text-sm"
                  >
                    {success}
                  </motion.div>
                )}
              </AnimatePresence>
              <div>
                <label className="block text-base text-(--text-muted) mb-1">{t('newPassword')}</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setError('')
                    }}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 pr-11 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base focus:border-(--accent) focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-(--text-muted) hover:text-(--accent) transition-colors"
                    tabIndex={-1}
                    aria-label={showNewPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm text-(--text-muted) mt-1">{t('passwordHint')}</p>
              </div>
              <div>
                <label className="block text-base text-(--text-muted) mb-1">{t('confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value)
                      setError('')
                    }}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 pr-11 rounded-lg bg-(--bg-dark) border border-(--border) text-(--text-primary) text-base focus:border-(--accent) focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-(--text-muted) hover:text-(--accent) transition-colors"
                    tabIndex={-1}
                    aria-label={showPasswordConfirm ? t('hidePassword') : t('showPassword')}
                  >
                    {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <motion.button
                type="submit"
                disabled={loading || Boolean(success)}
                className="w-full py-3 rounded-lg bg-(--accent)/15 text-(--accent) border border-(--accent)/40 font-display tracking-wider hover:bg-(--accent)/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                whileHover={!loading ? { scale: 1.01 } : undefined}
                whileTap={!loading ? { scale: 0.99 } : undefined}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>{t('resettingPassword')}</span>
                  </>
                ) : (
                  t('resetPasswordButton')
                )}
              </motion.button>
            </form>
          )}

          <Link
            to="/login"
            className="block w-full mt-4 text-sm text-center text-(--text-muted) hover:text-(--accent) transition-colors"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
