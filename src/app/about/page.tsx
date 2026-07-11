'use client';

/** About — rebuilt in the Bold Pop Zine language. Reuses only the i18n copy. */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { Zap, BookOpen } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function AboutPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].about;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const reasons = [
    { title: t.reason1T, text: t.reason1D, color: 'var(--z-red)' },
    { title: t.reason2T, text: t.reason2D, color: 'var(--z-blue)' },
    { title: t.reason3T, text: t.reason3D, color: 'var(--z-green)' },
  ];

  return (
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-6xl space-y-16 py-14">
        {/* hero */}
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <div>
            <span className="z-tag z-tag--red">{t.origin}</span>
            <h1 className="z-display mt-4 text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.8]">{t.titleLine1} {t.titleLine2}</h1>
            <p className="mt-6 max-w-xl border-y-[2.5px] border-[var(--z-ink)] py-6 text-[19px] font-bold leading-relaxed text-[var(--z-ink)]">{t.headline}</p>
          </div>
          <div className="space-y-5">
            <div className="z-box p-6"><h2 className="z-kicker text-[var(--z-red)]">{t.trustTitle}</h2><p className="mt-3 text-[14px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{t.trustBody}</p></div>
            <div className="z-box p-6"><h2 className="z-kicker text-[var(--z-ink-2)]">{t.wikiIdentityTitle}</h2><p className="mt-3 text-[14px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{t.wikiIdentityBody}{' '}<Link href="/icomics-wiki" className="font-black text-[var(--z-red)] underline underline-offset-4">/icomics-wiki</Link>.</p></div>
          </div>
        </div>

        {/* mission + tech */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="z-box p-6 sm:p-10" style={{ background: 'var(--z-yellow)' }}>
            <span className="grid h-14 w-14 place-items-center rounded-[8px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] shadow-[3px_3px_0_var(--z-ink)]"><BookOpen size={28} strokeWidth={2.5} /></span>
            <h2 className="z-display mt-5 text-[clamp(1.6rem,3vw,2.4rem)] leading-[0.9]">{t.missionTitle}</h2>
            <p className="mt-3 max-w-lg text-[16px] font-semibold leading-relaxed text-[var(--z-ink)]">{t.missionText}</p>
          </div>
          <div className="z-box p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-[8px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-blue)] text-white shadow-[3px_3px_0_var(--z-ink)]"><Zap size={24} strokeWidth={2.5} /></span>
            <h2 className="z-display mt-5 text-[clamp(1.4rem,2.5vw,2rem)] leading-[0.9]">{t.techTitle}</h2>
            <p className="mt-3 text-[14px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{t.techText}</p>
          </div>
        </div>

        {/* why */}
        <div>
          <h2 className="z-display mb-8 text-[clamp(2rem,5vw,3.4rem)] leading-[0.82]">{t.whyExist}</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {reasons.map((item, i) => (
              <div key={i} className="z-box relative overflow-hidden p-6">
                <span aria-hidden className="z-display pointer-events-none absolute -top-4 right-2 select-none text-[6rem] leading-none" style={{ color: item.color, opacity: 0.25 }}>{String(i + 1).padStart(2, '0')}</span>
                <div className="relative border-l-4 pl-4" style={{ borderColor: item.color }}>
                  <h4 className="z-kicker" style={{ color: item.color }}>{item.title}</h4>
                  <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* join */}
        <div className="z-box flex flex-col items-start justify-between gap-6 p-6 sm:p-10 md:flex-row md:items-center" style={{ background: 'var(--z-red)' }}>
          <div>
            <h2 className="z-display text-[clamp(1.8rem,4vw,3rem)] leading-[0.85] text-[var(--z-paper)]">{t.joinTitle}</h2>
            <p className="z-kicker mt-2 text-[var(--z-paper)]/80">{t.joinSub}</p>
          </div>
          <Link href="/auth" className="z-btn z-btn--yellow text-[16px]">{t.activeBtn}</Link>
        </div>
      </main>
      <ZineFooter />
    </div>
  );
}
