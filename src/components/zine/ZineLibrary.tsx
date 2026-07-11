'use client';

/**
 * ZineLibrary — the Browse page, rebuilt from zero in the Bold Pop Zine language: a poster
 * masthead, sticker category chips, a stamp search field, and an infinite collage grid of
 * sticker cards. Reuses ONLY the data layer (searchComicsWithClientCache + age-gating).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Play, Lock, Loader2, X } from 'lucide-react';
import ZineNav from './ZineNav';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import { isAdultComic, readAgeVerification, persistAgeVerification } from '@/lib/age-verification';
import { searchComicsWithClientCache as searchComics } from '@/lib/comic-search-client-cache';
import { readStorageItem } from '@/lib/browser-storage';
import { translations, Lang } from '@/lib/translations';
import { MANGA_LANGUAGE_STORAGE_KEY, readStoredMangaLanguage, MangaLanguage } from '@/lib/manga-language';
import { MANGADEX_LONG_STRIP_TAG_ID, MANGADEX_GIRLS_LOVE_TAG_ID } from '@/lib/mangadex';
import { BOORU_SOURCE_SLUGS, BOORU_BOARDS, type BooruSource } from '@/lib/booru';
import type { ComicListItem } from '@/lib/comic-types';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';

const FALLBACK_IMG = '/logo.png';
const ROT = [-1.3, 0.9, -0.6, 1.2, -1, 0.5, -0.4, 1.1];
const TINTS = ['var(--z-blue)', 'var(--z-red)', 'var(--z-green)', 'var(--z-purple)', 'var(--z-orange)', 'var(--z-pink)'];
function tintFor(t: string) { let h = 0; for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) % 997; return TINTS[h % TINTS.length]; }

type Cat = {
  label: string; color: string; source: string; nsfw?: boolean;
  query?: string; includedTagIds?: string[]; excludedTagIds?: string[]; originalLanguages?: string[]; ratings?: string[];
};

const CATS: Cat[] = [
  { label: 'All', color: 'var(--z-ink)', source: 'mangadex' },
  { label: 'Romance', color: 'var(--z-pink)', source: 'mangadex', includedTagIds: ['423e2eae-a7a2-4a8b-ac03-a8351462d71d'] },
  { label: 'Fantasy', color: 'var(--z-blue)', source: 'mangadex', includedTagIds: ['cdc58593-87dd-415e-bbc0-2ec27bf404cc'] },
  { label: 'Manga Hub', color: 'var(--z-green)', source: 'mangadex', originalLanguages: ['ja'] },
  { label: 'Webtoons', color: 'var(--z-orange)', source: 'mangadex', includedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] },
  { label: 'Manhwa', color: 'var(--z-purple)', source: 'mangadex', originalLanguages: ['ko'], excludedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] },
  { label: 'Superheroes', color: 'var(--z-red)', source: 'superhero' },
];

const NSFW_CATS: Cat[] = [
  { label: 'Trending 18+', color: 'var(--z-red)', source: 'nhentai', nsfw: true },
  { label: 'Doujinshi', color: 'var(--z-pink)', source: 'nhentai', nsfw: true },
  { label: 'Adult Manga', color: 'var(--z-purple)', source: 'mangadex', nsfw: true, ratings: ['pornographic'] },
  { label: 'Erotica', color: 'var(--z-orange)', source: 'mangadex', nsfw: true, ratings: ['erotica'] },
  { label: 'Yuri / GL', color: 'var(--z-green)', source: 'mangadex', nsfw: true, includedTagIds: [MANGADEX_GIRLS_LOVE_TAG_ID] },
  { label: 'Mature Romance', color: 'var(--z-red)', source: 'nhentai', nsfw: true, query: 'mature' },
];

// The image-board directory shown in the dedicated 18+ panel. Grouped by the upstream
// API family so the grid reads as an intentional taxonomy, not a flat wall of chips.
type BooruFamily = { style: string; label: string; color: string };
const BOORU_FAMILIES: BooruFamily[] = [
  { style: 'gelbooru', label: 'Gelbooru network', color: 'var(--z-red)' },
  { style: 'danbooru', label: 'Danbooru', color: 'var(--z-blue)' },
  { style: 'e621', label: 'e621 network', color: 'var(--z-green)' },
  { style: 'moebooru', label: 'Moebooru', color: 'var(--z-purple)' },
  { style: 'philomena', label: 'Philomena network', color: 'var(--z-pink)' },
];

const boardHost = (slug: BooruSource) => BOORU_BOARDS[slug].site.replace(/^https?:\/\//, '');

const BOORU_SOURCE_CATS: Cat[] = BOORU_SOURCE_SLUGS.map((slug) => {
  const family = BOORU_FAMILIES.find((f) => f.style === BOORU_BOARDS[slug].style);
  return {
    label: BOORU_BOARDS[slug].label,
    source: slug,
    nsfw: true,
    color: family?.color ?? 'var(--z-ink)',
  };
});

function LibCard({ comic, ageVerified, onLocked, rot }: { comic: ComicListItem; ageVerified: boolean; onLocked: () => void; rot: number }) {
  const adult = isAdultComic(comic);
  const blocked = adult && !ageVerified;
  const polite = adult && ageVerified;
  const [src, setSrc] = useState(comic.coverUrl && comic.coverUrl.trim() ? comic.coverUrl : FALLBACK_IMG);
  const cls = blocked ? 'object-cover scale-105 blur-lg saturate-50'
    : polite ? 'object-cover scale-105 blur-md saturate-75 transition-[filter,transform] duration-300 group-hover:blur-none group-hover:saturate-100 group-hover:scale-100'
    : 'object-cover transition-transform duration-300 group-hover:scale-[1.04]';
  return (
    <Link href={`/library/${comic.source}/${comic.id}`} onClickCapture={(e) => { if (blocked) { e.preventDefault(); onLocked(); } }}
      className="z-box z-pop group relative block overflow-hidden" style={{ transform: `rotate(${rot}deg)` }}>
      <span className="z-cover block" style={{ background: tintFor(comic.title) }}>
        <Image src={src} alt={blocked ? 'Restricted' : comic.title} fill sizes="(max-width:640px) 45vw, 180px" quality={65}
          unoptimized={imageUnoptimizedForSrc(src)} onError={() => src !== FALLBACK_IMG && setSrc(FALLBACK_IMG)} className={cls} />
        {!blocked && comic.rating ? <span className="absolute right-2 top-2 z-tag z-tag--paper !text-[10px] !px-1.5 !py-1">{comic.rating}</span> : null}
        <span className="pointer-events-none absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full border-[2.5px] border-[var(--z-ink)] bg-[var(--z-red)] text-white opacity-0 shadow-[2px_2px_0_var(--z-ink)] transition-opacity duration-150 group-hover:opacity-100"><Play size={15} fill="currentColor" /></span>
        {blocked ? <span className="absolute inset-0 grid place-items-center bg-[rgba(23,18,11,0.35)] text-white"><Lock size={18} strokeWidth={2.5} /></span> : null}
      </span>
      <span className="flex min-h-[3.2rem] flex-col justify-center px-2.5 py-2">
        <span className="line-clamp-2 text-[13px] font-extrabold leading-[1.12] text-[var(--z-ink)]">{blocked ? 'Age restricted' : comic.title}</span>
        <span className="mt-0.5 truncate text-[10px] font-bold uppercase text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{comic.source}</span>
      </span>
    </Link>
  );
}

export default function ZineLibrary({
  initialAgeVerified = false,
  initialMangaLanguage,
}: {
  initialAgeVerified?: boolean;
  initialMangaLanguage?: MangaLanguage;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ageVerified, setAgeVerified] = useState(Boolean(initialAgeVerified));
  const [showGate, setShowGate] = useState(false);
  const [pendingCat, setPendingCat] = useState<Cat | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const mangaLang = useRef<MangaLanguage>(initialMangaLanguage ?? 'en');

  const initialLabel = searchParams.get('tab') || 'All';
  const [active, setActive] = useState<string>(initialLabel);
  const [term, setTerm] = useState(searchParams.get('q') || '');
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const [items, setItems] = useState<ComicListItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const reqId = useRef(0);

  const t = translations[lang].library;
  // Chips shown in the pill row (content filters). Booru boards live in the 18+ panel instead.
  const chipCats = useMemo(() => (ageVerified ? [...CATS, ...NSFW_CATS] : CATS), [ageVerified]);
  // Full resolvable set, including per-board browse categories, for `active` lookup.
  const allCats = useMemo(
    () => (ageVerified ? [...CATS, ...NSFW_CATS, ...BOORU_SOURCE_CATS] : CATS),
    [ageVerified],
  );
  const activeCat = useMemo(() => allCats.find((c) => c.label === active) || CATS[0], [allCats, active]);

  useEffect(() => {
    if (readAgeVerification()) setAgeVerified(true);
    // Only an explicit prior choice (localStorage) should override the SSR-resolved language —
    // otherwise a first-time visitor's geo-suggested cookie language gets clobbered back to 'en'.
    if (readStorageItem(MANGA_LANGUAGE_STORAGE_KEY)) mangaLang.current = readStoredMangaLanguage();
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => { const n = (e as CustomEvent<Lang>).detail; if (translations[n]) setLang(n); };
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  // Debounce the search box into `query`.
  useEffect(() => {
    const id = setTimeout(() => setQuery(term.trim()), 350);
    return () => clearTimeout(id);
  }, [term]);

  const fetchPage = useCallback(async (cat: Cat, q: string, p: number, myReq: number) => {
    const res = await searchComics({
      source: cat.source, query: q || cat.query || '', page: p, mangaLanguage: mangaLang.current,
      ratings: cat.ratings, originalLanguages: cat.originalLanguages, includedTagIds: cat.includedTagIds, excludedTagIds: cat.excludedTagIds,
    });
    if (myReq !== reqId.current) return;
    setItems((prev) => (p === 0 ? res.items : [...prev, ...res.items]));
    setHasMore(res.hasMore);
    setPage(p + 1);
    setLoading(false);
  }, []);

  // Reset + first page whenever the category or query changes.
  useEffect(() => {
    const my = ++reqId.current;
    setItems([]); setPage(0); setHasMore(true); setLoading(true);
    void fetchPage(activeCat, query, 0, my);
    // reflect state in the URL (shallow)
    const params = new URLSearchParams();
    if (activeCat.label !== 'All') params.set('tab', activeCat.label);
    if (query) params.set('q', query);
    const qs = params.toString();
    router.replace(qs ? `/library?${qs}` : '/library', { scroll: false });
  }, [activeCat, query, fetchPage, router]);

  // Infinite scroll.
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && hasMore && !loading) { const my = reqId.current; void fetchPage(activeCat, query, page, my); }
    }, { rootMargin: '0px 0px 600px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, page, activeCat, query, fetchPage]);

  const pickCategory = (cat: Cat) => {
    if (cat.nsfw && !ageVerified) { setPendingCat(cat); setShowGate(true); return; }
    setActive(cat.label);
  };
  const verify = () => { persistAgeVerification(); setAgeVerified(true); setShowGate(false); if (pendingCat) { setActive(pendingCat.label); setPendingCat(null); } };

  return (
    <>
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap py-10">
        {/* masthead */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <h1 className="z-display text-[clamp(2.6rem,8vw,5.5rem)] leading-[0.8]">
            The<span className="mx-2 inline-block -rotate-2 border-[3px] border-[var(--z-ink)] bg-[var(--z-red)] px-3 text-[var(--z-paper)] shadow-[5px_5px_0_var(--z-ink)]">Stacks</span>
          </h1>
          <form onSubmit={(e) => { e.preventDefault(); setQuery(term.trim()); }} className="flex w-full items-center gap-2 rounded-[8px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-4 py-3 shadow-[4px_4px_0_var(--z-ink)] sm:w-80">
            <Search size={18} strokeWidth={2.5} />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search every shelf…" aria-label="Search"
              className="w-full bg-transparent text-[14px] font-bold text-[var(--z-ink)] placeholder:text-[var(--z-ink-2)] focus:outline-none" style={{ fontFamily: 'var(--font-zine-mono)' }} />
            {term ? <button type="button" onClick={() => { setTerm(''); setQuery(''); }} aria-label="Clear"><X size={16} strokeWidth={2.5} /></button> : null}
          </form>
        </div>

        {/* category chips */}
        <div className="mb-10 flex flex-wrap gap-2.5">
          {chipCats.map((c) => {
            const on = c.label === active;
            return (
              <button key={c.label} type="button" onClick={() => pickCategory(c)}
                className="rounded-[7px] border-[2.5px] border-[var(--z-ink)] px-3.5 py-2 text-[13px] font-extrabold uppercase transition-transform hover:-translate-y-0.5"
                style={{ fontFamily: 'var(--font-zine-mono)', background: on ? c.color : 'var(--z-card)', color: on ? (c.color === 'var(--z-yellow)' ? 'var(--z-ink)' : '#fff') : 'var(--z-ink)', boxShadow: on ? '3px 3px 0 var(--z-ink)' : 'none' }}>
                {c.label}{c.nsfw ? ' 18+' : ''}
              </button>
            );
          })}
        </div>

        {/* 18+ source directory — the expanded restricted-source catalog */}
        <section className="mb-12">
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="z-display text-[clamp(1.5rem,4.5vw,2.4rem)] leading-[0.85]">
              <span className="mr-2 inline-block -rotate-2 border-[2.5px] border-[var(--z-ink)] bg-[var(--z-red)] px-2.5 text-[var(--z-paper)] shadow-[3px_3px_0_var(--z-ink)]">18+</span>
              Sources
            </h2>
            <span className="text-[11px] font-bold uppercase text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>
              {BOORU_SOURCE_CATS.length} boards · age-gated
            </span>
          </div>

          {ageVerified ? (
            <div className="space-y-6">
              {BOORU_FAMILIES.map((fam) => {
                const boards = BOORU_SOURCE_CATS.filter((c) => BOORU_BOARDS[c.source as BooruSource].style === fam.style);
                if (!boards.length) return null;
                return (
                  <div key={fam.style}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border-[2px] border-[var(--z-ink)]" style={{ background: fam.color }} />
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{fam.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {boards.map((cat) => {
                        const on = cat.label === active;
                        return (
                          <button
                            key={cat.label}
                            type="button"
                            onClick={() => pickCategory(cat)}
                            aria-pressed={on}
                            className="z-box z-pop group flex flex-col items-start gap-0.5 px-3.5 py-3 text-left"
                            style={{ background: on ? cat.color : 'var(--z-card)', boxShadow: on ? 'var(--z-sh-sm)' : undefined }}
                          >
                            <span className="text-[14px] font-extrabold leading-tight" style={{ color: on ? '#fff' : 'var(--z-ink)' }}>{cat.label}</span>
                            <span className="truncate text-[10px] font-bold uppercase" style={{ fontFamily: 'var(--font-zine-mono)', color: on ? 'rgba(255,255,255,0.9)' : 'var(--z-ink-2)' }}>
                              {boardHost(cat.source as BooruSource)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="z-box grid place-items-center gap-3 p-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-[var(--z-ink)] bg-[var(--z-red)] text-white shadow-[3px_3px_0_var(--z-ink)]"><Lock size={20} strokeWidth={2.5} /></span>
              <h3 className="z-display text-[1.7rem] leading-none">Restricted shelves</h3>
              <p className="max-w-sm text-[14px] font-semibold text-[var(--z-ink-2)]">
                {BOORU_SOURCE_CATS.length} adult image-board sources unlock once you confirm you’re 18 or older.
              </p>
              <button type="button" onClick={() => setShowGate(true)} className="z-btn z-btn--red z-btn--sm mt-1">Verify 18+</button>
            </div>
          )}
        </section>

        {/* grid */}
        {loading && items.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="z-box overflow-hidden">
                <div className="z-cover animate-pulse" style={{ background: 'var(--z-paper-2)' }} />
                <div className="h-[3.2rem]" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="z-box grid place-items-center p-14 text-center">
            <h3 className="z-display text-[2rem]">Empty shelf</h3>
            <p className="mt-2 max-w-sm text-[15px] font-semibold text-[var(--z-ink-2)]">Nothing here yet. Try another shelf or a different search.</p>
            <button type="button" onClick={() => { setTerm(''); setQuery(''); setActive('All'); }} className="z-btn z-btn--red z-btn--sm mt-6">Reset</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {items.map((c, i) => (
              <LibCard key={`${c.source}:${c.id}:${i}`} comic={c} ageVerified={ageVerified} onLocked={() => setShowGate(true)} rot={ROT[i % ROT.length]} />
            ))}
          </div>
        )}

        <div ref={loaderRef} className="flex justify-center py-12">
          {loading && items.length > 0 ? <Loader2 className="h-7 w-7 animate-spin" /> : null}
          {!hasMore && items.length > 0 ? <span className="z-display -rotate-1 text-[clamp(1.4rem,4vw,2.2rem)]">End of the stack ★</span> : null}
        </div>
      </main>

      {showGate ? (
        <AgeGateOverlay title={t.restricted} description={t.ageDesc} confirmLabel={t.verifyBtn} cancelLabel={t.cancelBtn} confirmAction={verify} cancelAction={() => { setShowGate(false); setPendingCat(null); }} zIndex={10000} />
      ) : null}
    </>
  );
}
