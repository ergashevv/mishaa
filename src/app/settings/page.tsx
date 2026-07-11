'use client';

/**
 * Settings — rebuilt from zero in the Bold Pop Zine language. Reuses ONLY the preference logic
 * (language, manga-language, age gate, clear-data, reading history). No old JSX.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { htmlLangFromUiLang } from '@/lib/i18n/lang';
import { Bookmark, ChevronDown, Clock3, Shield, Mail, MessageCircle, Trash2, Languages, Play } from 'lucide-react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { translations, type Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { MANGA_LANGUAGE_OPTIONS, type MangaLanguage, persistStoredMangaLanguage, readStoredMangaLanguage } from '@/lib/manga-language';
import { persistUiLangCookie } from '@/lib/i18n/ui-lang-cookie-client';
import { uiLangToPreferredMangaLanguage } from '@/lib/i18n/ui-lang-to-manga';
import { clearAgeVerification, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { BOOKMARKS_STORAGE_KEY, LIBRARY_ACTIVITY_EVENT, clearReadingHistory, readBookmarks, readRecentHistoryItems } from '@/lib/library-storage';

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
    if (savedLang && translations[savedLang]) setLang(savedLang);
    sync();
    const onLang = (e: Event) => { const n = (e as CustomEvent<Lang>).detail; if (n && translations[n]) setLang(n); sync(); };
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('langChange', onLang as EventListener);
    return () => { window.removeEventListener(LIBRARY_ACTIVITY_EVENT, sync); window.removeEventListener('storage', sync); window.removeEventListener('langChange', onLang as EventListener); };
  }, []);

  const applyLang = (nextLang: Lang) => {
    const nextManga = uiLangToPreferredMangaLanguage(nextLang);
    setLang(nextLang); writeStorageItem('lang', nextLang); persistUiLangCookie(nextLang); persistStoredMangaLanguage(nextManga); setMangaLanguage(nextManga);
    window.dispatchEvent(new Event(LIBRARY_ACTIVITY_EVENT)); window.dispatchEvent(new CustomEvent('langChange', { detail: nextLang }));
    if (typeof document !== 'undefined') document.documentElement.lang = htmlLangFromUiLang(nextLang);
    router.refresh();
  };
  const applyMangaLanguage = (next: MangaLanguage) => { setMangaLanguage(next); persistStoredMangaLanguage(next); window.dispatchEvent(new Event(LIBRARY_ACTIVITY_EVENT)); };
  const clearLibraryData = async () => {
    window.localStorage.removeItem(BOOKMARKS_STORAGE_KEY); clearReadingHistory();
    try { const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => null); if (me?.user) await fetch('/api/reading-progress', { method: 'DELETE' }); } catch (e) { console.error(e); }
    setBookmarkCount(0); setHistoryCount(0); setRecentItems([]);
  };

  const langButtons: { code: Lang; label: string }[] = [
    { code: 'en', label: s.langEnglish }, { code: 'ja', label: s.langJapanese }, { code: 'ko', label: s.langKorean }, { code: 'zh', label: s.langChinese }, { code: 'ru', label: s.langRussian },
  ];

  const Head = ({ title, color }: { title: string; color: string }) => (
    <h2 className="z-display -rotate-1 mb-6 inline-block border-[3px] border-[var(--z-ink)] px-3 py-1 text-[clamp(1.6rem,4vw,2.4rem)] leading-[0.82] shadow-[4px_4px_0_var(--z-ink)]" style={{ background: color, color: color === 'var(--z-yellow)' ? 'var(--z-ink)' : 'var(--z-paper)' }}>{title}</h2>
  );

  return (
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-5xl py-14">
        <header className="mb-14">
          <span className="z-tag z-tag--red">{s.eyebrow}</span>
          <h1 className="z-display mt-4 text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.8]">{s.titleLine1} {s.titleAccent}</h1>
          <p className="mt-4 max-w-2xl text-[16px] font-semibold text-[var(--z-ink-2)]">{s.intro}</p>
        </header>

        {/* Preferences */}
        <section className="mb-16">
          <Head title={s.sectionPreferences} color="var(--z-blue)" />
          <div className="z-box divide-y-[2.5px] divide-[var(--z-ink)] p-0">
            <div className="grid gap-4 p-6 sm:grid-cols-[200px_1fr] sm:items-start">
              <div className="flex items-center gap-2 text-[15px] font-extrabold"><Languages size={17} strokeWidth={2.5} /> {s.interfaceLang}</div>
              <div className="flex flex-wrap gap-2">
                {langButtons.map(({ code, label }) => (
                  <button key={code} type="button" onClick={() => applyLang(code)} className="z-tag" style={{ background: lang === code ? 'var(--z-yellow)' : 'var(--z-card)' }}>{label}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-[200px_1fr] sm:items-center">
              <div className="flex items-center gap-2 text-[15px] font-extrabold"><Bookmark size={17} strokeWidth={2.5} /> {s.mangaLang}</div>
              <div className="relative max-w-xs">
                <select value={mangaLanguage} onChange={(e) => applyMangaLanguage(e.target.value as MangaLanguage)} className="w-full appearance-none rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-4 py-3 text-[14px] font-bold shadow-[3px_3px_0_var(--z-ink)] focus:outline-none">
                  {MANGA_LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={16} strokeWidth={2.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-[200px_1fr] sm:items-center">
              <div className="flex items-center gap-2 text-[15px] font-extrabold"><Shield size={17} strokeWidth={2.5} /> {s.contentSafety}</div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-md text-[14px] font-semibold text-[var(--z-ink-2)]">{ageEnabled ? s.adultEnabled : s.adultDisabled}</p>
                <button type="button" onClick={() => (ageEnabled ? (clearAgeVerification(), setAgeEnabled(false)) : (persistAgeVerification(), setAgeEnabled(true)))}
                  className="z-btn z-btn--sm" style={{ background: ageEnabled ? 'var(--z-green)' : 'var(--z-card)', color: ageEnabled ? '#fff' : 'var(--z-ink)' }}>
                  {ageEnabled ? s.disable18 : s.enable18}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Library */}
        <section className="mb-16">
          <Head title={s.savedDataTitle} color="var(--z-pink)" />
          <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-sm">
            <div className="z-box p-4 text-center"><div className="z-display text-[2.6rem] leading-none text-[var(--z-red)]">{bookmarkCount}</div><div className="z-kicker mt-1 text-[var(--z-ink-2)]">{s.bookmarksCount.replace('{count}', '').trim()}</div></div>
            <div className="z-box p-4 text-center"><div className="z-display text-[2.6rem] leading-none text-[var(--z-blue)]">{historyCount}</div><div className="z-kicker mt-1 text-[var(--z-ink-2)]">{s.readsCount.replace('{count}', '').trim()}</div></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/library" className="z-btn z-btn--blue z-btn--sm">{s.openLibrary}</Link>
            <button type="button" onClick={clearLibraryData} className="z-btn z-btn--red z-btn--sm"><Trash2 size={14} /> {s.clearData}</button>
          </div>

          {recentItems.length > 0 ? (
            <div className="mt-8">
              <div className="mb-4 flex items-center gap-2 text-[14px] font-extrabold"><Clock3 size={16} strokeWidth={2.5} /> {s.recentReads}</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentItems.map((item) => (
                  <Link key={`${item.source}:${item.id}`} href={item.href} className="z-box z-pop group flex items-stretch overflow-hidden">
                    <span className="relative aspect-[2/3] w-[54px] shrink-0 border-r-[2.5px] border-[var(--z-ink)] bg-[var(--z-paper-2)]"><img src={item.coverUrl} alt="" className="h-full w-full object-cover" /></span>
                    <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
                      <span className="truncate text-[13px] font-extrabold text-[var(--z-ink)]">{item.title}</span>
                      <span className="truncate text-[11px] font-bold text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{item.chapterTitle || s.continueReadingChip}</span>
                    </span>
                    <span className="grid w-9 shrink-0 place-items-center border-l-[2.5px] border-[var(--z-ink)] bg-[var(--z-yellow)]"><Play size={14} fill="currentColor" /></span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Support */}
        <section>
          <Head title={s.reportSectionTitle} color="var(--z-green)" />
          <p className="max-w-2xl text-[15px] font-semibold text-[var(--z-ink-2)]">{s.reportSectionBody}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/support" className="z-btn z-btn--green z-btn--sm"><MessageCircle size={14} /> {s.openSupportForm}</Link>
            <a href="mailto:info@icomics.wiki?subject=iComics%20Support%20Report" className="z-btn z-btn--paper z-btn--sm"><Mail size={14} /> {s.emailSupport}</a>
            <a href="https://t.me/icomicsuz" target="_blank" rel="noreferrer" className="z-btn z-btn--paper z-btn--sm">{s.telegramDispatch}</a>
            <Link href="/profile" className="z-btn z-btn--paper z-btn--sm">{s.accountProfile}</Link>
          </div>
        </section>
      </main>
      <ZineFooter />
    </div>
  );
}
