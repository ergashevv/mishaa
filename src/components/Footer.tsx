'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';
import { TELEGRAM_CHANNEL_URL } from '@/lib/telegram-config';

export default function Footer() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].footer;

  useEffect(() => {
    let t_timeout: NodeJS.Timeout;
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      t_timeout = setTimeout(() => setLang(prev => (savedLang !== prev ? savedLang : prev)), 0);
    }

    const handleLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', handleLang as EventListener);
    return () => {
      window.removeEventListener('langChange', handleLang as EventListener);
      clearTimeout(t_timeout);
    };
  }, []);

  return (
    <footer className="relative overflow-hidden border-t-8 border-black bg-[#111111] py-16 text-white sm:py-20 lg:py-24">
      <div className="absolute inset-0 halftone-bg opacity-10 pointer-events-none" />
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-12 lg:flex-row lg:gap-24">
          <div className="space-y-8 sm:space-y-10 lg:space-y-12">
            <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white bg-black sm:h-14 sm:w-14 lg:h-16 lg:w-16 lg:border-4">
              <span className="text-3xl font-display font-black text-white max-md:text-xl">iC</span>
            </div>
              <div className="flex flex-col">
                <h2 className="text-3xl font-display uppercase leading-none sm:text-4xl">iComics.wiki</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Studio Edition</span>
              </div>
            </div>
            <div className="max-w-xs space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 leading-loose">
                Independent Comic Synthesis Protocol<br />
                Developed by iComics.wiki Collective 2026<br />
                icomics.wiki | Sequential Production
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-12 lg:gap-24">
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.studio}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                <Link href="/studio" className="hover:text-white hover:translate-x-2 transition-all">{t.launch}</Link>
                <Link href="/gallery" className="hover:text-white hover:translate-x-2 transition-all">{t.archives}</Link>
                <Link href="/about" className="hover:text-white hover:translate-x-2 transition-all">{t.about}</Link>
              </div>
            </div>
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.support}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                <Link href="/faq" className="hover:text-white hover:translate-x-2 transition-all">{t.faq}</Link>
                <Link href="/support" className="hover:text-white hover:translate-x-2 transition-all">{t.customer}</Link>
                <Link href="/settings" className="hover:text-white hover:translate-x-2 transition-all">Settings</Link>
                <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer" className="hover:text-white hover:translate-x-2 transition-all">Telegram: @icomicswiki</a>
              </div>
            </div>
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.legal}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                <Link href="/privacy" className="hover:text-white hover:translate-x-2 transition-all">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white hover:translate-x-2 transition-all">Terms</Link>
                <Link href="/content-policy" className="hover:text-white hover:translate-x-2 transition-all">Content Policy</Link>
                <Link href="/dmca" className="hover:text-white hover:translate-x-2 transition-all">DMCA</Link>
                <Link href="/contact" className="hover:text-white hover:translate-x-2 transition-all">Contact: info@icomics.wiki</Link>
                <span className="opacity-30">© 2026 icomics.wiki</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
