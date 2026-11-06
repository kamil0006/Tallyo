import { useTranslation } from 'react-i18next'
import type { TodoDueLabels } from './todoDomain'

/** Localized labels for formatTodoDueSummary, following the current UI language. */
export function useTodoDueLabels(): TodoDueLabels {
  const { t, i18n } = useTranslation('todo')
  return {
    locale: i18n.language === 'pl' ? 'pl-PL' : 'en-US',
    today: t('dueSummary.today'),
    tomorrow: t('dueSummary.tomorrow'),
    none: t('dueSummary.none'),
  }
}
