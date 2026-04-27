'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { translations, Lang } from '@/lib/translations';

export default function Footer() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].footer;

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (e: any) => setLang(e.detail as Lang);
    window.addEventListener('langChange', handleLang);
    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  return (
    <footer className="py-24 bg-[#111111] text-white overflow-hidden relative border-t-8 border-black">
      <div className="absolute inset-0 halftone-bg opacity-10 pointer-events-none" />
      <div className="container mx-auto px-8 relative z-10">
        <div className="flex flex-col lg:flex-row justify-between gap-24">
          <div className="space-y-12">
            <div className="flex items-center gap-6">
              <img src="/logo.png" className="w-auto h-16 invert" alt="iComics" />
              <div className="flex flex-col">
                <h2 className="text-4xl font-display uppercase leading-none">iComics</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Studio Edition</span>
              </div>
            </div>
            <div className="max-w-xs space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 leading-loose">
                Independent Comic Synthesis Protocol<br />
                Developed by iComics Collective 2026<br />
                icomics.uz | Sequential Production
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-24">
            <div className="space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.studio}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                <Link href="/studio" className="hover:text-white hover:translate-x-2 transition-all">{t.launch}</Link>
                <Link href="/gallery" className="hover:text-white hover:translate-x-2 transition-all">{t.archives}</Link>
                <Link href="/about" className="hover:text-white hover:translate-x-2 transition-all">{t.about}</Link>
              </div>
            </div>
            <div className="space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.support}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                <Link href="/faq" className="hover:text-white hover:translate-x-2 transition-all">{t.faq}</Link>
                <Link href="/support" className="hover:text-white hover:translate-x-2 transition-all">{t.customer}</Link>
                <a href="https://t.me/icomicsuz" target="_blank" className="hover:text-white hover:translate-x-2 transition-all">Telegram: @icomicsuz</a>
              </div>
            </div>
            <div className="space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.legal}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                <Link href="/privacy" className="hover:text-white hover:translate-x-2 transition-all">Privacy Policy</Link>
                <Link href="/contact" className="hover:text-white hover:translate-x-2 transition-all">Contact: info@comics.uz</Link>
                <span className="opacity-30">© 2026 icomics.uz</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
