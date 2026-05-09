'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function IcomicsWikiClient() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].wikiLanding;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    const timer =
      saved && translations[saved]
        ? window.setTimeout(() => setLang((c) => (saved !== c ? saved : c)), 0)
        : undefined;
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => {
      window.removeEventListener('langChange', onLang as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white dark:bg-[#020202] dark:text-white dark:selection:text-white">
      <Navbar />

      <main className="container mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pb-28 sm:pt-28 lg:px-8 lg:pb-32 lg:pt-36">
        <header className="space-y-4 text-center sm:space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.45em] text-[#ff4d00]">{t.kicker}</p>
          <h1 className="text-balance font-display text-4xl uppercase italic tracking-tighter text-neutral-900 dark:text-white sm:text-5xl md:text-6xl">
            {t.titleLine1}{' '}
            <span className="text-[#3b82f6] not-italic">{t.titleLine2}</span>
          </h1>
          <p className="mx-auto text-sm leading-relaxed text-neutral-600 dark:text-white/55 md:text-base">{t.lead}</p>
        </header>

        <article className="mt-12 space-y-6 rounded-[1.75rem] border border-neutral-200 bg-white/90 p-8 text-sm leading-relaxed text-neutral-800 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] dark:text-white/75 md:p-12 md:text-base">
          <p>{t.p1}</p>
          <p>{t.p2}</p>
          <p>{t.p3}</p>
          <section className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-6 py-5 dark:border-white/10 dark:bg-black/40">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.quickCheckTitle}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-[#ff4d00]">
              <li>{t.quickLi1}</li>
              <li>{t.quickLi2}</li>
              <li>{t.quickLi3}</li>
            </ul>
          </section>
        </article>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/faq"
            className="rounded-xl border-2 border-black bg-[#ff4d00] px-8 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-white shadow-[6px_6px_0_#000] transition-transform hover:-translate-y-0.5 dark:border-white dark:shadow-[6px_6px_0_#fff]"
          >
            {t.ctaFaq}
          </Link>
          <Link
            href="/library"
            className="rounded-xl border-2 border-neutral-900 bg-white px-8 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-900 transition-transform hover:-translate-y-0.5 dark:border-white dark:bg-transparent dark:text-white"
          >
            {t.ctaLibrary}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
