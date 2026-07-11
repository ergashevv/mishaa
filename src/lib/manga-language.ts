import { readStorageItem, writeStorageItem } from './browser-storage';

export type MangaLanguage = 'en' | 'ja' | 'ko' | 'ru' | 'es' | 'fr' | 'de' | 'pt-br' | 'zh' | 'zh-hk' | 'th' | 'it' | 'all';

export const MANGA_LANGUAGE_STORAGE_KEY = 'mangaLanguage';
export const DEFAULT_MANGA_LANGUAGE: MangaLanguage = 'en';

/** Fired when the content (manga/chapter) language changes independently of the UI language
 *  (Settings' standalone picker). LocaleBootstrap reloads on this the same way it does for `langChange`. */
export const MANGA_LANGUAGE_CHANGE_EVENT = 'mangaLanguageChange';

export const MANGA_LANGUAGE_OPTIONS: Array<{ value: MangaLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt-br', label: 'Portuguese (BR)' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'zh-hk', label: 'Chinese (Traditional)' },
  { value: 'th', label: 'Thai' },
  { value: 'it', label: 'Italian' },
  { value: 'all', label: 'All languages' },
];

export const readStoredMangaLanguage = (): MangaLanguage => {
  if (typeof window === 'undefined') return DEFAULT_MANGA_LANGUAGE;

  const stored = readStorageItem(MANGA_LANGUAGE_STORAGE_KEY) as MangaLanguage | null;
  return stored && MANGA_LANGUAGE_OPTIONS.some((option) => option.value === stored)
    ? stored
    : DEFAULT_MANGA_LANGUAGE;
};

export const persistStoredMangaLanguage = (language: MangaLanguage) => {
  if (typeof window === 'undefined') return;
  writeStorageItem(MANGA_LANGUAGE_STORAGE_KEY, language);
};

export const getMangaDexTranslatedLanguages = (language: MangaLanguage) => {
  if (language === 'all') return undefined;
  if (language === 'en') return ['en'];
  return [language, 'en'];
};

type LocalizedMap = Record<string, string | undefined> | undefined | null;

export const resolveMangaDexLocalizedText = (values: LocalizedMap, preferredLanguage: MangaLanguage) => {
  if (!values) return '';

  const preferredValue = values[preferredLanguage];
  if (preferredValue) return preferredValue;

  const englishValue = values.en;
  if (englishValue) return englishValue;

  const firstAvailableValue = Object.values(values).find((value): value is string => Boolean(value));
  return firstAvailableValue || '';
};
