'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookMarked, Library, Rss } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function ReadingHubClient() {
  const [lang, setLang] = useState<Lang>('en');
  const tr = translations[lang].reading;

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    const timer =
      savedLang && translations[savedLang]
        ? window.setTimeout(() => setLang((c) => (savedLang !== c ? savedLang : c)), 0)
        : undefined;
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => {
      window.removeEventListener('langChange', onLang as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Library is the primary destination, so it leads the spotlight grid as the
  // bigger, filled-in-button tile; Guides and RSS trail as quieter secondary
  // entries. Order here drives the visual layout below, not the data model.
  const cards = [
    {
      href: '/library',
      title: tr.cardLibraryTitle,
      body: tr.cardLibraryBody,
      icon: Library,
      featured: true,
    },
    {
      href: '/guides',
      title: tr.cardGuidesTitle,
      body: tr.cardGuidesBody,
      icon: BookMarked,
      featured: false,
    },
    {
      href: '/feed.xml',
      title: tr.cardRssTitle,
      body: tr.cardRssBody,
      icon: Rss,
      featured: false,
    },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <div className="wrap py-14 sm:py-16 lg:py-20">
        <header className="max-w-2xl space-y-5">
          <p className="ic-eyebrow">{tr.kicker}</p>
          <h1 className="ic-display text-balance text-4xl text-fg sm:text-5xl md:text-6xl">
            {tr.title}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-fg-secondary md:text-[1rem]">{tr.intro}</p>
        </header>

        {/* Custom 2-col/2-row bento (not the 5-item .spotlight-grid primitive,
            which would leave an empty cell with only 3 tiles): the featured
            Library tile spans both rows on the left, Guides and RSS stack in
            the right column. Collapses to a single stacked column on mobile. */}
        <div className="mt-12 grid gap-5 md:grid-cols-[1.6fr_1fr] md:grid-rows-2">
          {cards.map(({ href, title, body, icon: Icon, featured }) => (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col rounded-card border border-line transition-colors duration-150 hover:border-line-strong ${
                featured ? 'justify-center bg-card p-8 hover:bg-card-hov sm:p-10 md:row-span-2' : 'bg-card p-6 hover:bg-card-hov sm:p-7'
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-btn ${
                  featured ? 'h-14 w-14 bg-accent text-on-accent' : 'h-11 w-11 bg-accent-tint text-accent-text'
                }`}
              >
                <Icon size={featured ? 26 : 20} strokeWidth={2} />
              </div>
              <h2 className={`ic-display mt-6 text-fg ${featured ? 'text-3xl' : 'text-lg'}`}>
                {title}
              </h2>
              <p className={`mt-3 flex-1 leading-relaxed text-fg-secondary ${featured ? 'max-w-sm text-base' : 'text-sm'}`}>
                {body}
              </p>
              {featured ? (
                <span className="ic-btn ic-btn--primary ic-btn--md mt-7 self-start">{tr.openCta}</span>
              ) : (
                <span className="mt-6 text-sm font-medium text-fg-muted transition-colors group-hover:text-accent-text">
                  {tr.openCta}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="section">
          <div className="section__head">
            <div className="section__titles">
              <h2 className="section__heading">{tr.discoverTitle}</h2>
            </div>
          </div>
          <div className="max-w-2xl space-y-4 text-sm leading-relaxed text-fg-secondary">
            <p>
              {tr.closingBeforeFaq}{' '}
              <Link href="/faq" className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
                {tr.faqLinkLabel}
              </Link>{' '}
              {tr.closingMid}{' '}
              <Link href="/support" className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
                {tr.supportLinkLabel}
              </Link>{' '}
              {tr.closingAfter}
            </p>
            <p>
              {tr.wikiSearchNote}{' '}
              <Link href="/icomics-wiki" className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
                {tr.wikiExplainerLink}
              </Link>{' '}
              {tr.wikiSearchNoteEnd}
            </p>
          </div>
        </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
