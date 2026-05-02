'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Menu, UserCircle2 } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].nav;

  useEffect(() => {
    // Load persisted language after mount to avoid hydration mismatch
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      setLang(savedLang);
    }

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

    const handleLang = (e: Event) => {
      const nextLang = (e as CustomEvent<Lang>).detail;
      if (translations[nextLang]) {
        setLang(nextLang);
      }
    };
    window.addEventListener('langChange', handleLang);
    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setUser(null);
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navLinks = [
    { name: t.gallery, href: '/gallery' },
    { name: t.library, href: '/library' },
    { name: t.about, href: '/about' },
    { name: t.support, href: '/support' },
  ];

  const handleLangChange = (l: string) => {
    const newLang = l.toLowerCase() as Lang;
    setLang(newLang);
    writeStorageItem('lang', newLang);
    window.dispatchEvent(new CustomEvent('langChange', { detail: newLang }));
  };

  return (
    <nav className="fixed top-5 left-1/2 z-[1000] w-[min(96vw,88rem)] -translate-x-1/2 max-md:top-3">
      <div className="glass-panel relative flex items-center justify-between overflow-hidden rounded-3xl px-2 py-2 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-3xl border-white/20 bg-black/40 max-md:px-2">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#ff5a1f] via-[#ffd36b] to-[#73f7ff]" />

        {/* Branding */}
        <Link href="/" className="flex items-center gap-3 md:gap-4 pl-4 md:pl-6 group py-2 md:py-3 max-md:pl-2">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-colors duration-500 group-hover:bg-[#ff5a1f] md:h-12 md:w-12">
            <Image src="/logo.png" width={32} height={32} className="h-8 w-8 object-contain md:h-9 md:w-9" alt="iComics" />
          </div>
          <div className="flex flex-col">
            <span className="text-base md:text-lg font-display leading-none text-white tracking-tight uppercase">iComics</span>
            <span className="mt-0.5 text-[6px] md:text-[7px] font-black uppercase tracking-[0.4em] text-[#ffd36b]/80">Stream Protocol</span>
          </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-10 pr-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.36em] transition-all ${isActive
                    ? 'bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.28)]'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {link.name}
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full border border-white/10"
                  />
                )}
              </Link>
            );
          })}

          <div className="mx-1 h-4 w-px bg-white/20" />

          {/* New Language Switcher */}
          <div className="soft-chip flex items-center rounded-full p-0.5">
            {['EN', 'RU', 'UZ'].map((l) => (
              <button
                key={l}
                onClick={() => handleLangChange(l)}
                className={`rounded-full px-3 py-1.5 text-[8px] font-black transition-all ${lang === l.toLowerCase()
                    ? 'bg-[#ff5a1f] text-white shadow-[0_8px_18px_rgba(255,90,31,0.35)]'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="mx-1 h-4 w-px bg-white/20" />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Link 
                  href="/profile"
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white text-black transition-all hover:ring-4 hover:ring-[#ff5a1f]/30"
                >
                  {user.avatar ? (
                    <Image src={user.avatar} alt={user.username} width={44} height={44} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle2 size={18} />
                  )}
                </Link>

                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                  <div className="w-56 bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl p-2 backdrop-blur-xl">
                    <div className="px-4 py-3 border-b border-white/5 mb-2">
                      <p className="text-[10px] font-black uppercase tracking-tight text-white">{user.firstName} {user.lastName}</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/30">@{user.username}</p>
                    </div>
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/5 hover:text-white transition-all">
                      <UserCircle2 size={14} /> Profile
                    </Link>
                    <Link href="/studio" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/5 hover:text-white transition-all">
                      <Menu size={14} /> Studio
                    </Link>
                    <div className="h-px bg-white/5 my-2" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <X size={14} /> Logout_Session
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/auth" className="relative group">
              <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl border border-[#ff5a1f]/40 transition-transform group-hover:translate-x-0 group-hover:translate-y-0" />
              <button className="relative rounded-2xl border border-white/10 bg-white px-8 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-colors group-hover:bg-[#ff5a1f] group-hover:text-white">
                {t.registry}
              </button>
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="mr-1 rounded-2xl border border-white/10 bg-white/5 p-3 text-white transition-colors hover:text-[#ff5a1f] lg:hidden max-md:p-2"
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
            className="glass-panel absolute left-0 right-0 top-full mt-4 space-y-8 rounded-3xl p-6 shadow-2xl lg:hidden max-md:mt-2 max-md:p-5"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`rounded-2xl px-3 py-3 text-sm font-black uppercase tracking-[0.38em] transition-colors ${pathname === link.href ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                >
                  {link.name}
                </Link>
              ))}

              <div className="soft-chip flex items-center gap-2 rounded-2xl p-1">
                {['EN', 'RU', 'UZ'].map((l) => (
                  <button
                    key={l}
                    onClick={() => { handleLangChange(l); setIsOpen(false); }}
                    className={`flex-1 rounded-xl py-3 text-[10px] font-black tracking-widest transition-all ${lang === l.toLowerCase()
                        ? 'bg-[#ff5a1f] text-white'
                        : 'text-white/35 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="my-2 h-px w-full bg-white/10" />
              <Link
                href={user ? '/profile' : '/auth'}
                onClick={() => setIsOpen(false)}
                className="w-full rounded-2xl border border-white/10 bg-white py-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-black transition-colors hover:bg-[#ff5a1f] hover:text-white"
              >
                {user ? 'Profile' : t.registry}
              </Link>
              {user && (
                <>
                  <Link
                    href="/studio"
                    onClick={() => setIsOpen(false)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 py-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white transition-colors hover:bg-[#ff5a1f]"
                  >
                    {t.terminal}
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setIsOpen(false); }}
                    className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 py-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                  >
                    Logout_Session
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
