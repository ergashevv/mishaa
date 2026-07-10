'use client';

import { useState, useEffect } from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function FAQPageClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].faq;
  const footerT = translations[lang].footer;

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', handleLang as EventListener);
    return () => window.removeEventListener('langChange', handleLang as EventListener);
  }, []);

  const FAQS = [
    { q: t.q1, a: t.a1 },
    { q: t.q2, a: t.a2 },
    { q: t.q3, a: t.a3 },
    { q: t.q4, a: t.a4 },
    { q: t.q5, a: t.a5 },
    { q: t.q6, a: t.a6 },
    { q: t.q7, a: t.a7 },
    { q: t.q8, a: t.a8 },
    { q: t.q10, a: t.a10 },
    { q: t.q11, a: t.a11 },
    { q: t.q12, a: t.a12 },
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
          className="wrap max-w-6xl space-y-16 py-14 sm:py-16 lg:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-[340px_1fr] lg:gap-16 xl:grid-cols-[380px_1fr]">
            {/* Anchor: statement + jump nav, pinned alongside the list on desktop */}
            <aside className="space-y-10 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
              <div className="space-y-5 border-b border-line-subtle pb-8 lg:border-b-0 lg:pb-0">
                <p className="ic-eyebrow">{t.badge}</p>
                <h1 className="ic-display text-balance text-4xl sm:text-5xl lg:text-6xl">
                  {t.titleLine1} <br />
                  <span className="text-accent-text">{t.titleLine2}</span>
                </h1>
                <p className="font-display text-xl italic leading-snug text-fg-secondary">&quot;{t.subtitle}&quot;</p>
              </div>

              <nav aria-label={t.badge} className="hidden lg:flex lg:flex-col lg:gap-0.5 lg:border-t lg:border-line-subtle lg:pt-6">
                {FAQS.map((faq, i) => (
                  <a
                    key={i}
                    href={`#faq-item-${i}`}
                    onClick={() => setOpenIndex(i)}
                    className="group -mx-3 flex items-baseline gap-3 rounded-md px-3 py-2 transition-colors duration-150 hover:bg-card-hov"
                  >
                    <span className="font-mono text-[11px] text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                    <span className="line-clamp-1 text-sm text-fg-secondary group-hover:text-fg">{faq.q}</span>
                  </a>
                ))}
              </nav>
            </aside>

            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  id={`faq-item-${i}`}
                  className={`scroll-mt-28 rounded-card border bg-card transition-colors duration-150 ${openIndex === i ? 'border-line-strong' : 'border-line hover:bg-card-hov'}`}
                >
                  <h3 className="contents">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(openIndex === i ? null : i)}
                      aria-expanded={openIndex === i}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full cursor-pointer items-center justify-between gap-6 rounded-card p-5 text-left sm:p-6"
                    >
                      <span className="flex items-baseline gap-4">
                        <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-base font-semibold leading-snug sm:text-lg">{faq.q}</span>
                      </span>
                      <m.span animate={{ rotate: openIndex === i ? 180 : 0 }} className="inline-flex text-fg-muted">
                        <ChevronDown size={20} />
                      </m.span>
                    </button>
                  </h3>
                  <m.div
                    id={`faq-panel-${i}`}
                    aria-hidden={openIndex !== i}
                    initial={false}
                    animate={{ height: openIndex === i ? 'auto' : 0, opacity: openIndex === i ? 1 : 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-line-subtle px-5 pb-6 pt-4 sm:px-6">
                      <p className="max-w-2xl text-sm leading-relaxed text-fg-secondary sm:text-base">{faq.a}</p>
                    </div>
                  </m.div>
                </div>
              ))}
            </div>
          </div>

          <div className="searchband rise-in flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="ic-display text-3xl">{t.stillQuestions}</h2>
              <p className="text-base text-fg-secondary">{t.stillDesc}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 lg:justify-end">
              <Link
                href="/icomics-wiki"
                className="text-sm font-medium text-fg-secondary transition-colors hover:text-accent-text"
              >
                {t.wikiExplainerCta}
              </Link>
              <Link
                href="/contact"
                className="text-sm font-medium text-fg-secondary transition-colors hover:text-accent-text"
              >
                {t.dept}
              </Link>
              <Link
                href="/guides"
                className="text-sm font-medium text-fg-secondary transition-colors hover:text-accent-text"
              >
                {footerT.guides}
              </Link>
              <Link
                href="/reading"
                className="text-sm font-medium text-fg-secondary transition-colors hover:text-accent-text"
              >
                {footerT.readingHub}
              </Link>
              <a
                href="https://t.me/icomicsuz"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-fg-secondary transition-colors hover:text-accent-text"
              >
                {t.hub}
              </a>
            </div>
          </div>
        </m.div>
      </main>

      <Footer />
    </div>
    </LazyMotion>
  );
}
