'use client';

/** iComics-wiki explainer — rebuilt in the Bold Pop Zine language. Reuses only the i18n copy. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function IcomicsWikiClient() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].wikiLanding;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  return (
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-3xl py-14">
        <header className="text-center">
          <span className="z-tag z-tag--red">{t.kicker}</span>
          <h1 className="z-display mt-4 text-[clamp(2.6rem,7vw,5rem)] leading-[0.8]">{t.titleLine1} {t.titleLine2}</h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{t.lead}</p>
        </header>

        <article className="z-box mt-12 space-y-5 p-8 text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)] md:p-10">
          <p>{t.p1}</p>
          <p>{t.p2}</p>
          <p>{t.p3}</p>
          <section className="z-box p-6" style={{ background: 'var(--z-yellow)' }}>
            <h2 className="z-kicker text-[var(--z-ink)]">{t.quickCheckTitle}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--z-ink)] marker:text-[var(--z-red)]">
              <li>{t.quickLi1}</li><li>{t.quickLi2}</li><li>{t.quickLi3}</li>
            </ul>
          </section>
        </article>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/faq" className="z-btn z-btn--red text-[16px]">{t.ctaFaq}</Link>
          <Link href="/library" className="z-btn z-btn--paper text-[16px]">{t.ctaLibrary}</Link>
        </div>
      </main>
      <ZineFooter />
    </div>
  );
}
