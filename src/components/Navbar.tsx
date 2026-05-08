'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Menu, UserCircle2, Settings2 } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
}

type NavbarProps = {
  /** Full-width black bar (home catalog / Marvel-style). Default: floating glass pill. */
  surface?: 'glass' | 'catalog';
};

export default function Navbar({ surface = 'glass' }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].nav;

  useEffect(() => {
    let t_timeout: NodeJS.Timeout;
    // Load persisted language after mount to avoid hydration mismatch
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      t_timeout = setTimeout(() => setLang(prev => (savedLang !== prev ? savedLang : prev)), 0);
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
      setLang(prev => (translations[nextLang] && nextLang !== prev ? nextLang : prev));
    };
    window.addEventListener('langChange', handleLang);
    return () => {
      window.removeEventListener('langChange', handleLang);
      clearTimeout(t_timeout);
    };
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

  const isCatalog = surface === 'catalog';

  return (
    <nav
      className={
        isCatalog
          ? 'fixed left-0 right-0 top-0 z-[1000] border-b border-white/10 bg-black'
          : 'fixed top-5 left-1/2 z-[1000] w-[min(96vw,86rem)] -translate-x-1/2 max-md:top-3'
      }
    >
      <div
        className={
          isCatalog
            ? 'relative mx-auto flex max-w-[100rem] items-center justify-between gap-3 overflow-visible px-4 py-2.5 sm:px-6 lg:px-10'
            : 'glass-panel relative flex items-center justify-between overflow-hidden rounded-[1.9rem] px-3 py-2 sm:px-2'
        }
      >
        {!isCatalog ? (
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        ) : null}

        {/* Branding */}
        <Link href="/" className="flex min-w-0 items-center gap-3 pl-2 pr-2 py-2 sm:gap-4 sm:pl-4 md:pl-6 md:py-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl transition-all duration-500 group-hover:border-[#ff5a1f]/50 md:h-12 md:w-12">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#ff5a1f]/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="font-accent text-xl z-10 transition-transform duration-500 group-hover:scale-110 leading-none" style={{letterSpacing: '0.02em'}}>
              <span className="text-white">i</span><span style={{color: '#ff5a1f'}}>C</span>
            </span>
          </div>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-lg md:text-xl font-accent leading-none tracking-wider select-none" style={{letterSpacing: '0.04em'}}>
              <span className="text-white">iComics</span>
              <span style={{color: '#ffd36b', margin: '0 1px'}}>·</span>
              <span style={{color: '#ff5a1f'}}>wiki</span>
            </span>
          </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-2 pr-4">
          <div className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.025] p-1 backdrop-blur-md">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-full px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.25em] transition-all ${isActive
                    ? 'bg-white text-black shadow-xl'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {link.name}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full border border-black/5"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mx-3 h-4 w-px bg-white/10" />

          {/* New Language Switcher */}
          <div className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.025] p-1 backdrop-blur-md">
            {['EN', 'RU', 'UZ'].map((l) => (
              <button
                key={l}
                onClick={() => handleLangChange(l)}
                className={`rounded-full px-3.5 py-2 text-[8px] font-black tracking-widest transition-all ${lang === l.toLowerCase()
                  ? 'bg-[#ff5a1f] text-white shadow-lg'
                  : 'text-white/30 hover:text-white hover:bg-white/5'
                  }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="mx-3 h-4 w-px bg-white/10" />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Link
                  href="/profile"
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-0.5 backdrop-blur-xl transition-all hover:border-[#ff5a1f]/50 hover:shadow-[0_0_20px_rgba(255,90,31,0.2)]"
                >
                  <div className="h-full w-full overflow-hidden rounded-[0.9rem] bg-white">
                    {user.avatar ? (
                      <Image src={user.avatar} alt={user.username} width={44} height={44} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-black text-white">
                        <UserCircle2 size={18} />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-[1100]">
                  <div className="w-56 bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl p-2 backdrop-blur-xl">
                    <div className="px-4 py-3 border-b border-white/5 mb-2">
                      <p className="text-[10px] font-black uppercase tracking-tight text-white">{user.firstName} {user.lastName}</p>
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Library Edition</span>
                    </div>
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/5 hover:text-white transition-all">
                      <UserCircle2 size={14} /> Profile
                    </Link>
                    <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/5 hover:text-white transition-all">
                      <Settings2 size={14} /> Settings
                    </Link>
                    <Link href="/studio" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/50 hover:bg-white/5 hover:text-white transition-all">
                      <Menu size={14} /> {t.terminal}
                    </Link>
                    <div className="h-px bg-white/5 my-2" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <X size={14} /> Log out
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
          className="mr-0 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white transition-colors hover:text-[#ff5a1f] lg:hidden sm:p-3"
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
            className="glass-panel absolute left-0 right-0 top-full mt-4 space-y-8 rounded-3xl p-5 shadow-2xl lg:hidden max-md:mt-2 max-md:p-4 backdrop-blur-md"
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
                    Log out
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
