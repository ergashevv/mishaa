'use client';

import { useEffect, useState } from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Eye, Lock, FileText } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function PrivacyPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].privacy;

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    const timer =
      savedLang && translations[savedLang]
        ? window.setTimeout(() => setLang((c) => (savedLang !== c ? savedLang : c)), 0)
        : undefined;
    const handleLang = (event: Event) => setLang((event as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', handleLang as EventListener);
    return () => {
      window.removeEventListener('langChange', handleLang as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main className="pt-nav-catalog">
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          className="wrap max-w-3xl py-14 sm:py-16 lg:py-20"
        >
          <div className="mb-14 rounded-card border border-line bg-card p-6 text-center sm:p-10 md:p-14">
            <div className="space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-accent-tint text-accent-text">
                <Shield size={32} />
              </div>
              <p className="ic-eyebrow">{t.eyebrow}</p>
              <h1 className="ic-display text-balance text-4xl text-fg sm:text-5xl md:text-6xl">
                {t.titleLine1} <br />
                {t.titleLine2}
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-relaxed text-fg-secondary">{t.subtitle}</p>
            </div>
          </div>

          <div className="space-y-12">
            <section className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                  <Eye size={22} />
                </div>
                <h2 className="ic-display text-balance text-2xl text-fg sm:text-3xl">{t.s1Title}</h2>
              </div>
              <p className="text-sm leading-relaxed text-fg-secondary sm:pl-[60px] sm:text-base">{t.s1Body}</p>
            </section>

            <section className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                  <Lock size={22} />
                </div>
                <h2 className="ic-display text-balance text-2xl text-fg sm:text-3xl">{t.s2Title}</h2>
              </div>
              <p className="text-sm leading-relaxed text-fg-secondary sm:pl-[60px] sm:text-base">{t.s2Body}</p>
            </section>

            <section className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                  <FileText size={22} />
                </div>
                <h2 className="ic-display text-balance text-2xl text-fg sm:text-3xl">{t.s3Title}</h2>
              </div>
              <p className="text-sm leading-relaxed text-fg-secondary sm:pl-[60px] sm:text-base">{t.s3Body}</p>
            </section>

            <div className="space-y-3 rounded-card border border-dashed border-line bg-card p-6 text-center text-fg-secondary sm:p-10">
              <p className="ic-eyebrow">{t.footerRegistry}</p>
              <div className="mx-auto max-w-lg text-xs leading-relaxed">{t.footerContact}</div>
            </div>
          </div>
        </m.div>
      </main>

      <Footer />
    </div>
    </LazyMotion>
  );
}
