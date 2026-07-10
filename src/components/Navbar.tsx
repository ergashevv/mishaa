'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { X, Menu, UserCircle2, Settings2, Sun, Moon } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { htmlLangFromUiLang } from '@/lib/i18n/lang';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { persistUiLangCookie } from '@/lib/i18n/ui-lang-cookie-client';
import { uiLangToPreferredMangaLanguage } from '@/lib/i18n/ui-lang-to-manga';
import { persistStoredMangaLanguage } from '@/lib/manga-language';

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
}

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('icw-theme', theme);
  } catch {
    // Private mode — theme still applies for this page view.
  }
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);

  const t = translations[lang].nav;

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

    // Apply the persisted language synchronously on mount (no setTimeout). The first
    // render is 'en' on both server and client, so updating state here causes no
    // hydration mismatch — just an immediate swap instead of a deferred flash.
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      setLang(prev => (savedLang !== prev ? savedLang : prev));
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
    };
  }, []);

  // Close the account menu on outside click or Escape (Escape restores focus
  // to the trigger so keyboard users don't lose their place).
  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

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
    { name: t.library, href: '/library' },
    { name: t.guides, href: '/guides' },
    { name: t.readingHub, href: '/reading' },
    { name: t.about, href: '/about' },
    { name: t.support, href: '/support' },
  ];

  const handleLangChange = (nextLang: Lang) => {
    if (!translations[nextLang]) return;
    setLang(nextLang);
    writeStorageItem('lang', nextLang);
    persistUiLangCookie(nextLang);
    persistStoredMangaLanguage(uiLangToPreferredMangaLanguage(nextLang));
    window.dispatchEvent(new CustomEvent('langChange', { detail: nextLang }));
    // Flip <html lang> immediately for screen readers, then re-render the server tree
    // (sr-only H1, skip-link, any SSR copy) from the freshly-written cookie — without a
    // hard reload or losing client state. Fixes "language only half-switches".
    if (typeof document !== 'undefined') {
      document.documentElement.lang = htmlLangFromUiLang(nextLang);
    }
    router.refresh();
  };

  const langSwitcher: { short: string; code: Lang; ariaName: string }[] = [
    { short: 'EN', code: 'en', ariaName: 'English' },
    { short: 'JA', code: 'ja', ariaName: 'Japanese' },
    { short: 'KO', code: 'ko', ariaName: 'Korean' },
    { short: 'ZH', code: 'zh', ariaName: 'Chinese' },
    { short: 'RU', code: 'ru', ariaName: 'Russian' },
  ];

  return (
    <LazyMotion features={domAnimation} strict>
    <nav className="fixed left-0 right-0 top-0 z-[1000] border-b border-line-subtle bg-[color-mix(in_oklab,var(--surface-app)_82%,transparent)] pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[var(--page-max)] items-center gap-6 px-5 sm:px-8">
        {/* Branding — the logo stays as-is (fixed asset) */}
        <Link href="/" className="flex min-w-0 items-center gap-3 py-2 group">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-2xl transition-all duration-500 group-hover:border-[#ff5a1f]/50 md:h-12 md:w-12 dark:border-white/10 dark:bg-black/40">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#ff5a1f]/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="font-accent text-xl z-10 transition-transform duration-500 group-hover:scale-110 leading-none" style={{letterSpacing: '0.02em'}}>
              <span className="text-neutral-900 dark:text-white">i</span><span style={{color: '#ff5a1f'}}>C</span>
            </span>
          </div>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-lg md:text-xl font-accent leading-none tracking-wider select-none" style={{letterSpacing: '0.04em'}}>
              <span className="text-neutral-900 dark:text-white">iComics</span>
              <span style={{color: '#ffd36b', margin: '0 1px'}}>·</span>
              <span style={{color: '#ff5a1f'}}>wiki</span>
            </span>
          </div>
        </Link>

        {/* Desktop nav — active route gets a marigold underline bar, not just a color swap,
            so wayfinding reads at a glance instead of requiring a close look at text color. */}
        <div className="ml-3 hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-fg' : 'text-fg-secondary hover:text-fg'
                }`}
              >
                {link.name}
                <span
                  aria-hidden
                  className={`absolute -bottom-[2px] left-0 right-0 h-[2px] rounded-full bg-accent transition-opacity duration-[var(--dur-base)] ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="hidden items-center gap-0.5 rounded-full border border-line p-0.5 md:flex">
            {langSwitcher.map(({ short, code, ariaName }) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLangChange(code)}
                aria-label={`Switch interface language to ${ariaName}`}
                aria-current={lang === code ? 'true' : undefined}
                className={`rounded-full px-2 py-1.5 font-mono text-[11px] tracking-[0.08em] transition-colors ${
                  lang === code
                    ? 'bg-accent-tint text-accent-text'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {short}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="ic-iconbtn ic-iconbtn--sm ic-iconbtn--solid"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {user ? (
            <div ref={accountMenuRef} className="relative hidden lg:block group">
              <button
                ref={accountButtonRef}
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls="navbar-account-menu"
                aria-label={t.accountMenu}
                className="ic-avatar ic-avatar--md transition-shadow hover:shadow-[var(--glow-accent)]"
              >
                {user.avatar ? (
                  <Image src={user.avatar} alt={user.username} width={38} height={38} className="h-full w-full object-cover" />
                ) : (
                  <UserCircle2 size={18} />
                )}
              </button>

              {/* Dropdown — opens on click/Enter (state) and stays hover-friendly (CSS) */}
              <div
                id="navbar-account-menu"
                className={`absolute right-0 top-full z-[1100] pt-3 transition-all duration-200 ${
                  accountMenuOpen
                    ? 'visible translate-y-0 opacity-100'
                    : 'invisible translate-y-2 opacity-0 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100'
                }`}
              >
                <div className="w-56 rounded-card border border-line bg-raised p-2 shadow-[var(--shadow-lg)]">
                  <div className="mb-2 border-b border-line-subtle px-3 py-2.5">
                    <p className="text-sm font-semibold text-fg">{user.firstName} {user.lastName}</p>
                    <span className="ic-eyebrow">{t.libraryEditionBadge}</span>
                  </div>
                  <Link href="/profile" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-btn px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-card-hov hover:text-fg">
                    <UserCircle2 size={15} /> {t.accountProfile}
                  </Link>
                  <Link href="/settings" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 rounded-btn px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-card-hov hover:text-fg">
                    <Settings2 size={15} /> {t.accountSettings}
                  </Link>
                  <div className="my-2 ic-rule" />
                  <button
                    type="button"
                    onClick={() => { setAccountMenuOpen(false); handleLogout(); }}
                    className="flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
                  >
                    <X size={15} /> {t.accountLogOut}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/auth" className="ic-btn ic-btn--primary ic-btn--md hidden lg:inline-flex">
              {t.registry}
            </Link>
          )}

          {/* Mobile toggle */}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="navbar-mobile-menu"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="ic-iconbtn ic-iconbtn--sm ic-iconbtn--solid lg:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            id="navbar-mobile-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute left-3 right-3 top-full mt-2 rounded-sheet border border-line bg-raised p-4 shadow-[var(--shadow-lg)] lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`rounded-btn px-3 py-3 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-accent-tint text-accent-text'
                      : 'text-fg-secondary hover:bg-card-hov hover:text-fg'
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              <div className="my-3 flex items-center gap-1 rounded-full border border-line p-1">
                {langSwitcher.map(({ short, code, ariaName }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => { handleLangChange(code); setIsOpen(false); }}
                    aria-label={`Switch interface language to ${ariaName}`}
                    aria-current={lang === code ? 'true' : undefined}
                    className={`flex-1 rounded-full py-2 font-mono text-[11px] tracking-[0.08em] transition-colors ${
                      lang === code
                        ? 'bg-accent-tint text-accent-text'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {short}
                  </button>
                ))}
              </div>

              <Link
                href={user ? '/profile' : '/auth'}
                onClick={() => setIsOpen(false)}
                className="ic-btn ic-btn--primary ic-btn--md ic-btn--block"
              >
                {user ? t.accountProfile : t.registry}
              </Link>
              {user && (
                <button
                  type="button"
                  onClick={() => { handleLogout(); setIsOpen(false); }}
                  className="ic-btn ic-btn--ghost ic-btn--md ic-btn--block mt-1 text-danger"
                >
                  {t.accountLogOut}
                </button>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </nav>
    </LazyMotion>
  );
}
