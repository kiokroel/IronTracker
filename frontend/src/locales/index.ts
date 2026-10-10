import { en, type TranslationDictionary } from './en';
import { ru } from './ru';

export type Locale = 'ru' | 'en';

export const dictionaries: Record<Locale, TranslationDictionary> = {
  en,
  ru,
};

type Prev = [never, 0, 1, 2, 3];

export type Paths<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends (...args: unknown[]) => unknown
        ? never
        : T[K] extends object
        ? `${K}` | `${K}.${Paths<T[K], Prev[D]>}`
        : `${K}`;
    }[keyof T & (string | number)]
  : never;

export type TranslationKey = Paths<TranslationDictionary>;

export { en, ru };
