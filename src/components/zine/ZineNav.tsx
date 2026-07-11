'use client';

/**
 * ZineNav — the navigation for the "Bold Pop Zine" rebuild. Nothing here is shared with the
 * old floating-pill Navbar: a chunky ink-outlined bar, a rotated sticker logo, uppercase
 * marker-underline links, an inline search stamp, sticker language chips and a red JOIN stamp.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, X } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { htmlLangFromUiLang } from '@/lib/i18n/lang';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { persistUiLangCookie } from '@/lib/i18n/ui-lang-cookie-client';
import { uiLangToPreferredMangaLanguage } from '@/lib/i18n/ui-lang-to-manga';
import { persistStoredMangaLanguage } from '@/lib/manga-language';

const LINKS: { label: string; href: string; color: string }[] = [
  { label: 'Browse', href: '/library', color: 'var(--z-blue)' },
  { label: 'Shelf', href: '/reading', color: 'var(--z-red)' },
  { label: 'Guides', href: '/guides', color: 'var(--z-green)' },
  { label: 'About', href: '/about', color: 'var(--z-purple)' },
];

const LANGS: { short: string; code: Lang }[] = [
  { short: 'EN', code: 'en' },
  { short: 'JA', code: 'ja' },
  { short: 'KO', code: 'ko' },
  { short: 'ZH', code: 'zh' },
  { short: 'RU', code: 'ru' },
];

export default function ZineNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [term, setTerm] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => {
      const next = (e as CustomEvent<Lang>).detail;
      if (translations[next]) setLang(next);
    };
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const changeLang = (next: Lang) => {
    if (!translations[next]) return;
    setLang(next);
    writeStorageItem('lang', next);
    persistUiLangCookie(next);
    persistStoredMangaLanguage(uiLangToPreferredMangaLanguage(next));
    window.dispatchEvent(new CustomEvent('langChange', { detail: next }));
    if (typeof document !== 'undefined') document.documentElement.lang = htmlLangFromUiLang(next);
    router.refresh();
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/library?q=${encodeURIComponent(q)}` : '/library');
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-[900] border-b-[3px] border-[var(--z-ink)] bg-[var(--z-paper)]">
      <div className="z-wrap flex h-[66px] items-center gap-4">
        {/* Sticker logo */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="iComics home">
          <span
            className="grid h-11 w-11 place-items-center rounded-[9px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-red)] text-[var(--z-paper)] shadow-[3px_3px_0_var(--z-ink)] transition-transform group-hover:-rotate-6"
            style={{ transform: 'rotate(-4deg)' }}
          >
            <span className="z-display text-[20px] leading-none">iC</span>
          </span>
          <span className="z-display hidden text-[26px] leading-[0.8] sm:block">
            iComics<span className="text-[var(--z-blue)]">.</span>
          </span>
        </Link>

        {/* Links */}
        <nav className="ml-2 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group relative px-3 py-2 text-[15px] font-extrabold uppercase tracking-tight"
                style={{ color: 'var(--z-ink)' }}
              >
                {l.label}
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-1 h-[4px] origin-left rounded-full transition-transform duration-200"
                  style={{
                    background: l.color,
                    transform: active ? 'scaleX(1)' : 'scaleX(0)',
                  }}
                />
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-1 h-[4px] origin-left scale-x-0 rounded-full transition-transform duration-200 group-hover:scale-x-100"
                  style={{ background: l.color }}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Search stamp (desktop) */}
        <form onSubmit={submitSearch} className="hidden items-center md:flex">
          <div className="flex items-center gap-2 rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-3 py-2 shadow-[3px_3px_0_var(--z-ink)]">
            <Search size={16} strokeWidth={2.5} />
            <input
              ref={searchRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search titles…"
              aria-label="Search titles"
              className="w-32 bg-transparent font-mono text-[13px] font-bold text-[var(--z-ink)] placeholder:text-[var(--z-ink-2)] focus:w-44 focus:outline-none"
              style={{ fontFamily: 'var(--font-zine-mono)', transition: 'width 160ms ease' }}
            />
          </div>
        </form>

        {/* Lang chips (desktop) */}
        <div className="hidden items-center gap-1 lg:flex">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => changeLang(l.code)}
              aria-current={lang === l.code ? 'true' : undefined}
              className="h-8 w-8 rounded-[6px] border-2 border-[var(--z-ink)] text-[11px] font-bold uppercase"
              style={{
                fontFamily: 'var(--font-zine-mono)',
                background: lang === l.code ? 'var(--z-yellow)' : 'transparent',
                boxShadow: lang === l.code ? '2px 2px 0 var(--z-ink)' : 'none',
              }}
            >
              {l.short}
            </button>
          ))}
        </div>

        <Link href="/auth" className="z-btn z-btn--red z-btn--sm hidden sm:inline-flex">
          Join
        </Link>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] shadow-[3px_3px_0_var(--z-ink)] lg:hidden"
        >
          {open ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="border-t-[3px] border-[var(--z-ink)] bg-[var(--z-paper)] px-4 py-4 lg:hidden">
          <form onSubmit={submitSearch} className="mb-4 flex items-center gap-2 rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-3 py-2.5">
            <Search size={16} strokeWidth={2.5} />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search titles…"
              aria-label="Search titles"
              className="w-full bg-transparent text-[14px] font-bold focus:outline-none"
              style={{ fontFamily: 'var(--font-zine-mono)' }}
            />
          </form>
          <div className="grid grid-cols-2 gap-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="z-box rounded-[7px] px-3 py-3 text-[15px] font-extrabold uppercase"
                style={{ boxShadow: '3px 3px 0 var(--z-ink)' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => { changeLang(l.code); setOpen(false); }}
                className="h-9 w-10 rounded-[6px] border-2 border-[var(--z-ink)] text-[12px] font-bold"
                style={{
                  fontFamily: 'var(--font-zine-mono)',
                  background: lang === l.code ? 'var(--z-yellow)' : 'var(--z-card)',
                }}
              >
                {l.short}
              </button>
            ))}
            <Link href="/auth" onClick={() => setOpen(false)} className="z-btn z-btn--red z-btn--sm ml-auto">
              Join
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
