'use client';

/** Privacy — rebuilt in the Bold Pop Zine language. Reuses only the i18n copy. */

import { useEffect, useState } from 'react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { Shield, Eye, Lock, FileText } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function PrivacyPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].privacy;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const sections = [
    { icon: Eye, title: t.s1Title, body: t.s1Body, color: 'var(--z-blue)' },
    { icon: Lock, title: t.s2Title, body: t.s2Body, color: 'var(--z-red)' },
    { icon: FileText, title: t.s3Title, body: t.s3Body, color: 'var(--z-green)' },
  ];

  return (
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-3xl py-14">
        <div className="z-box mb-14 p-8 text-center sm:p-12" style={{ background: 'var(--z-yellow)' }}>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[10px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] shadow-[4px_4px_0_var(--z-ink)]"><Shield size={32} strokeWidth={2.5} /></span>
          <span className="z-kicker mt-5 block text-[var(--z-ink)]">{t.eyebrow}</span>
          <h1 className="z-display mt-2 text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.82]">{t.titleLine1} {t.titleLine2}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] font-semibold leading-relaxed text-[var(--z-ink)]">{t.subtitle}</p>
        </div>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.title}>
              <div className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[7px] border-2 border-[var(--z-ink)] text-white shadow-[2px_2px_0_var(--z-ink)]" style={{ background: s.color }}><s.icon size={22} strokeWidth={2.5} /></span>
                <h2 className="z-display text-[clamp(1.4rem,3vw,2rem)] leading-[0.9]">{s.title}</h2>
              </div>
              <p className="mt-4 text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)] sm:pl-[60px]">{s.body}</p>
            </section>
          ))}

          <div className="z-box border-dashed p-6 text-center sm:p-8">
            <span className="z-kicker text-[var(--z-ink-2)]">{t.footerRegistry}</span>
            <div className="mx-auto mt-3 max-w-lg text-[13px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{t.footerContact}</div>
          </div>
        </div>
      </main>
      <ZineFooter />
    </div>
  );
}
