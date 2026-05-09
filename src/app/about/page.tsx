'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white overflow-x-hidden dark:bg-[#020202] dark:text-white dark:selection:text-white">
      
      
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-36 pb-20 sm:pb-28 lg:pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-16 sm:space-y-24"
        >
          {/* Header */}
          <div className="text-center space-y-6 sm:space-y-8">
            <div className="inline-block bg-[#ff4d00] px-6 py-2 border border-neutral-200 dark:border-white/10 rounded-xl shadow-[6px_6px_0px_#000]">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">{t.origin}</span>
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-9xl font-display uppercase tracking-tighter leading-none italic text-balance">
               {t.titleLine1}{' '}
               <span className="text-[#3b82f6]">{t.titleLine2}</span>
            </h1>
            <p className="text-lg sm:text-2xl md:text-4xl font-sans font-black uppercase leading-tight tracking-tight border-y-4 border-black py-6 sm:py-8">
              {t.headline}
            </p>
            <div className="mx-auto max-w-3xl rounded-xl border border-neutral-200 bg-white/90 px-6 py-6 text-left shadow-[8px_8px_0_#000] dark:border-white/10 dark:bg-white/[0.04] sm:px-10 sm:py-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.45em] text-[#ff4d00]">{t.trustTitle}</h2>
              <p className="mt-4 text-sm font-medium leading-relaxed text-neutral-700 dark:text-white/70 sm:text-base">
                {t.trustBody}
              </p>
            </div>
            <div className="mx-auto max-w-3xl rounded-xl border border-[#3b82f6]/30 bg-white/95 px-6 py-6 text-left shadow-[8px_8px_0_#000] dark:border-[#3b82f6]/25 dark:bg-white/[0.06] sm:px-10 sm:py-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.45em] text-[#3b82f6]">{t.wikiIdentityTitle}</h2>
              <p className="mt-4 text-sm font-medium leading-relaxed text-neutral-700 dark:text-white/70 sm:text-base">
                {t.wikiIdentityBody}{' '}
                <Link href="/icomics-wiki" className="font-semibold text-[#ff5a1f] underline decoration-[#ff5a1f]/40 underline-offset-4">
                  /icomics-wiki
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Grid Layout for Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-12">
            <div className="p-6 sm:p-12 bg-white space-y-6 border border-neutral-200 dark:border-white/10 rounded-xl shadow-[12px_12px_0_#000]">
              <div className="w-16 h-16 bg-[#ff4d00] border border-neutral-200 dark:border-white/10 rounded-xl flex items-center justify-center shadow-[6px_6px_0px_#000]">
                <BookOpen size={32} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-tight text-balance">{t.missionTitle}</h2>
              <p className="text-lg opacity-60 font-medium leading-relaxed">
                {t.missionText}
              </p>
            </div>

            <div className="p-6 sm:p-12 bg-[#111111] text-white space-y-6 border-4 border-white shadow-[12px_12px_0_#fff]">
              <div className="w-16 h-16 bg-[#ff4d00] border-4 border-white flex items-center justify-center shadow-[6px_6px_0px_#fff]">
                <Zap size={32} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-tight text-balance">{t.techTitle}</h2>
              <p className="text-lg opacity-60 font-medium leading-relaxed">
                {t.techText}
              </p>
            </div>
          </div>

          <div className="space-y-8 sm:space-y-12">
            <h2 className="text-3xl sm:text-5xl font-display uppercase tracking-tighter italic text-balance">{t.whyExist}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
               {reasons.map((item, i) => (
                 <div key={i} className="border-l-4 border-black pl-6 space-y-2">
                   <h4 className="font-black uppercase text-[10px] tracking-[0.3em] text-[#e63946]">{item.title}</h4>
                   <p className="text-sm font-medium opacity-60">{item.text}</p>
                 </div>
               ))}
            </div>
          </div>

          {/* Contact Accent */}
          <div className="bg-[#ff4d00] border border-neutral-200 dark:border-white/10 rounded-xl p-6 sm:p-12 shadow-[12px_12px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
            <div>
              <h2 className="text-3xl sm:text-4xl font-display uppercase leading-none mb-2 text-balance">{t.joinTitle}</h2>
              <p className="font-black uppercase text-[10px] tracking-widest opacity-40">{t.joinSub}</p>
            </div>
            <Link href="/auth">
              <button className="rounded-lg border-2 border-white bg-black px-8 py-4 uppercase font-black tracking-widest text-white transition-all hover:bg-white hover:text-black md:px-12 md:py-6">
                {t.activeBtn}
              </button>
            </Link>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
