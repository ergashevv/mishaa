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
    <footer className="relative overflow-hidden border-t-8 border-neutral-900 bg-neutral-100 py-16 text-neutral-900 sm:py-20 lg:py-24 dark:border-black dark:bg-[#111111] dark:text-white">
      <div className="absolute inset-0 halftone-bg pointer-events-none opacity-[0.07] dark:opacity-10" />
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-12 lg:flex-row lg:gap-24">
          <div className="space-y-8 sm:space-y-10 lg:space-y-12">
            <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-neutral-900 bg-neutral-900 sm:h-14 sm:w-14 lg:h-16 lg:w-16 lg:border-4 dark:border-white dark:bg-black">
              <span className="text-3xl font-display font-black text-white max-md:text-xl">iC</span>
            </div>
              <div className="flex flex-col">
                <h2 className="text-3xl font-display uppercase leading-none text-neutral-900 sm:text-4xl dark:text-white">iComics.wiki</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Official Library</span>
              </div>
            </div>
            <div className="max-w-xs space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] leading-loose text-neutral-600 opacity-80 dark:text-white dark:opacity-40">
                Independent Comic Synthesis Protocol<br />
                Developed by iComics.wiki Collective 2026<br />
                icomics.wiki | Sequential Production
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-12 lg:gap-24">
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.studio}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-white/60">
                <Link href="/studio" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">{t.launch}</Link>
                <Link href="/gallery" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">{t.archives}</Link>
                <Link href="/about" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">{t.about}</Link>
              </div>
            </div>
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.support}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-white/60">
                <Link href="/faq" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">{t.faq}</Link>
                <Link href="/guides" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">{t.guides}</Link>
                <Link href="/support" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">{t.customer}</Link>
                <Link href="/settings" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">Settings</Link>
                <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">Telegram: @icomicswiki</a>
              </div>
            </div>
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">{t.legal}</span>
              <div className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-white/60">
                <Link href="/privacy" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">Privacy Policy</Link>
                <Link href="/terms" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">Terms</Link>
                <Link href="/content-policy" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">Content Policy</Link>
                <Link href="/dmca" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">DMCA</Link>
                <Link href="/contact" className="transition-all hover:translate-x-2 hover:text-[#ff4d00] dark:hover:text-white">Contact: info@icomics.wiki</Link>
                <span className="text-neutral-500 opacity-70 dark:text-white dark:opacity-30">© 2026 icomics.wiki</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
