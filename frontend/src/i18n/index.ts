import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import commonPl from './locales/pl/common.json'
import navPl from './locales/pl/nav.json'
import authPl from './locales/pl/auth.json'
import settingsPl from './locales/pl/settings.json'
import dashboardPl from './locales/pl/dashboard.json'
import financesPl from './locales/pl/finances.json'
import todoPl from './locales/pl/todo.json'
import calendarPl from './locales/pl/calendar.json'
import habitsPl from './locales/pl/habits.json'
import notesPl from './locales/pl/notes.json'
import learningPl from './locales/pl/learning.json'
import onboardingPl from './locales/pl/onboarding.json'

import commonEn from './locales/en/common.json'
import navEn from './locales/en/nav.json'
import authEn from './locales/en/auth.json'
import settingsEn from './locales/en/settings.json'
import dashboardEn from './locales/en/dashboard.json'
import financesEn from './locales/en/finances.json'
import todoEn from './locales/en/todo.json'
import calendarEn from './locales/en/calendar.json'
import habitsEn from './locales/en/habits.json'
import notesEn from './locales/en/notes.json'
import learningEn from './locales/en/learning.json'
import onboardingEn from './locales/en/onboarding.json'

export const LANGUAGE_STORAGE_KEY = 'tallyo_language'

export const i18nNamespaces = [
  'common',
  'nav',
  'auth',
  'settings',
  'dashboard',
  'finances',
  'todo',
  'calendar',
  'habits',
  'notes',
  'learning',
  'onboarding',
] as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: {
        common: commonPl,
        nav: navPl,
        auth: authPl,
        settings: settingsPl,
        dashboard: dashboardPl,
        finances: financesPl,
        todo: todoPl,
        calendar: calendarPl,
        habits: habitsPl,
        notes: notesPl,
        learning: learningPl,
        onboarding: onboardingPl,
      },
      en: {
        common: commonEn,
        nav: navEn,
        auth: authEn,
        settings: settingsEn,
        dashboard: dashboardEn,
        finances: financesEn,
        todo: todoEn,
        calendar: calendarEn,
        habits: habitsEn,
        notes: notesEn,
        learning: learningEn,
        onboarding: onboardingEn,
      },
    },
    ns: i18nNamespaces,
    defaultNS: 'common',
    fallbackLng: 'pl',
    supportedLngs: ['pl', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

export default i18n
