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

  const cards = [
    {
      href: '/guides',
      title: tr.cardGuidesTitle,
      body: tr.cardGuidesBody,
      icon: BookMarked,
    },
    {
      href: '/feed.xml',
      title: tr.cardRssTitle,
      body: tr.cardRssBody,
      icon: Rss,
    },
    {
      href: '/library',
      title: tr.cardLibraryTitle,
      body: tr.cardLibraryBody,
      icon: Library,
    },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <div className="wrap py-14 sm:py-16 lg:py-20">
        <header className="mx-auto max-w-4xl space-y-5 text-center">
          <p className="ic-eyebrow">{tr.kicker}</p>
          <h1 className="ic-display text-balance text-4xl text-fg sm:text-5xl md:text-6xl">
            {tr.title}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-fg-secondary md:text-base">{tr.intro}</p>
        </header>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {cards.map(({ href, title, body, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-card border border-line bg-card p-6 transition-colors duration-150 hover:border-line-strong hover:bg-card-hov sm:p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                <Icon size={22} strokeWidth={2} />
              </div>
              <h2 className="ic-display mt-5 text-xl text-fg">
                {title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-secondary">{body}</p>
              <span className="mt-6 text-sm font-medium text-fg-muted transition-colors group-hover:text-accent-text">{tr.openCta}</span>
            </Link>
          ))}
        </div>

        <section className="mx-auto mt-16 max-w-3xl rounded-card border border-line bg-card p-8 text-sm leading-relaxed text-fg-secondary md:p-10">
          <h2 className="ic-eyebrow text-accent-text">{tr.discoverTitle}</h2>
          <p className="mt-4">
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
          <p className="mt-4">
            {tr.wikiSearchNote}{' '}
            <Link href="/icomics-wiki" className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
              {tr.wikiExplainerLink}
            </Link>{' '}
            {tr.wikiSearchNoteEnd}
          </p>
        </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
