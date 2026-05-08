'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Bookmark,
  Clock3,
  Shield,
  Mail,
  MessageCircle,
  Trash2,
  Languages,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { MANGA_LANGUAGE_OPTIONS, MangaLanguage, persistStoredMangaLanguage, readStoredMangaLanguage } from '@/lib/manga-language';
import { clearAgeVerification, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { BOOKMARKS_STORAGE_KEY, LIBRARY_ACTIVITY_EVENT, clearReadingHistory, readBookmarks, readRecentHistoryItems } from '@/lib/library-storage';

export default function SettingsPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>('en');
  const [ageEnabled, setAgeEnabled] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);

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

    window.addEventListener(LIBRARY_ACTIVITY_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const applyLang = (nextLang: Lang) => {
    setLang(nextLang);
    writeStorageItem('lang', nextLang);
    window.dispatchEvent(new CustomEvent('langChange', { detail: nextLang }));
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

  return (
    <div className="min-h-screen bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white overflow-x-hidden dark:bg-[#020202] dark:text-white dark:selection:text-white">
      <Navbar />

      <main className="container mx-auto px-6 pt-28 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-10">
          <section className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/10 bg-black/[0.04] dark:bg-white/5 px-4 py-2">
              <SettingsIcon size={14} className="text-[#ff4d00]" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/50">User Controls</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
              Settings & <span className="text-[#ff4d00]">Safety</span>
            </h1>
            <p className="max-w-2xl text-neutral-600 dark:text-white/45 text-sm md:text-base leading-relaxed">
              Tweak reading preferences, manage saved data, and reach support from one place.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-neutral-200 dark:border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <Languages size={18} className="text-[#ffca3a]" />
                <h2 className="text-lg font-black uppercase tracking-widest">Interface Language</h2>
              </div>
              <div className="grid gap-2">
                {(['en', 'ru'] as Lang[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => applyLang(option)}
                    className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.35em] transition-all ${
                      lang === option
                        ? 'border-[#ff4d00] bg-[#ff4d00] text-white'
                        : 'border-neutral-200 dark:border-white/10 bg-black/30 text-neutral-600 dark:text-white/45 hover:border-white/25 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 dark:border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <Bookmark size={18} className="text-[#ffca3a]" />
                <h2 className="text-lg font-black uppercase tracking-widest">Manga Language</h2>
              </div>
              <select
                value={mangaLanguage}
                onChange={(event) => applyMangaLanguage(event.target.value as MangaLanguage)}
                className="w-full rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/40 px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] outline-none"
              >
                {MANGA_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 dark:border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={18} className="text-[#ff4d00]" />
                <h2 className="text-lg font-black uppercase tracking-widest">Content Safety</h2>
              </div>
              <p className="text-sm text-neutral-600 dark:text-white/45 leading-relaxed mb-4">
                Adult content is {ageEnabled ? 'enabled' : 'disabled'} for this browser.
              </p>
              <div className="grid gap-2">
                <button
                  onClick={enableAdultContent}
                  className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] transition-all ${
                    ageEnabled ? 'border-[#ff4d00] bg-[#ff4d00] text-white' : 'border-neutral-200 dark:border-white/10 bg-black/30 text-neutral-600 dark:text-white/45 hover:border-white/25 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Enable 18+
                </button>
                <button
                  onClick={disableAdultContent}
                  className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 dark:text-white/45 transition-all hover:border-white/25 hover:text-neutral-900 dark:hover:text-white"
                >
                  Disable 18+
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[2rem] border border-neutral-200 dark:border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">Library Snapshot</p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Your saved data</h2>
                </div>
                <div className="text-right text-[9px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/30">
                  <div>{bookmarkCount} bookmarks</div>
                  <div>{historyCount} reads</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/library" className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 p-4 hover:border-[#ff4d00]/40 transition-all">
                  <div className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30">Browse</div>
                  <div className="mt-2 text-lg font-black uppercase tracking-tight">Open Library</div>
                </Link>
                <Link href="/support" className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 p-4 hover:border-[#ff4d00]/40 transition-all">
                  <div className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30">Report</div>
                  <div className="mt-2 text-lg font-black uppercase tracking-tight">Send an Issue</div>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={clearLibraryData}
                  className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 dark:text-white/45 transition-all hover:border-red-500/40 hover:text-red-400"
                >
                  <Trash2 size={14} />
                  Clear bookmarks and history
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 dark:border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <Mail size={18} className="text-[#ffca3a]" />
                <h2 className="text-lg font-black uppercase tracking-widest">Report shortcuts</h2>
              </div>
              <div className="space-y-3">
                <a href="mailto:info@icomics.wiki?subject=iComics%20Support%20Report" className="block rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 px-4 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 dark:text-white/60 transition-all hover:border-white/25 hover:text-neutral-900 dark:hover:text-white">
                  Email support
                </a>
                <a href="https://t.me/icomicsuz" target="_blank" rel="noreferrer" className="block rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 px-4 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 dark:text-white/60 transition-all hover:border-white/25 hover:text-neutral-900 dark:hover:text-white">
                  Telegram dispatch
                </a>
                <Link href="/support" className="block rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 px-4 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 dark:text-white/60 transition-all hover:border-white/25 hover:text-neutral-900 dark:hover:text-white">
                  Open full support form
                </Link>
                <Link href="/profile" className="block rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 px-4 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 dark:text-white/60 transition-all hover:border-white/25 hover:text-neutral-900 dark:hover:text-white">
                  Account profile
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-neutral-200 dark:border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <Clock3 size={18} className="text-[#ffca3a]" />
              <h2 className="text-lg font-black uppercase tracking-widest">Recent reads</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {readRecentHistoryItems(6).map((item) => (
                <Link
                  key={`${item.source}:${item.id}`}
                  href={item.href}
                  className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-black/30 p-4 hover:border-[#ff4d00]/40 transition-all"
                >
                  <div className="text-[9px] font-black uppercase tracking-[0.35em] text-[#ff4d00]">Resume</div>
                  <div className="mt-2 line-clamp-2 text-sm font-black uppercase tracking-widest">{item.title}</div>
                  <div className="mt-2 text-[10px] text-neutral-500 dark:text-white/35 line-clamp-2">
                    {item.chapterTitle || 'Continue reading'}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-neutral-200 dark:border-white/10 bg-gradient-to-r from-[#ff4d00]/15 via-white/[0.03] to-white/[0.03] p-6 md:p-8">
            <div className="flex items-center gap-3 mb-3">
              <MessageCircle size={18} className="text-[#ff4d00]" />
              <h2 className="text-lg font-black uppercase tracking-widest">Need to report something?</h2>
            </div>
            <p className="text-sm text-neutral-600 dark:text-white/45 leading-relaxed max-w-3xl">
              Use the support form to flag broken chapters, wrong metadata, unsafe content, or login issues. Good reports make the library much easier to keep healthy.
            </p>
            <Link
              href="/support"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-neutral-200 dark:border-white/10 bg-black px-5 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white transition-all hover:bg-[#ff4d00]"
            >
              Open Support Form
            </Link>
          </section>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
