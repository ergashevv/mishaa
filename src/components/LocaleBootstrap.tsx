'use client';

import { useEffect } from 'react';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { UI_LANG_COOKIE } from '@/lib/i18n/cookies';
import { isUiLang } from '@/lib/i18n/lang';
import { persistUiLangCookie, readBrowserCookie } from '@/lib/i18n/ui-lang-cookie-client';
import { uiLangToPreferredMangaLanguage } from '@/lib/i18n/ui-lang-to-manga';
import type { Lang } from '@/lib/translations';
import { MANGA_LANGUAGE_CHANGE_EVENT, persistStoredMangaLanguage } from '@/lib/manga-language';

/**
 * First-visit: `localStorage.lang` is empty but middleware may have set `ics_ui_lang` from geo.
 * Rehydrate client language + default chapter language to match. Keeps cookie aligned when storage wins.
 *
 * Also listens to langChange/mangaLanguageChange events (dispatched from ZineNav, settings, etc.)
 * and triggers a full page reload to ensure server components re-render with the new cookie value.
 */
export default function LocaleBootstrap() {
  useEffect(() => {
    const stored = readStorageItem('lang') as Lang | null;
    const cookieRaw = readBrowserCookie(UI_LANG_COOKIE);

    if (!stored && cookieRaw && isUiLang(cookieRaw)) {
      writeStorageItem('lang', cookieRaw);
      persistStoredMangaLanguage(uiLangToPreferredMangaLanguage(cookieRaw));
      window.dispatchEvent(new CustomEvent('langChange', { detail: cookieRaw }));
      return;
    }

    if (stored && isUiLang(stored)) {
      persistUiLangCookie(stored);
      return;
    }

    if (!stored && (!cookieRaw || !isUiLang(cookieRaw))) {
      writeStorageItem('lang', 'en');
      persistUiLangCookie('en');
      persistStoredMangaLanguage('en');
      window.dispatchEvent(new CustomEvent('langChange', { detail: 'en' }));
    }
  }, []);

  useEffect(() => {
    const handleReload = () => {
      window.location.reload();
    };
    window.addEventListener('langChange', handleReload as EventListener);
    window.addEventListener(MANGA_LANGUAGE_CHANGE_EVENT, handleReload as EventListener);
    return () => {
      window.removeEventListener('langChange', handleReload as EventListener);
      window.removeEventListener(MANGA_LANGUAGE_CHANGE_EVENT, handleReload as EventListener);
    };
  }, []);

  return null;
}
