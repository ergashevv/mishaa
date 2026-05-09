'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white overflow-x-hidden dark:bg-[#020202] dark:text-white dark:selection:text-white ">
      <Navbar />

      <main className="container mx-auto px-8 pt-28 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-24"
        >
          <div className="text-center space-y-8">
            <div className="inline-block bg-[#ff4d00] px-6 py-2 border border-neutral-200 dark:border-white/10 rounded-xl shadow-[6px_6px_0px_#000]">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">{t.badge}</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-display uppercase tracking-tighter leading-none italic">
              {t.titleLine1} <br />
              <span className="text-[#3b82f6]">{t.titleLine2}</span>
            </h1>
            <p className="text-xl font-editorial italic opacity-60">&quot;{t.subtitle}&quot;</p>
          </div>

          <div className="space-y-6">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className={` bg-white border border-neutral-200 dark:border-white/10 rounded-xl transition-all cursor-pointer ${openIndex === i ? 'shadow-[12px_12px_0px_#ffca3a]' : 'shadow-[6px_6px_0px_#000]'}`}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <div className="p-8 flex items-center justify-between gap-8">
                  <div className="flex items-center gap-6">
                    <span className="text-3xl font-display text-[#e63946]">0{i + 1}</span>
                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">{faq.q}</h3>
                  </div>
                  <motion.div animate={{ rotate: openIndex === i ? 180 : 0 }}>
                    <ChevronDown size={24} />
                  </motion.div>
                </div>
                <motion.div
                  initial={false}
                  animate={{ height: openIndex === i ? 'auto' : 0, opacity: openIndex === i ? 1 : 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-8 pb-10 pt-4 border-t-2 border-neutral-100 dark:border-white/5">
                    <p className="text-lg opacity-60 leading-relaxed font-medium max-w-2xl">{faq.a}</p>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>

          <div className="text-center space-y-8 py-20 border-t-4 border-black border-dashed">
            <h2 className="text-4xl font-display uppercase tracking-tight">{t.stillQuestions}</h2>
            <p className="text-lg opacity-60">{t.stillDesc}</p>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
              <Link
                href="/icomics-wiki"
                className="ink-stroke text-[10px] font-black uppercase tracking-[0.4em] hover:text-[#3b82f6] transition-colors"
              >
                {t.wikiExplainerCta}
              </Link>
              <Link
                href="/contact"
                className="ink-stroke text-[10px] font-black uppercase tracking-[0.4em] hover:text-[#e63946] transition-colors"
              >
                {t.dept}
              </Link>
              <Link
                href="/guides"
                className="ink-stroke text-[10px] font-black uppercase tracking-[0.4em] hover:text-[#ff5a1f] transition-colors"
              >
                {footerT.guides}
              </Link>
              <Link
                href="/reading"
                className="ink-stroke text-[10px] font-black uppercase tracking-[0.4em] hover:text-[#ff5a1f] transition-colors"
              >
                {footerT.readingHub}
              </Link>
              <a
                href="https://t.me/icomicsuz"
                target="_blank"
                rel="noreferrer"
                className="ink-stroke text-[10px] font-black uppercase tracking-[0.4em] hover:text-[#3b82f6] transition-colors"
              >
                {t.hub}
              </a>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
