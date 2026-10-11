import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import en from './locales/en.json'

export const LANGUAGES = ['ar', 'en']
export const DEFAULT_LANGUAGE = 'ar'
const STORAGE_KEY = 'clinic.lang'

/** The saved choice, or Arabic (§7.3). */
export function savedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

/** <html lang dir> follow the language so the whole page flips for Arabic. */
function applyToDocument(language) {
  document.documentElement.lang = language
  document.documentElement.dir = i18next.dir(language)
}

i18next.on('languageChanged', (language) => {
  applyToDocument(language)
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // The choice just won't survive a reload.
  }
})

i18next.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false,
})

applyToDocument(i18next.language)

export default i18next
