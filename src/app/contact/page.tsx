'use client';

import { useState, useEffect } from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Mail, Send, Globe } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';
import { TELEGRAM_CHANNEL_URL } from '@/lib/telegram-config';

export default function ContactPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].contact;

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      window.setTimeout(() => setLang(savedLang), 0);
    }

    const handleLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', handleLang as EventListener);
    return () => window.removeEventListener('langChange', handleLang as EventListener);
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
          className="wrap max-w-6xl space-y-14 py-14 sm:py-16 lg:py-20"
        >
          {/* Header */}
          <div className="space-y-5">
            <p className="ic-eyebrow">{t.badge}</p>
            <h1 className="ic-display text-balance text-4xl sm:text-5xl md:text-6xl">
               {t.titleLine1} <br /><span className="text-accent-text">{t.titleLine2}</span>
            </h1>
            <p className="font-display text-xl italic text-fg-secondary">&quot;{t.subtitle}&quot;</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
               <div className="space-y-8 rounded-card border border-line bg-card p-8">
                  <div className="space-y-2">
                    <span className="ic-eyebrow text-accent-text">{t.email}</span>
                    <div className="flex items-center gap-3 text-fg-secondary">
                       <Mail size={18} />
                       <a href="mailto:info@icomics.wiki" className="text-lg font-semibold text-fg hover:underline">info@icomics.wiki</a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="ic-eyebrow text-accent-text">{t.telegram}</span>
                    <div className="flex items-center gap-3 text-fg-secondary">
                       <Send size={18} />
                       <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer" className="text-lg font-semibold text-fg hover:underline">@icomicswiki</a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="ic-eyebrow">{t.domain}</span>
                    <div className="flex items-center gap-3 text-fg-secondary">
                       <Globe size={18} />
                       <span className="text-lg font-semibold text-fg">icomics.wiki</span>
                    </div>
                  </div>
               </div>

               <div className="rounded-card border border-line bg-raised p-8">
                  <div className="space-y-3">
                    <h4 className="ic-display text-2xl">{t.hq}</h4>
                    <p className="text-sm leading-relaxed text-fg-muted">
                      {t.hqAddress}
                    </p>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-8 rounded-card border border-line bg-card p-8 md:p-12">
               <h2 className="ic-display mb-10 text-3xl sm:text-4xl">{t.sendTitle}</h2>
               <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="ic-field">
                    <label className="ic-field__label">{t.alias}</label>
                    <input type="text" className="ic-input" placeholder={t.placeholderAlias} />
                  </div>
                  <div className="ic-field">
                    <label className="ic-field__label">{t.frequency}</label>
                    <input type="email" className="ic-input" placeholder={t.placeholderFreq} />
                  </div>
                  <div className="ic-field md:col-span-2">
                    <label className="ic-field__label">{t.subject}</label>
                    <input type="text" className="ic-input" placeholder={t.placeholderSub} />
                  </div>
                  <div className="ic-field md:col-span-2">
                    <label className="ic-field__label">{t.payload}</label>
                    <textarea className="ic-input min-h-[160px] py-3!" placeholder={t.placeholderMsg} />
                  </div>
                  <div className="md:col-span-2">
                    <button className="ic-btn ic-btn--primary ic-btn--lg ic-btn--block">
                       {t.sendBtn}
                    </button>
                  </div>
               </form>
            </div>
          </div>
        </m.div>
      </main>

      <Footer />
    </div>
    </LazyMotion>
  );
}
