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
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <div className="wrap max-w-3xl py-14 sm:py-16 lg:py-20">
        <header className="space-y-5 text-center">
          <p className="ic-eyebrow">{t.kicker}</p>
          <h1 className="ic-display text-balance text-4xl text-fg sm:text-5xl md:text-6xl">
            {t.titleLine1}{' '}
            <span className="text-accent-text">{t.titleLine2}</span>
          </h1>
          <p className="mx-auto text-sm leading-relaxed text-fg-secondary md:text-base">{t.lead}</p>
        </header>

        <article className="mt-12 space-y-6 rounded-card border border-line bg-card p-8 text-sm leading-relaxed text-fg-secondary md:p-12 md:text-base">
          <p>{t.p1}</p>
          <p>{t.p2}</p>
          <p>{t.p3}</p>
          <section className="rounded-card border border-line bg-inset px-6 py-5">
            <h2 className="ic-eyebrow text-accent-text">{t.quickCheckTitle}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-accent">
              <li>{t.quickLi1}</li>
              <li>{t.quickLi2}</li>
              <li>{t.quickLi3}</li>
            </ul>
          </section>
        </article>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
          <Link href="/faq" className="ic-btn ic-btn--primary ic-btn--lg">
            {t.ctaFaq}
          </Link>
          <Link href="/library" className="ic-btn ic-btn--secondary ic-btn--lg">
            {t.ctaLibrary}
          </Link>
        </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
