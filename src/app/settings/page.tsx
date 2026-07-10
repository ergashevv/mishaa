'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { htmlLangFromUiLang } from '@/lib/i18n/lang';
import {
  Settings as SettingsIcon,
  Bookmark,
  ChevronDown,
  Clock3,
  Shield,
  Mail,
  MessageCircle,
  Trash2,
  Languages,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { translations, type Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import {
  MANGA_LANGUAGE_OPTIONS,
  type MangaLanguage,
  persistStoredMangaLanguage,
  readStoredMangaLanguage,
} from '@/lib/manga-language';
import { persistUiLangCookie } from '@/lib/i18n/ui-lang-cookie-client';
import { uiLangToPreferredMangaLanguage } from '@/lib/i18n/ui-lang-to-manga';
import { clearAgeVerification, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import {
  BOOKMARKS_STORAGE_KEY,
  LIBRARY_ACTIVITY_EVENT,
  clearReadingHistory,
  readBookmarks,
  readRecentHistoryItems,
} from '@/lib/library-storage';

export default function SettingsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>('en');
  const [ageEnabled, setAgeEnabled] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [recentItems, setRecentItems] = useState<ReturnType<typeof readRecentHistoryItems>>([]);

  const s = translations[lang].settings;

  useEffect(() => {
    const sync = () => {
      setBookmarkCount(readBookmarks().length);
      setHistoryCount(readRecentHistoryItems(100).length);
      setRecentItems(readRecentHistoryItems(6));
      setAgeEnabled(readAgeVerification());
      setMangaLanguage(readStoredMangaLanguage());
    };

    const savedLang = readStorageItem('lang') as Lang;
    const timer = window.setTimeout(() => {
      if (savedLang && translations[savedLang]) setLang(savedLang);
      sync();
    }, 0);

    const onLang = (event: Event) => {
      const next = (event as CustomEvent<Lang>).detail;
      if (next && translations[next]) setLang(next);
      // The Navbar switcher also overwrites the stored manga language; re-read it.
      sync();
    };

    window.addEventListener(LIBRARY_ACTIVITY_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('langChange', onLang as EventListener);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('langChange', onLang as EventListener);
    };
  }, []);

  const applyLang = (nextLang: Lang) => {
    const nextMangaLanguage = uiLangToPreferredMangaLanguage(nextLang);
    setLang(nextLang);
    writeStorageItem('lang', nextLang);
    persistUiLangCookie(nextLang);
    persistStoredMangaLanguage(nextMangaLanguage);
    // Keep the on-screen manga-language select in sync with the overwrite above.
    setMangaLanguage(nextMangaLanguage);
    window.dispatchEvent(new Event(LIBRARY_ACTIVITY_EVENT));
    window.dispatchEvent(new CustomEvent('langChange', { detail: nextLang }));
    // Flip <html lang> immediately, then re-render the server tree from the new cookie.
    if (typeof document !== 'undefined') {
      document.documentElement.lang = htmlLangFromUiLang(nextLang);
    }
    router.refresh();
  };

  const applyMangaLanguage = (nextLanguage: MangaLanguage) => {
    setMangaLanguage(nextLanguage);
    persistStoredMangaLanguage(nextLanguage);
    window.dispatchEvent(new Event(LIBRARY_ACTIVITY_EVENT));
  };

  const enableAdultContent = () => {
    persistAgeVerification();
    setAgeEnabled(true);
  };

  const disableAdultContent = () => {
    clearAgeVerification();
    setAgeEnabled(false);
  };

  const clearLibraryData = async () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(BOOKMARKS_STORAGE_KEY);
    clearReadingHistory();

    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json().catch(() => null);
      if (meData?.user) {
        await fetch('/api/reading-progress', { method: 'DELETE' });
      }
    } catch (error) {
      console.error('Failed to clear cloud reading progress:', error);
    }
  };

  const interfaceLangButtons: { code: Lang; label: string }[] = [
    { code: 'en', label: s.langEnglish },
    { code: 'ja', label: s.langJapanese },
    { code: 'ko', label: s.langKorean },
    { code: 'zh', label: s.langChinese },
    { code: 'ru', label: s.langRussian },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <LazyMotion features={domAnimation} strict>
        <m.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          className="wrap max-w-6xl py-14 sm:py-16 lg:py-20"
        >
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <SettingsIcon size={14} className="text-accent" />
              <span className="ic-eyebrow">{s.eyebrow}</span>
            </div>
            <h1 className="ic-display text-4xl sm:text-5xl md:text-6xl">
              {s.titleLine1}{' '}
              <span className="text-accent-text">{s.titleAccent}</span>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-fg-secondary md:text-[1rem]">{s.intro}</p>
          </section>

          {/* Preferences - grouped rows with hairline dividers, not three
              identical bordered boxes. */}
          <div className="section">
            <div className="section__head">
              <div className="section__titles">
                <h2 className="section__heading">{s.sectionPreferences}</h2>
              </div>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              <div className="grid gap-4 py-6 first:pt-0 sm:grid-cols-[200px_1fr] sm:items-start">
                <div className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Languages size={16} className="text-accent-text" />
                  {s.interfaceLang}
                </div>
                <div className="flex flex-wrap gap-2">
                  {interfaceLangButtons.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={lang === code}
                      onClick={() => applyLang(code)}
                      className={`ic-tag ic-tag--interactive ${lang === code ? 'border-transparent bg-accent-tint text-accent-text' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 py-6 sm:grid-cols-[200px_1fr] sm:items-center">
                <div className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Bookmark size={16} className="text-accent-text" />
                  {s.mangaLang}
                </div>
                <div className="ic-select-wrap max-w-xs">
                  <select
                    value={mangaLanguage}
                    onChange={(event) => applyMangaLanguage(event.target.value as MangaLanguage)}
                    className="ic-select"
                  >
                    {MANGA_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </div>

              <div className="grid gap-4 py-6 last:pb-0 sm:grid-cols-[200px_1fr] sm:items-center">
                <div className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Shield size={16} className="text-accent-text" />
                  {s.contentSafety}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-md text-sm leading-relaxed text-fg-secondary">
                    {ageEnabled ? s.adultEnabled : s.adultDisabled}
                  </p>
                  <label className="flex items-center gap-3">
                    <span className="text-sm font-medium text-fg-secondary">
                      {ageEnabled ? s.disable18 : s.enable18}
                    </span>
                    <span className="ic-switch">
                      <input
                        type="checkbox"
                        checked={ageEnabled}
                        onChange={(event) => (event.target.checked ? enableAdultContent() : disableAdultContent())}
                      />
                      <span className="ic-switch__track" />
                      <span className="ic-switch__thumb" />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Your library - stat pair reads as an editorial moment instead of a
              mono side-note; the recent-reads shelf reuses the same cont-card
              component the home page uses for continue-reading. */}
          <div className="section">
            <div className="section__head">
              <div className="section__titles">
                <h2 className="section__heading">{s.savedDataTitle}</h2>
              </div>
              <div className="flex items-end gap-8">
                <div>
                  <div className="ic-display text-3xl leading-none text-accent-text">{bookmarkCount}</div>
                  <div className="ic-eyebrow mt-1">{s.bookmarksCount.replace('{count}', '').trim()}</div>
                </div>
                <div>
                  <div className="ic-display text-3xl leading-none">{historyCount}</div>
                  <div className="ic-eyebrow mt-1">{s.readsCount.replace('{count}', '').trim()}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/library" className="ic-btn ic-btn--primary ic-btn--md">
                {s.openLibrary}
              </Link>
              <button type="button" onClick={clearLibraryData} className="ic-btn ic-btn--danger ic-btn--md">
                <Trash2 size={14} />
                {s.clearData}
              </button>
            </div>

            {recentItems.length > 0 && (
              <div className="mt-8 border-t border-line-subtle pt-8">
                <div className="mb-4 flex items-center gap-2">
                  <Clock3 size={16} className="text-accent-text" />
                  <h3 className="text-sm font-semibold text-fg">{s.recentReads}</h3>
                </div>
                <div className="continue">
                  {recentItems.map((item) => (
                    <Link key={`${item.source}:${item.id}`} href={item.href} className="cont-card">
                      <span className="cont-card__thumb">
                        <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                      </span>
                      <span className="cont-card__body">
                        <span className="cont-card__title">{item.title}</span>
                        <span className="cont-card__ch">{item.chapterTitle || s.continueReadingChip}</span>
                        {typeof item.progressPercent === 'number' && (
                          <span className="ic-progress">
                            <span
                              className="ic-progress__fill block"
                              style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                            />
                          </span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Support */}
          <div className="section">
            <div className="section__head">
              <div className="section__titles">
                <h2 className="section__heading">{s.reportSectionTitle}</h2>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-fg-secondary">{s.reportSectionBody}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/support" className="ic-btn ic-btn--primary ic-btn--md">
                <MessageCircle size={14} />
                {s.openSupportForm}
              </Link>
              <a
                href="mailto:info@icomics.wiki?subject=iComics%20Support%20Report"
                className="ic-btn ic-btn--secondary ic-btn--md"
              >
                <Mail size={14} />
                {s.emailSupport}
              </a>
              <a href="https://t.me/icomicsuz" target="_blank" rel="noreferrer" className="ic-btn ic-btn--secondary ic-btn--md">
                {s.telegramDispatch}
              </a>
              <Link href="/profile" className="ic-btn ic-btn--ghost ic-btn--md">
                {s.accountProfile}
              </Link>
            </div>
          </div>
        </m.div>
        </LazyMotion>
      </main>

      <Footer />
    </div>
  );
}
