import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';

export type SupportedLanguage = 'en' | 'hi';
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'hi'];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function languageFromPathname(pathname: string): SupportedLanguage {
  return pathname === '/hi' || pathname.startsWith('/hi/') ? 'hi' : DEFAULT_LANGUAGE;
}

// Determined synchronously (not via a language-detector plugin) so the
// correct language is active before the first render, avoiding a flash of
// English on a direct /hi/... load.
const initialLanguage =
  typeof window !== 'undefined' ? languageFromPathname(window.location.pathname) : DEFAULT_LANGUAGE;

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18next;
