'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Zap, BookOpen } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function AboutPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].about;

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    const timer = savedLang && translations[savedLang]
      ? window.setTimeout(() => setLang((current) => (savedLang !== current ? savedLang : current)), 0)
      : undefined;

    const handleLang = (event: Event) => {
      setLang((event as CustomEvent<Lang>).detail);
    };
    window.addEventListener('langChange', handleLang);
    return () => {
      window.removeEventListener('langChange', handleLang);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const reasons = [
    { title: t.reason1T, text: t.reason1D },
    { title: t.reason2T, text: t.reason2D },
    { title: t.reason3T, text: t.reason3D }
  ];

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <m.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          className="wrap max-w-4xl space-y-16 py-14 sm:py-16 lg:py-20"
        >
          {/* Header */}
          <div className="space-y-6">
            <p className="ic-eyebrow">{t.origin}</p>
            <h1 className="ic-display text-balance text-4xl sm:text-5xl md:text-6xl">
               {t.titleLine1}{' '}
               <span className="text-accent-text">{t.titleLine2}</span>
            </h1>
            <p className="max-w-3xl border-y border-line py-6 text-lg leading-relaxed text-fg-secondary sm:text-xl">
              {t.headline}
            </p>
            <div className="max-w-3xl rounded-card border border-line bg-card px-6 py-6 text-left sm:px-8 sm:py-7">
              <h2 className="ic-eyebrow text-accent-text">{t.trustTitle}</h2>
              <p className="mt-4 text-sm leading-relaxed text-fg-secondary sm:text-base">
                {t.trustBody}
              </p>
            </div>
            <div className="max-w-3xl rounded-card border border-line bg-card px-6 py-6 text-left sm:px-8 sm:py-7">
              <h2 className="ic-eyebrow">{t.wikiIdentityTitle}</h2>
              <p className="mt-4 text-sm leading-relaxed text-fg-secondary sm:text-base">
                {t.wikiIdentityBody}{' '}
                <Link href="/icomics-wiki" className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
                  /icomics-wiki
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Grid Layout for Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5 rounded-card border border-line bg-card p-6 sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                <BookOpen size={28} />
              </div>
              <h2 className="ic-display text-balance text-2xl sm:text-3xl">{t.missionTitle}</h2>
              <p className="text-base leading-relaxed text-fg-secondary">
                {t.missionText}
              </p>
            </div>

            <div className="space-y-5 rounded-card border border-line bg-card p-6 sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                <Zap size={28} />
              </div>
              <h2 className="ic-display text-balance text-2xl sm:text-3xl">{t.techTitle}</h2>
              <p className="text-base leading-relaxed text-fg-secondary">
                {t.techText}
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="ic-display text-balance text-3xl sm:text-4xl">{t.whyExist}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
               {reasons.map((item, i) => (
                 <div key={i} className="space-y-2 border-l-2 border-accent pl-5">
                   <h4 className="ic-eyebrow text-accent-text">{item.title}</h4>
                   <p className="text-sm leading-relaxed text-fg-secondary">{item.text}</p>
                 </div>
               ))}
            </div>
          </div>

          {/* Contact Accent */}
          <div className="flex flex-col items-start justify-between gap-6 rounded-card border border-line bg-card p-6 sm:p-10 md:flex-row md:items-center">
            <div>
              <h2 className="ic-display mb-2 text-balance text-2xl sm:text-3xl">{t.joinTitle}</h2>
              <p className="ic-eyebrow">{t.joinSub}</p>
            </div>
            <Link href="/auth">
              <button className="ic-btn ic-btn--primary ic-btn--lg">
                {t.activeBtn}
              </button>
            </Link>
          </div>
        </m.div>
      </main>

      <Footer />
    </div>
    </LazyMotion>
  );
}
