'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { 
  ChevronDown, 
  HelpCircle, 
  MessageCircle, 
  Mail, 
  Search,
  ArrowRight,
  Shield,
  Zap,
  Globe
} from 'lucide-react';
import { translations, Lang } from '@/lib/translations';

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].faq;

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (e: any) => setLang(e.detail as Lang);
    window.addEventListener('langChange', handleLang);
    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  const FAQS = [
    { q: t.q1, a: t.a1 },
    { q: t.q2, a: t.a2 },
    { q: t.q3, a: t.a3 },
    { q: t.q4, a: t.a4 },
    { q: t.q5, a: t.a5 }
  ];

  return (
    <div className="min-h-screen bg-[#fcfaf2] text-[#111111] selection:bg-[#ffca3a] selection:text-black overflow-x-hidden halftone-bg">
      <div className="noise-overlay" />
      <div className="paper-grain" />
      <Navbar />

      <main className="container mx-auto px-8 pt-48 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-24"
        >
          {/* Header */}
          <div className="text-center space-y-8">
            <div className="inline-block bg-[#ffca3a] px-6 py-2 border-3 border-black shadow-[6px_6px_0px_#000]">
              <span className="text-black text-[10px] font-black uppercase tracking-[0.4em]">{t.badge}</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-display uppercase tracking-tighter leading-none italic">
               {t.title.split(' ')[0]} <br /><span className="text-[#3b82f6]">{t.title.split(' ')[1]}</span>
            </h1>
            <p className="text-xl font-editorial italic opacity-60">"{t.subtitle}"</p>
          </div>

          <div className="space-y-6">
            {FAQS.map((faq, i) => (
              <div 
                key={i} 
                className={`studio-panel bg-white border-4 border-black transition-all cursor-pointer ${openIndex === i ? 'shadow-[12px_12px_0px_#ffca3a]' : 'shadow-[6px_6px_0px_#000]'}`}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <div className="p-8 flex items-center justify-between gap-8">
                   <div className="flex items-center gap-6">
                      <span className="text-3xl font-display text-[#e63946]">0{i+1}</span>
                      <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">{faq.q}</h3>
                   </div>
                   <motion.div
                     animate={{ rotate: openIndex === i ? 180 : 0 }}
                   >
                     <ChevronDown size={24} />
                   </motion.div>
                </div>
                <motion.div
                  initial={false}
                  animate={{ height: openIndex === i ? 'auto' : 0, opacity: openIndex === i ? 1 : 0 }}
                  className="overflow-hidden"
                >
                   <div className="px-8 pb-10 pt-4 border-t-2 border-black/5">
                      <p className="text-lg opacity-60 leading-relaxed font-medium max-w-2xl">
                        {faq.a}
                      </p>
                   </div>
                </motion.div>
              </div>
            ))}
          </div>

          {/* Still have questions? */}
          <div className="text-center space-y-8 py-20 border-t-4 border-black border-dashed">
             <h2 className="text-4xl font-display uppercase tracking-tight">{t.stillQuestions}</h2>
             <p className="text-lg opacity-60">{t.stillDesc}</p>
             <div className="flex justify-center gap-8">
                <Link href="/contact" className="ink-stroke text-[10px] font-black uppercase tracking-[0.4em] hover:text-[#e63946] transition-colors">{t.dept}</Link>
                <a href="https://t.me/icomicsuz" target="_blank" className="ink-stroke text-[10px] font-black uppercase tracking-[0.4em] hover:text-[#3b82f6] transition-colors">{t.hub}</a>
             </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
