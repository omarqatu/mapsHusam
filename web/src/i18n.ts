import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

export type Lang = 'ar' | 'en';
const STORAGE_KEY = 'i18n-language';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return 'ar';
}

function applyDirection(lang: string) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'ar',
  interpolation: { escapeValue: false }, // React escapes
});

applyDirection(i18n.language);
i18n.on('languageChanged', applyDirection);

export function changeLanguage(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(lang);
}

export default i18n;
