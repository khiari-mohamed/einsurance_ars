import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from '../locales/fr.json';
import en from '../locales/en.json';
import ar from '../locales/ar.json';
import zh from '../locales/zh.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'ar', 'zh'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
      zh: { translation: zh },
    },
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ars-language',
      caches: ['localStorage'],
    },
  });

export default i18n;