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

  const s = translations[lang].settings;

  useEffect(() => {
    const sync = () => {
      setBookmarkCount(readBookmarks().length);
      setHistoryCount(readRecentHistoryItems(100).length);
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
    setLang(nextLang);
    writeStorageItem('lang', nextLang);
    persistUiLangCookie(nextLang);
    persistStoredMangaLanguage(uiLangToPreferredMangaLanguage(nextLang));
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

      <main className="pt-nav-catalog">
        <LazyMotion features={domAnimation} strict>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          className="wrap max-w-6xl space-y-10 py-14 sm:py-16 lg:py-20"
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
            <p className="max-w-2xl text-sm leading-relaxed text-fg-secondary md:text-base">{s.intro}</p>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-card border border-line bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <Languages size={18} className="text-accent-text" />
                <h2 className="text-base font-semibold">{s.interfaceLang}</h2>
              </div>
              <div className="grid gap-2">
                {interfaceLangButtons.map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => applyLang(code)}
                    className={`rounded-btn border px-4 py-3 text-left text-sm font-medium transition-colors duration-150 ${
                      lang === code
                        ? 'border-accent bg-accent-tint text-accent-text'
                        : 'border-line bg-inset text-fg-secondary hover:border-line-strong hover:text-fg'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-card border border-line bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <Bookmark size={18} className="text-accent-text" />
                <h2 className="text-base font-semibold">{s.mangaLang}</h2>
              </div>
              <div className="ic-select-wrap">
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

            <div className="rounded-card border border-line bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <Shield size={18} className="text-accent-text" />
                <h2 className="text-base font-semibold">{s.contentSafety}</h2>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-fg-secondary">
                {ageEnabled ? s.adultEnabled : s.adultDisabled}
              </p>
              <div className="flex items-center justify-between gap-4 rounded-btn border border-line-subtle bg-inset px-4 py-3">
                <span className="text-sm font-medium text-fg-secondary">
                  {ageEnabled ? s.disable18 : s.enable18}
                </span>
                <label className="ic-switch">
                  <input
                    type="checkbox"
                    checked={ageEnabled}
                    onChange={(event) => (event.target.checked ? enableAdultContent() : disableAdultContent())}
                  />
                  <span className="ic-switch__track" />
                  <span className="ic-switch__thumb" />
                </label>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-card border border-line bg-card p-6 md:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="ic-eyebrow text-accent-text">{s.snapshotEyebrow}</p>
                  <h2 className="ic-display mt-2 text-2xl">{s.savedDataTitle}</h2>
                </div>
                <div className="ic-eyebrow text-right">
                  <div>{s.bookmarksCount.replace('{count}', String(bookmarkCount))}</div>
                  <div>{s.readsCount.replace('{count}', String(historyCount))}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/library"
                  className="rounded-btn border border-line bg-inset p-4 transition-colors duration-150 hover:border-line-strong hover:bg-card-hov"
                >
                  <div className="ic-eyebrow">
                    {s.browseCta}
                  </div>
                  <div className="mt-2 text-base font-semibold text-fg">{s.openLibrary}</div>
                </Link>
                <Link
                  href="/support"
                  className="rounded-btn border border-line bg-inset p-4 transition-colors duration-150 hover:border-line-strong hover:bg-card-hov"
                >
                  <div className="ic-eyebrow">
                    {s.reportCta}
                  </div>
                  <div className="mt-2 text-base font-semibold text-fg">{s.sendIssue}</div>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={clearLibraryData}
                  className="ic-btn ic-btn--danger ic-btn--md"
                >
                  <Trash2 size={14} />
                  {s.clearData}
                </button>
              </div>
            </div>

            <div className="rounded-card border border-line bg-card p-6 md:p-8">
              <div className="mb-4 flex items-center gap-3">
                <Mail size={18} className="text-accent-text" />
                <h2 className="text-base font-semibold">{s.reportShortcuts}</h2>
              </div>
              <div className="space-y-3">
                <a
                  href="mailto:info@icomics.wiki?subject=iComics%20Support%20Report"
                  className="block rounded-btn border border-line bg-inset px-4 py-4 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:border-line-strong hover:text-fg"
                >
                  {s.emailSupport}
                </a>
                <a
                  href="https://t.me/icomicsuz"
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-btn border border-line bg-inset px-4 py-4 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:border-line-strong hover:text-fg"
                >
                  {s.telegramDispatch}
                </a>
                <Link
                  href="/support"
                  className="block rounded-btn border border-line bg-inset px-4 py-4 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:border-line-strong hover:text-fg"
                >
                  {s.fullSupportForm}
                </Link>
                <Link
                  href="/profile"
                  className="block rounded-btn border border-line bg-inset px-4 py-4 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:border-line-strong hover:text-fg"
                >
                  {s.accountProfile}
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-line bg-card p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Clock3 size={18} className="text-accent-text" />
              <h2 className="text-base font-semibold">{s.recentReads}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {readRecentHistoryItems(6).map((item) => (
                <Link
                  key={`${item.source}:${item.id}`}
                  href={item.href}
                  className="rounded-btn border border-line bg-inset p-4 transition-colors duration-150 hover:border-line-strong hover:bg-card-hov"
                >
                  <div className="ic-eyebrow text-accent-text">{s.resume}</div>
                  <div className="mt-2 line-clamp-2 text-sm font-semibold text-fg">{item.title}</div>
                  <div className="mt-2 line-clamp-2 text-xs text-fg-muted">
                    {item.chapterTitle || s.continueReadingChip}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-line bg-card p-6 md:p-8">
            <div className="mb-3 flex items-center gap-3">
              <MessageCircle size={18} className="text-accent-text" />
              <h2 className="text-base font-semibold">{s.reportSectionTitle}</h2>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-fg-secondary">{s.reportSectionBody}</p>
            <Link
              href="/support"
              className="ic-btn ic-btn--primary ic-btn--md mt-5"
            >
              {s.openSupportForm}
            </Link>
          </section>
        </m.div>
        </LazyMotion>
      </main>

      <Footer />
    </div>
  );
}
