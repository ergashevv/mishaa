'use client';

/** FAQ — rebuilt in the Bold Pop Zine language (sticker accordion). Reuses only the i18n copy. */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function FAQPageClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].faq;
  const footerT = translations[lang].footer;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const FAQS = [
    { q: t.q1, a: t.a1 }, { q: t.q2, a: t.a2 }, { q: t.q3, a: t.a3 }, { q: t.q4, a: t.a4 },
    { q: t.q5, a: t.a5 }, { q: t.q6, a: t.a6 }, { q: t.q7, a: t.a7 }, { q: t.q8, a: t.a8 },
    { q: t.q10, a: t.a10 }, { q: t.q11, a: t.a11 }, { q: t.q12, a: t.a12 },
  ];

  const links = [
    { href: '/icomics-wiki', label: t.wikiExplainerCta }, { href: '/contact', label: t.dept },
    { href: '/guides', label: footerT.guides }, { href: '/reading', label: footerT.readingHub },
  ];

  return (
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-6xl space-y-16 py-14">
        <div className="grid gap-10 lg:grid-cols-[340px_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <span className="z-tag z-tag--red">{t.badge}</span>
            <h1 className="z-display mt-4 text-[clamp(2.6rem,6vw,5rem)] leading-[0.8]">{t.titleLine1} {t.titleLine2}</h1>
            <p className="mt-4 text-[18px] font-bold italic leading-snug text-[var(--z-ink-2)]">&ldquo;{t.subtitle}&rdquo;</p>
          </aside>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const open = openIndex === i;
              return (
                <div key={i} id={`faq-item-${i}`} className="z-box scroll-mt-28 overflow-hidden" style={open ? { boxShadow: 'var(--z-sh-lg)' } : undefined}>
                  <button type="button" onClick={() => setOpenIndex(open ? null : i)} aria-expanded={open} className="flex w-full items-center justify-between gap-6 p-5 text-left">
                    <span className="flex items-baseline gap-4">
                      <span className="text-[13px] font-black text-[var(--z-red)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-[16px] font-extrabold leading-snug text-[var(--z-ink)]">{faq.q}</span>
                    </span>
                    <ChevronDown size={20} strokeWidth={3} className="shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
                  </button>
                  {open ? <div className="border-t-[2.5px] border-[var(--z-ink)] px-5 pb-6 pt-4"><p className="max-w-2xl text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{faq.a}</p></div> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="z-box flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between" style={{ background: 'var(--z-blue)' }}>
          <div className="text-center lg:text-left">
            <h2 className="z-display text-[clamp(1.8rem,4vw,2.8rem)] leading-[0.85] text-[var(--z-paper)]">{t.stillQuestions}</h2>
            <p className="mt-1 text-[15px] font-semibold text-[var(--z-paper)]/85">{t.stillDesc}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 lg:justify-end">
            {links.map((l) => <Link key={l.href} href={l.href} className="z-btn z-btn--yellow z-btn--sm">{l.label}</Link>)}
            <a href="https://t.me/icomicsuz" target="_blank" rel="noreferrer" className="z-btn z-btn--paper z-btn--sm">{t.hub}</a>
          </div>
        </div>
      </main>
      <ZineFooter />
    </div>
  );
}
