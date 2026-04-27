'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Box, LayoutGrid, Info, X, Menu, Globe } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
}

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].nav;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) setUser(data.user);
      } catch {
        setUser(null);
      }
    };
    fetchUser();

    // Initial lang from storage
    const savedLang = localStorage.getItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      setLang(savedLang);
    }

    // Language listener
    const handleLang = (e: any) => {
      setLang(e.detail as Lang);
    };
    window.addEventListener('langChange', handleLang);
    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  const navLinks = [
    { name: t.gallery, href: '/gallery' },
    { name: t.about, href: '/about' },
    { name: t.support, href: '/support' },
  ];

  const handleLangChange = (l: string) => {
    const newLang = l.toLowerCase() as Lang;
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    window.dispatchEvent(new CustomEvent('langChange', { detail: newLang }));
  };

  return (
    <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-6xl">
      <div className="bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 p-1 flex items-center justify-between overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {/* Architectural Accent */}
        <div className="absolute top-0 left-0 w-1 h-full bg-[#ff4d00]" />
        
        {/* Branding */}
        <Link href="/" className="flex items-center gap-3 md:gap-4 pl-4 md:pl-6 group py-2 md:py-3">
           <div className="relative w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white border border-black group-hover:bg-[#ff4d00] transition-colors duration-500">
             <img src="/logo.png" className="w-4 h-4 md:w-5 md:h-5 object-contain" alt="iComics" />
           </div>
           <div className="flex flex-col">
             <span className="text-base md:text-lg font-display leading-none text-white tracking-tight uppercase">iComics</span>
             <span className="text-[6px] md:text-[7px] font-black uppercase tracking-[0.4em] text-[#ff4d00]/60 mt-0.5 animate-pulse">Foundry_Protocol</span>
           </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-10 pr-6">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-[10px] font-black uppercase tracking-[0.4em] transition-all py-4 nav-item ${isActive ? 'text-[#ff4d00]' : 'text-white/40 hover:text-white'}`}
              >
                {link.name}
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#ff4d00]"
                  />
                )}
              </Link>
            );
          })}
          
          <div className="w-[1px] h-4 bg-white/10 mx-2" />

          {/* New Language Switcher */}
          <div className="flex items-center border border-white/10 bg-white/5 p-0.5">
            {['EN', 'RU', 'UZ'].map((l) => (
              <button
                key={l}
                onClick={() => handleLangChange(l)}
                className={`px-3 py-1.5 text-[8px] font-black transition-all ${
                  lang === l.toLowerCase() 
                    ? 'bg-[#ff4d00] text-white shadow-[2px_2px_0_#000]' 
                    : 'text-white/30 hover:text-white hover:bg-white/5'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-4 bg-white/10 mx-2" />
          
          {user ? (
            <Link href="/studio" className="relative group">
              <div className="absolute inset-0 border border-[#ff4d00] translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
              <button className="relative px-6 py-2.5 bg-white text-black text-[9px] font-black uppercase tracking-widest border border-black group-hover:bg-[#ff4d00] group-hover:text-white transition-colors">
                {t.terminal}
              </button>
            </Link>
          ) : (
            <Link href="/auth" className="relative group">
              <div className="absolute inset-0 border border-[#ff4d00] translate-x-1.5 translate-y-1.5 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
              <button className="relative px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest border border-black group-hover:bg-[#ff4d00] group-hover:text-white transition-colors">
                {t.registry}
              </button>
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button 
          className="lg:hidden text-white p-3 hover:text-[#ff4d00] transition-colors bg-white/5 mr-1"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden absolute top-full left-0 right-0 mt-4 bg-[#0a0a0a] border border-white/10 p-10 space-y-8 shadow-2xl"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`text-sm font-black uppercase tracking-[0.4em] transition-colors ${pathname === link.href ? 'text-[#ff4d00]' : 'text-white/40'}`}
                >
                  {link.name}
                </Link>
              ))}

              <div className="flex items-center gap-2 bg-white/5 p-1 border border-white/10">
                {['EN', 'RU', 'UZ'].map((l) => (
                  <button
                    key={l}
                    onClick={() => { handleLangChange(l); setIsOpen(false); }}
                    className={`flex-1 py-3 text-[10px] font-black tracking-widest transition-all ${
                      lang === l.toLowerCase() 
                        ? 'bg-[#ff4d00] text-white' 
                        : 'text-white/30 hover:text-white'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="w-full h-[1px] bg-white/5 my-2" />
              <Link
                href={user ? '/studio' : '/auth'}
                onClick={() => setIsOpen(false)}
                className="w-full py-5 bg-white text-black text-center font-black uppercase tracking-[0.3em] text-[10px] hover:bg-[#ff4d00] hover:text-white transition-colors border-2 border-black"
              >
                {user ? t.terminal : t.registry}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
