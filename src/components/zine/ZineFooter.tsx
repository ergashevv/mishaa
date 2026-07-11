'use client';

/**
 * ZineFooter — bold ink-on-color footer for the zine rebuild. A big Anton sign-off, a scrolling
 * ticker, and sticker-style link columns. Not related to the old Footer.
 */

import Link from 'next/link';

const COLS: { title: string; color: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Read',
    color: 'var(--z-blue)',
    links: [
      { label: 'Browse library', href: '/library' },
      { label: 'Your shelf', href: '/reading' },
      { label: 'Superheroes', href: '/superheroes' },
    ],
  },
  {
    title: 'Learn',
    color: 'var(--z-green)',
    links: [
      { label: 'Guides', href: '/guides' },
      { label: 'FAQ', href: '/faq' },
      { label: 'About', href: '/about' },
    ],
  },
  {
    title: 'Legal',
    color: 'var(--z-purple)',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'DMCA', href: '/dmca' },
    ],
  },
];

const TICKER = ['MANGA', 'HENTAI', 'MANHWA', 'WEBTOONS', 'DOUJINSHI', 'ONE-SHOTS'];

export default function ZineFooter() {
  return (
    <footer className="mt-24 border-t-[3px] border-[var(--z-ink)] bg-[var(--z-ink)] text-[var(--z-paper)]">
      {/* Ticker */}
      <div className="z-ticker border-b-[3px] border-[var(--z-paper)] bg-[var(--z-yellow)] py-2 text-[var(--z-ink)]">
        <div className="z-ticker__track">
          {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((w, i) => (
            <span key={i} className="z-display text-[22px] leading-none">
              {w}<span className="mx-3 text-[var(--z-red)]">★</span>
            </span>
          ))}
        </div>
      </div>

      <div className="z-wrap py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="z-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.82]">
              iComics<span className="text-[var(--z-red)]">.</span>wiki
            </div>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[var(--z-paper-2)]">
              An independent manga, hentai &amp; manhwa reader in your browser. Not affiliated with MangaDex.org.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <div
                className="z-display mb-4 inline-block -rotate-2 border-2 border-[var(--z-paper)] px-2 py-0.5 text-[18px]"
                style={{ background: col.color }}
              >
                {col.title}
              </div>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[14px] font-bold text-[var(--z-paper-2)] underline-offset-4 hover:text-[var(--z-yellow)] hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t-2 border-[var(--z-ink-2)] pt-6 text-[12px] font-bold text-[var(--z-paper-2)] sm:flex-row sm:items-center sm:justify-between" style={{ fontFamily: 'var(--font-zine-mono)' }}>
          <span>© {new Date().getFullYear()} ICOMICS.WIKI — ALL SERIES © THEIR CREATORS</span>
          <span>MADE FOR READERS, NOT ALGORITHMS</span>
        </div>
      </div>
    </footer>
  );
}
