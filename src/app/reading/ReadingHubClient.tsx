'use client';

/**
 * Reading hub ("Shelf") — rebuilt from zero in the Bold Pop Zine language: a poster masthead
 * and color-block destination tiles. Reuses only the i18n copy + routes.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookMarked, Library, Rss, ArrowRight } from 'lucide-react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function ReadingHubClient() {
  const [lang, setLang] = useState<Lang>('en');
  const tr = translations[lang].reading;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const cards = [
    { href: '/library', title: tr.cardLibraryTitle, body: tr.cardLibraryBody, icon: Library, color: 'var(--z-blue)', featured: true },
    { href: '/guides', title: tr.cardGuidesTitle, body: tr.cardGuidesBody, icon: BookMarked, color: 'var(--z-green)', featured: false },
    { href: '/feed.xml', title: tr.cardRssTitle, body: tr.cardRssBody, icon: Rss, color: 'var(--z-orange)', featured: false },
  ];

  return (
    <div className="zine min-h-dvh">
      <ZineNav />

      <main id="main-content" tabIndex={-1} className="z-wrap py-14">
        <header className="max-w-2xl">
          <span className="z-tag z-tag--red">{tr.kicker}</span>
          <h1 className="z-display mt-4 text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.8]">{tr.title}</h1>
          <p className="mt-5 max-w-xl text-[16px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{tr.intro}</p>
        </header>

        <div className="mt-12 grid gap-5 md:grid-cols-[1.6fr_1fr] md:grid-rows-2">
          {cards.map(({ href, title, body, icon: Icon, color, featured }) => (
            <Link key={href} href={href}
              className={`z-box z-pop group flex flex-col ${featured ? 'justify-center p-8 sm:p-10 md:row-span-2' : 'p-6'}`}
              style={featured ? { background: color, color: 'var(--z-paper)' } : undefined}>
              <span className={`grid place-items-center rounded-[8px] border-[2.5px] border-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)] ${featured ? 'h-14 w-14' : 'h-11 w-11'}`}
                style={{ background: featured ? 'var(--z-yellow)' : color, color: featured ? 'var(--z-ink)' : '#fff' }}>
                <Icon size={featured ? 26 : 20} strokeWidth={2.5} />
              </span>
              <h2 className={`z-display mt-6 leading-[0.9] ${featured ? 'text-[clamp(2rem,4vw,3rem)] text-[var(--z-paper)]' : 'text-[1.6rem] text-[var(--z-ink)]'}`}>{title}</h2>
              <p className={`mt-3 flex-1 font-semibold leading-relaxed ${featured ? 'max-w-sm text-[16px] text-[var(--z-paper)]/90' : 'text-[14px] text-[var(--z-ink-2)]'}`}>{body}</p>
              <span className={`mt-6 inline-flex items-center gap-1.5 text-[13px] font-extrabold uppercase ${featured ? 'text-[var(--z-yellow)]' : 'text-[var(--z-ink)]'}`} style={{ fontFamily: 'var(--font-zine-mono)' }}>
                {tr.openCta} <ArrowRight size={14} strokeWidth={3} />
              </span>
            </Link>
          ))}
        </div>

        <section className="mt-20 max-w-2xl">
          <h2 className="z-display -rotate-1 mb-5 inline-block border-[3px] border-[var(--z-ink)] bg-[var(--z-yellow)] px-3 py-1 text-[clamp(1.6rem,4vw,2.4rem)] leading-[0.82] shadow-[4px_4px_0_var(--z-ink)]">{tr.discoverTitle}</h2>
          <div className="space-y-4 text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)]">
            <p>
              {tr.closingBeforeFaq}{' '}
              <Link href="/faq" className="font-black text-[var(--z-red)] underline underline-offset-4">{tr.faqLinkLabel}</Link>{' '}
              {tr.closingMid}{' '}
              <Link href="/support" className="font-black text-[var(--z-red)] underline underline-offset-4">{tr.supportLinkLabel}</Link>{' '}
              {tr.closingAfter}
            </p>
            <p>
              {tr.wikiSearchNote}{' '}
              <Link href="/icomics-wiki" className="font-black text-[var(--z-blue)] underline underline-offset-4">{tr.wikiExplainerLink}</Link>{' '}
              {tr.wikiSearchNoteEnd}
            </p>
          </div>
        </section>
      </main>

      <ZineFooter />
    </div>
  );
}
