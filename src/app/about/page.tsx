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
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (e: any) => setLang(e.detail as Lang);
    window.addEventListener('langChange', handleLang);
    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  const reasons = [
    { title: t.reason1T, text: t.reason1D },
    { title: t.reason2T, text: t.reason2D },
    { title: t.reason3T, text: t.reason3D }
  ];

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#ff4d00] selection:text-white overflow-x-hidden ">
      
      
      <Navbar />

      <main className="container mx-auto px-8 pt-48 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-24"
        >
          {/* Header */}
          <div className="text-center space-y-8">
            <div className="inline-block bg-[#ff4d00] px-6 py-2 border border-white/10 rounded-xl shadow-[6px_6px_0px_#000]">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">{t.origin}</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-display uppercase tracking-tighter leading-none italic">
               THIS IS <span className="text-[#3b82f6]">ICOMICS.</span>
            </h1>
            <p className="text-2xl md:text-4xl font-sans font-black uppercase leading-tight tracking-tight border-y-4 border-black py-8">
              {t.headline}
            </p>
          </div>

          {/* Grid Layout for Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className=" p-12 bg-white space-y-6 border border-white/10 rounded-xl shadow-[12px_12px_0_#000]">
              <div className="w-16 h-16 bg-[#ff4d00] border border-white/10 rounded-xl flex items-center justify-center shadow-[6px_6px_0px_#000]">
                <BookOpen size={32} />
              </div>
              <h2 className="text-4xl font-display uppercase tracking-tight">{t.missionTitle}</h2>
              <p className="text-lg opacity-60 font-medium leading-relaxed">
                {t.missionText}
              </p>
            </div>

            <div className=" p-12 bg-[#111111] text-white space-y-6 border-4 border-white shadow-[12px_12px_0_#fff]">
              <div className="w-16 h-16 bg-[#ff4d00] border-4 border-white flex items-center justify-center shadow-[6px_6px_0px_#fff]">
                <Zap size={32} />
              </div>
              <h2 className="text-4xl font-display uppercase tracking-tight">{t.techTitle}</h2>
              <p className="text-lg opacity-60 font-medium leading-relaxed">
                {t.techText}
              </p>
            </div>
          </div>

          <div className="space-y-12">
            <h2 className="text-5xl font-display uppercase tracking-tighter italic">{t.whyExist}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
               {reasons.map((item, i) => (
                 <div key={i} className="border-l-4 border-black pl-6 space-y-2">
                   <h4 className="font-black uppercase text-[10px] tracking-[0.3em] text-[#e63946]">{item.title}</h4>
                   <p className="text-sm font-medium opacity-60">{item.text}</p>
                 </div>
               ))}
            </div>
          </div>

          {/* Contact Accent */}
          <div className="bg-[#ff4d00] border border-white/10 rounded-xl p-12 shadow-[12px_12px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-4xl font-display uppercase leading-none mb-2">{t.joinTitle}</h2>
              <p className="font-black uppercase text-[10px] tracking-widest opacity-40">{t.joinSub}</p>
            </div>
            <Link href="/auth">
              <button className="px-8 py-4 uppercase font-black tracking-widest transition-all rounded-lg bg-black text-white px-12 py-6 border-2 border-white hover:bg-white hover:text-white transition-all">
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
