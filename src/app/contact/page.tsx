'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Mail, Send, MapPin, Globe } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

export default function ContactPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].contact;

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (e: any) => setLang(e.detail as Lang);
    window.addEventListener('langChange', handleLang);
    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#ff4d00] selection:text-white overflow-x-hidden ">
      
      
      <Navbar />

      <main className="container mx-auto px-8 pt-48 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto space-y-24"
        >
          {/* Header */}
          <div className="text-center space-y-8">
            <div className="inline-block bg-[#ff4d00] px-6 py-2 border border-white/10 rounded-xl shadow-[6px_6px_0px_#000]">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">{t.badge}</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-display uppercase tracking-tighter leading-none italic">
               {t.title.split(' ')[0]} <br /><span className="text-[#3b82f6]">{t.title.split(' ')[1]}</span>
            </h1>
            <p className="text-xl font-editorial italic opacity-60">"{t.subtitle}"</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-8">
               <div className=" p-10 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl space-y-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#e63946]">{t.email}</span>
                    <div className="flex items-center gap-4">
                       <Mail size={18} />
                       <a href="mailto:info@comics.uz" className="text-xl font-black hover:underline tracking-tight">info@comics.uz</a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#3b82f6]">{t.telegram}</span>
                    <div className="flex items-center gap-4">
                       <Send size={18} />
                       <a href="https://t.me/icomicsuz" target="_blank" className="text-xl font-black hover:underline tracking-tight">@icomicsuz</a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{t.domain}</span>
                    <div className="flex items-center gap-4">
                       <Globe size={18} />
                       <span className="text-xl font-black tracking-tight">icomics.uz</span>
                    </div>
                  </div>
               </div>

               <div className=" p-10 bg-[#0a0a0a] border border-white/10 rounded-3xl relative overflow-hidden">
                  <div className="absolute inset-0  opacity-10" />
                  <div className="relative z-10 space-y-4">
                    <h4 className="text-2xl font-display uppercase italic">{t.hq}</h4>
                    <p className="text-sm opacity-60 leading-relaxed uppercase font-black tracking-wider">
                      {t.hqAddress}
                    </p>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-8  p-12 md:p-16 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
               <h2 className="text-4xl font-display uppercase tracking-tight mb-12 italic underline decoration-[#ffca3a] decoration-4">{t.sendTitle}</h2>
               <form className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">{t.alias}</label>
                    <input type="text" className="w-full bg-transparent border border-white/20 rounded-xl px-6 text-white py-4 text-xs font-bold focus:outline-none focus:bg-[#ff4d00]/10" placeholder={t.placeholderAlias} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">{t.frequency}</label>
                    <input type="email" className="w-full bg-transparent border border-white/20 rounded-xl px-6 text-white py-4 text-xs font-bold focus:outline-none focus:bg-[#ff4d00]/10" placeholder={t.placeholderFreq} />
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">{t.subject}</label>
                    <input type="text" className="w-full bg-transparent border border-white/20 rounded-xl px-6 text-white py-4 text-xs font-bold focus:outline-none focus:bg-[#ff4d00]/10" placeholder={t.placeholderSub} />
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">{t.payload}</label>
                    <textarea className="w-full bg-transparent border border-white/20 rounded-xl px-6 text-white py-4 text-xs font-bold focus:outline-none focus:bg-[#ff4d00]/10 min-h-[160px]" placeholder={t.placeholderMsg} />
                  </div>
                  <div className="md:col-span-2">
                    <button className="px-8 py-4 uppercase font-black tracking-widest transition-all rounded-lg w-full py-8 text-xl bg-black text-white hover:bg-[#ff4d00] transition-colors border-2 border-white">
                       {t.sendBtn}
                    </button>
                  </div>
               </form>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
