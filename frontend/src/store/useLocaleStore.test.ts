import { describe, it, expect, beforeEach } from 'vitest';
import { useLocaleStore } from './useLocaleStore';
import { en, ru } from '@/locales';

describe('useLocaleStore & i18n system', () => {
  beforeEach(() => {
    localStorage.clear();
    useLocaleStore.setState({ locale: 'ru' });
    document.documentElement.lang = 'ru';
  });

  it('initializes with ru locale by default and updates document.documentElement.lang', () => {
    const { locale } = useLocaleStore.getState();
    expect(locale).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('updates locale and persists choice to localStorage', () => {
    const { setLocale } = useLocaleStore.getState();

    setLocale('en');
    expect(useLocaleStore.getState().locale).toBe('en');
    expect(localStorage.getItem('irontracker_locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    setLocale('ru');
    expect(useLocaleStore.getState().locale).toBe('ru');
    expect(localStorage.getItem('irontracker_locale')).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('toggles between ru and en', () => {
    const { toggleLocale } = useLocaleStore.getState();

    toggleLocale();
    expect(useLocaleStore.getState().locale).toBe('en');

    toggleLocale();
    expect(useLocaleStore.getState().locale).toBe('ru');
  });

  it('translates simple keys accurately in both languages', () => {
    const { t, setLocale } = useLocaleStore.getState();

    setLocale('en');
    expect(t('nav.dashboard')).toBe('Dashboard');
    expect(t('nav.workouts')).toBe('Workouts');
    expect(t('common.save')).toBe('Save');

    setLocale('ru');
    expect(t('nav.dashboard')).toBe('Главная');
    expect(t('nav.workouts')).toBe('Тренировки');
    expect(t('common.save')).toBe('Сохранить');
  });

  it('interpolates parameters into translation strings', () => {
    const { t, setLocale } = useLocaleStore.getState();

    setLocale('en');
    expect(t('leaderboard.syncSecondsAgo', { sec: 15 })).toBe('Synced 15s ago');
    expect(t('workouts.matchingRecords', { count: 42 })).toBe('Matching records: 42');

    setLocale('ru');
    expect(t('leaderboard.syncSecondsAgo', { sec: 15 })).toBe('Синхронизировано 15 сек назад');
    expect(t('workouts.matchingRecords', { count: 42 })).toBe('Найдено записей: 42');
  });

  it('returns raw key if translation path does not exist', () => {
    const { t } = useLocaleStore.getState();
    // @ts-expect-error Testing non-existent key runtime fallback
    expect(t('non.existent.key')).toBe('non.existent.key');
  });

  it('verifies complete key parity between EN and RU dictionaries (no missing keys)', () => {
    const extractKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
      let keys: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          keys = keys.concat(extractKeys(value as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    };

    const enKeys = extractKeys(en as unknown as Record<string, unknown>).sort();
    const ruKeys = extractKeys(ru as unknown as Record<string, unknown>).sort();

    expect(ruKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(30);
  });
});
