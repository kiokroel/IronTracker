import { create } from 'zustand';
import { dictionaries, type Locale, type TranslationKey } from '@/locales';

const LOCALE_STORAGE_KEY = 'irontracker_locale';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const detectInitialLocale = (): Locale => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') {
      return saved;
    }
  }
  if (typeof navigator !== 'undefined') {
    const browserLang = (navigator.language || '').toLowerCase();
    return browserLang.startsWith('ru') ? 'ru' : 'en';
  }
  return 'ru';
};

const resolvePath = (obj: unknown, path: string): string | undefined => {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
};

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => {
    return varName in params ? String(params[varName]) : `{{${varName}}}`;
  });
};

export const useLocaleStore = create<LocaleState>((set, get) => {
  const initialLocale = detectInitialLocale();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = initialLocale;
  }

  return {
    locale: initialLocale,

    setLocale: (nextLocale: Locale) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.lang = nextLocale;
      }
      set({ locale: nextLocale });
    },

    toggleLocale: () => {
      const current = get().locale;
      const next: Locale = current === 'ru' ? 'en' : 'ru';
      get().setLocale(next);
    },

    t: (key: TranslationKey, params?: Record<string, string | number>): string => {
      const currentLocale = get().locale;
      const dict = dictionaries[currentLocale] || dictionaries.en;
      let text = resolvePath(dict, key);

      // Fallback to English if not found
      if (text === undefined && currentLocale !== 'en') {
        text = resolvePath(dictionaries.en, key);
      }

      if (text === undefined) {
        return key;
      }

      return interpolate(text, params);
    },
  };
});
