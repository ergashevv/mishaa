'use client';

/**
 * ZineHome — the "Bold Pop Zine" homepage, rebuilt from zero. Nothing here reuses the old
 * HomeClient JSX: a cover-story hero, a scrolling ticker, a numbered TOP chart, magazine-spread
 * collection grids, and a collage discovery wall — all sticker cards with hard offset shadows.
 * Only the DATA (the /api/home/data endpoint + age-gating + reading history) is reused.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Lock, ArrowRight, Bookmark } from 'lucide-react';
import ZineNav from './ZineNav';
import ZineFooter from './ZineFooter';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import { isAdultComic, readAgeVerification, persistAgeVerification } from '@/lib/age-verification';
import { getChapters } from '@/actions/comic';
import {
  readReadingHistory,
  LIBRARY_ACTIVITY_EVENT,
  BOOKMARKS_UPDATED_EVENT,
} from '@/lib/library-storage';
import { readStorageItem } from '@/lib/browser-storage';
import { translations, Lang } from '@/lib/translations';
import type { HomeShelfComic } from '@/lib/home-data';
import type { MangaLanguage } from '@/lib/manga-language';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';

type Comic = HomeShelfComic;

const FALLBACK_IMG = '/logo.png';
const ROT = [-1.4, 0.9, -0.7, 1.3, -1.1, 0.6, -0.4, 1.0];
const hrefFor = (c: Comic) => c.href || `/library/${c.source}/${c.id}`;

/** Deterministic pop tint per title so placeholder plates differ. */
const TINTS = ['var(--z-blue)', 'var(--z-red)', 'var(--z-green)', 'var(--z-purple)', 'var(--z-orange)', 'var(--z-pink)'];
function tintFor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i += 1) h = (h * 31 + title.charCodeAt(i)) % 997;
  return TINTS[h % TINTS.length];
}

type ContinueItem = { id: string; source: string; title: string; coverUrl?: string; progressPercent?: number; timestamp: number };

/* ------------------------------------------------------------------ image -- */
function ZineImage({ src, alt, sizes, priority, className }: { src?: string; alt: string; sizes?: string; priority?: boolean; className?: string }) {
  const [cur, setCur] = useState(src && src.trim() ? src : FALLBACK_IMG);
  useEffect(() => setCur(src && src.trim() ? src : FALLBACK_IMG), [src]);
  return (
    <Image
      src={cur}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      quality={priority ? 72 : 65}
      unoptimized={imageUnoptimizedForSrc(cur)}
      onError={() => cur !== FALLBACK_IMG && setCur(FALLBACK_IMG)}
      className={className}
    />
  );
}

/* ------------------------------------------------------------------- card -- */
function ZineCard({
  comic, ageVerified, onLocked, rank, rot = 0, sizes, priority,
}: {
  comic: Comic; ageVerified: boolean; onLocked: () => void; rank?: number; rot?: number; sizes?: string; priority?: boolean;
}) {
  const adult = isAdultComic(comic);
  const blocked = adult && !ageVerified;
  const polite = adult && ageVerified;
  const imgCls = blocked
    ? 'object-cover scale-105 blur-lg saturate-50'
    : polite
      ? 'object-cover scale-105 blur-md saturate-75 transition-[filter,transform] duration-300 group-hover:blur-none group-hover:saturate-100 group-hover:scale-100'
      : 'object-cover transition-transform duration-300 group-hover:scale-[1.04]';

  return (
    <Link
      href={hrefFor(comic)}
      className="z-box z-pop group relative block overflow-hidden"
      style={{ transform: `rotate(${rot}deg)` }}
      onClickCapture={(e) => { if (blocked) { e.preventDefault(); onLocked(); } }}
    >
      <div className="z-cover" style={{ background: tintFor(comic.title) }}>
        <ZineImage src={comic.coverUrl} alt={blocked ? 'Restricted' : comic.title} sizes={sizes} priority={priority} className={imgCls} />

        {/* status/rating sticker */}
        {!blocked && comic.rating ? (
          <span className="absolute right-2 top-2 z-[2] z-tag z-tag--paper !text-[10px] !px-1.5 !py-1">{comic.rating}</span>
        ) : null}

        {typeof rank === 'number' ? (
          <span
            className="z-display absolute -left-1 -top-2 z-[2] text-[64px] leading-none text-[var(--z-yellow)]"
            style={{ WebkitTextStroke: '3px var(--z-ink)', paintOrder: 'stroke fill' }}
            aria-hidden
          >
            {rank}
          </span>
        ) : null}

        {/* play stamp on hover */}
        <span className="pointer-events-none absolute bottom-2 right-2 z-[2] grid h-9 w-9 place-items-center rounded-full border-[2.5px] border-[var(--z-ink)] bg-[var(--z-red)] text-white opacity-0 shadow-[2px_2px_0_var(--z-ink)] transition-all duration-150 group-hover:opacity-100 group-hover:-translate-y-0.5">
          <Play size={15} fill="currentColor" />
        </span>

        {blocked ? (
          <div className="absolute inset-0 z-[3] grid place-items-center bg-[rgba(23,18,11,0.35)] text-white">
            <div className="flex flex-col items-center gap-1">
              <Lock size={18} strokeWidth={2.5} />
              <span className="z-tag z-tag--red !text-[10px]">18+ verify</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-[3.4rem] flex-col justify-center px-2.5 py-2">
        <h3 className="line-clamp-2 text-[13.5px] font-extrabold leading-[1.12] text-[var(--z-ink)]">
          {blocked ? 'Age restricted' : comic.title}
        </h3>
        <span className="mt-0.5 truncate text-[10px] font-bold uppercase text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>
          {blocked ? 'tap to unlock' : comic.meta}
        </span>
      </div>
    </Link>
  );
}

/* ---------------------------------------------------------------- section -- */
function BlockHeader({ title, color, href }: { title: string; color: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="z-display -rotate-1 text-[clamp(2rem,5vw,3.4rem)] leading-[0.82]">
        <span className="inline-block border-[3px] border-[var(--z-ink)] px-3 py-1 text-[var(--z-ink)] shadow-[4px_4px_0_var(--z-ink)]" style={{ background: color }}>
          {title}
        </span>
      </h2>
      {href ? (
        <Link href={href} className="z-tag z-tag--ink shrink-0 !text-[12px] hover:-translate-y-0.5" style={{ transition: 'transform 120ms ease' }}>
          See all <ArrowRight size={13} strokeWidth={3} />
        </Link>
      ) : null}
    </div>
  );
}

const COLLECTIONS: { key: string; title: string; color: string; tab?: string }[] = [
  { key: 'romance', title: 'Romance', color: 'var(--z-pink)', tab: 'Romance' },
  { key: 'fantasy', title: 'Fantasy', color: 'var(--z-blue)', tab: 'Fantasy' },
  { key: 'manga-hub', title: 'Manga Hub', color: 'var(--z-green)', tab: 'Manga Hub' },
  { key: 'manhwa', title: 'Manhwa', color: 'var(--z-purple)', tab: 'Manhwa' },
  { key: 'webtoons', title: 'Webtoons', color: 'var(--z-orange)', tab: 'Webtoons' },
  { key: 'new', title: 'Fresh Drops', color: 'var(--z-yellow)' },
];

const ADULT_COLLECTIONS: { key: string; title: string; color: string; tab?: string }[] = [
  { key: 'doujinshi', title: 'Doujinshi', color: 'var(--z-red)', tab: 'Doujinshi' },
  { key: 'milf', title: 'Mature 18+', color: 'var(--z-purple)', tab: 'Mature Romance' },
];

type Props = {
  initialData?: Record<string, HomeShelfComic[]>;
  initialAgeVerified?: boolean;
  initialIsTouchDevice?: boolean;
  initialMangaLanguage?: MangaLanguage;
};

export default function ZineHome({ initialData = {}, initialAgeVerified = false, initialMangaLanguage = 'en' }: Props) {
  const [shelves, setShelves] = useState<Record<string, Comic[]>>(initialData as Record<string, Comic[]>);
  const [ageVerified, setAgeVerified] = useState(Boolean(initialAgeVerified));
  const [showGate, setShowGate] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [mangaLang] = useState<MangaLanguage>(initialMangaLanguage);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);

  // discovery
  const [discover, setDiscover] = useState<Comic[]>([]);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const copy = translations[lang].library;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => { const n = (e as CustomEvent<Lang>).detail; if (translations[n]) setLang(n); };
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  useEffect(() => {
    setAgeVerified((prev) => (readAgeVerification() ? true : prev));
  }, []);

  // Refresh shelves client-side (SSR may hand back an empty payload on upstream failure).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/home/data?lang=${mangaLang}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.shelves) setShelves((prev) => ({ ...prev, ...data.shelves }));
      } catch { /* keep SSR data */ }
    })();
    return () => { cancelled = true; };
  }, [mangaLang]);

  // Continue reading from local reading history.
  useEffect(() => {
    const sync = () => {
      const hist = readReadingHistory();
      const items = Object.values(hist)
        .filter((e) => e?.id && e?.comicTitle && e?.comicSource && e.progressStatus !== 'completed')
        .map((e) => ({
          id: e.id as string,
          source: e.comicSource as string,
          title: e.comicTitle as string,
          coverUrl: e.comicCoverUrl,
          progressPercent: typeof e.progressPercent === 'number' ? e.progressPercent : undefined,
          timestamp: e.timestamp || 0,
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 8);
      setContinueItems(items);
    };
    sync();
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, sync);
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, sync);
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/home/data?mode=feed&lang=${mangaLang}&page=${page}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('feed');
      const data = await res.json();
      const items: Comic[] = Array.isArray(data?.items) ? data.items : [];
      const fresh = items.filter((c) => { const k = `${c.source}:${c.id}`; if (seen.current.has(k)) return false; seen.current.add(k); return true; });
      if (fresh.length) { setDiscover((p) => [...p, ...fresh]); setPage((p) => p + 1); setHasMore(fresh.length >= 8); }
      else { setPage((p) => p + 1); setHasMore(page < 6); }
    } catch { setHasMore(false); }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, mangaLang, page]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) void loadMore(); }, { rootMargin: '0px 0px 500px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const verify = () => { persistAgeVerification(); setAgeVerified(true); setShowGate(false); };

  const trending = (shelves.trending || []).slice(0, 12);

  // The hero must only feature titles that can actually be READ here. Many top-trending MangaDex
  // series (One Piece, etc.) are officially licensed and only link out to the publisher's reader,
  // so featuring them with a "Read now" CTA is misleading. We verify chapters and keep only the
  // ones with at least one in-app chapter, then rotate the hero through those.
  const [readableHero, setReadableHero] = useState<Comic[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const heroKey = trending.map((c) => `${c.source}:${c.id}`).join(',');
  const heroDoneRef = useRef('');

  useEffect(() => {
    if (!trending.length || heroDoneRef.current === heroKey) return;
    heroDoneRef.current = heroKey;
    const deck = trending.filter((c) => ageVerified || !isAdultComic(c)).slice(0, 8);
    let cancelled = false;
    (async () => {
      const ok: Comic[] = [];
      for (const c of deck) {
        if (cancelled || ok.length >= 5) break;
        try {
          const chs = await getChapters(c.source, c.id, mangaLang);
          if (Array.isArray(chs) && chs.some((ch) => !ch.externalUrl)) ok.push(c);
        } catch { /* skip unreachable candidate */ }
      }
      if (!cancelled) { setReadableHero(ok); setHeroIdx(0); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroKey, mangaLang, ageVerified]);

  useEffect(() => {
    if (readableHero.length <= 1) return;
    const id = window.setInterval(() => setHeroIdx((i) => (i + 1) % readableHero.length), 7500);
    return () => window.clearInterval(id);
  }, [readableHero.length]);

  const featured = readableHero.length ? readableHero[heroIdx % readableHero.length] : trending[0];
  const featuredAdult = featured ? isAdultComic(featured) : false;
  const featuredBlocked = featuredAdult && !ageVerified;

  const collections = useMemo(
    () => (ageVerified ? [...COLLECTIONS, ...ADULT_COLLECTIONS] : COLLECTIONS),
    [ageVerified],
  );

  return (
    <div className="zine">
      <ZineNav />

      <main id="main-content" tabIndex={-1}>
        {/* ------------------------------------------------------ COVER STORY */}
        {featured ? (
          <section className="relative overflow-hidden border-b-[3px] border-[var(--z-ink)] bg-[var(--z-blue)]">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{ backgroundImage: 'radial-gradient(#fff 24%, transparent 26%)', backgroundSize: '18px 18px' }}
              aria-hidden
            />
            <div className="z-wrap relative grid items-center gap-8 py-12 md:grid-cols-[1.15fr_0.85fr] md:py-16">
              <div className="text-[var(--z-paper)]">
                <span className="z-tag z-tag--yellow inline-flex rotate-[-3deg] !text-[12px]">★ Trending Now</span>
                <span className="z-tag z-tag--red ml-2 inline-flex rotate-[2deg] !text-[12px]">Featured · {featured.source}</span>
                <h1 className="z-display mt-5 text-[clamp(2.8rem,7.5vw,6rem)] leading-[0.82] text-[var(--z-paper)]">
                  {featuredBlocked ? 'Age Restricted' : featured.title}
                </h1>
                {featured.description && !featuredBlocked ? (
                  <p className="mt-5 max-w-lg text-[15px] font-semibold leading-relaxed text-[var(--z-paper)]/90 line-clamp-3">
                    {featured.description}
                  </p>
                ) : null}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href={hrefFor(featured)} className="z-btn z-btn--red text-[16px]">
                    <Play size={17} fill="currentColor" /> Read now
                  </Link>
                  <Link href="/library" className="z-btn z-btn--yellow">
                    Explore library <ArrowRight size={16} strokeWidth={3} />
                  </Link>
                </div>
                {readableHero.length > 1 ? (
                  <div className="mt-7 flex items-center gap-2">
                    {readableHero.map((_, i) => {
                      const on = i === (heroIdx % readableHero.length);
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Featured title ${i + 1}`}
                          aria-current={on}
                          onClick={() => setHeroIdx(i)}
                          className="h-3 rounded-full border-2 border-[var(--z-ink)] transition-all"
                          style={{ width: on ? 28 : 12, background: on ? 'var(--z-yellow)' : 'rgba(255,255,255,0.5)' }}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {/* cover with sticker */}
              <div className="relative mx-auto w-full max-w-[280px] md:ml-auto md:mr-0">
                <div className="z-box relative aspect-[2/3] overflow-hidden rotate-[3deg] !shadow-[9px_9px_0_var(--z-ink)]">
                  <ZineImage
                    src={featured.bannerUrl || featured.coverUrl}
                    alt={featuredBlocked ? 'Restricted' : featured.title}
                    sizes="(max-width: 768px) 280px, 340px"
                    priority
                    className={`object-cover ${featuredBlocked ? 'blur-xl scale-110 saturate-50' : ''}`}
                  />
                  {featuredBlocked ? (
                    <div className="absolute inset-0 grid place-items-center bg-[rgba(23,18,11,0.4)]">
                      <button type="button" onClick={() => setShowGate(true)} className="z-btn z-btn--red z-btn--sm">
                        <Lock size={14} strokeWidth={2.5} /> Verify 18+
                      </button>
                    </div>
                  ) : null}
                </div>
                <span className="z-tag z-tag--green absolute -bottom-3 -left-3 rotate-[-6deg] !text-[13px] !px-2.5 !py-1.5">NEW CHAPTER</span>
              </div>
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------------ TICKER */}
        <div className="z-ticker border-b-[3px] border-[var(--z-ink)] bg-[var(--z-yellow)] py-2 text-[var(--z-ink)]">
          <div className="z-ticker__track">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="z-display text-[20px] leading-none">
                NEW DROPS<span className="mx-2 text-[var(--z-red)]">●</span>TRENDING<span className="mx-2 text-[var(--z-blue)]">●</span>HAND-PICKED<span className="mx-2 text-[var(--z-purple)]">●</span>READ FREE<span className="mx-3 text-[var(--z-red)]">★</span>
              </span>
            ))}
          </div>
        </div>

        <div className="z-wrap py-14">
          {/* ------------------------------------------------ CONTINUE */}
          {continueItems.length > 0 ? (
            <section className="mb-20">
              <BlockHeader title="Keep reading" color="var(--z-green)" href="/reading" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {continueItems.slice(0, 6).map((it, i) => (
                  <Link key={`${it.source}:${it.id}`} href={`/library/${it.source}/${it.id}`} className="z-box z-pop group flex items-stretch gap-0 overflow-hidden">
                    <span className="relative aspect-[2/3] w-[64px] shrink-0 border-r-[2.5px] border-[var(--z-ink)]" style={{ background: tintFor(it.title) }}>
                      <ZineImage src={it.coverUrl} alt={it.title} sizes="64px" className="object-cover" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3 py-2">
                      <span className="truncate text-[14px] font-extrabold text-[var(--z-ink)]">{it.title}</span>
                      {typeof it.progressPercent === 'number' ? (
                        <>
                          <span className="text-[11px] font-bold text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{Math.round(it.progressPercent)}% DONE</span>
                          <span className="h-[7px] w-full overflow-hidden rounded-full border-2 border-[var(--z-ink)] bg-[var(--z-paper-2)]">
                            <span className="block h-full bg-[var(--z-red)]" style={{ width: `${Math.min(100, Math.max(0, it.progressPercent))}%` }} />
                          </span>
                        </>
                      ) : (
                        <span className="z-tag z-tag--blue w-fit !text-[10px]"><Bookmark size={11} /> resume</span>
                      )}
                    </span>
                    <span className="ml-auto grid w-10 shrink-0 place-items-center border-l-[2.5px] border-[var(--z-ink)] bg-[var(--z-yellow)] text-[var(--z-ink)]">
                      <Play size={16} fill="currentColor" />
                    </span>
                    {i < 0 ? null : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* ------------------------------------------------ TOP CHART */}
          {trending.length >= 5 ? (
            <section className="mb-20">
              <BlockHeader title="Top 10 charts" color="var(--z-red)" href="/library" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {trending.slice(0, 10).map((c, i) => (
                  <ZineCard
                    key={`top:${c.source}:${c.id}`}
                    comic={c}
                    ageVerified={ageVerified}
                    onLocked={() => setShowGate(true)}
                    rank={i + 1}
                    rot={ROT[i % ROT.length] * 0.5}
                    sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, 200px"
                    priority={i < 4}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* ------------------------------------------------ COLLECTIONS */}
          {collections.map((col) => {
            const items = (shelves[col.key] || []).slice(0, 6);
            if (items.length === 0) return null;
            return (
              <section key={col.key} className="mb-20">
                <BlockHeader title={col.title} color={col.color} href={col.tab ? `/library?tab=${encodeURIComponent(col.tab)}` : '/library'} />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                  {items.map((c, i) => (
                    <ZineCard
                      key={`${col.key}:${c.source}:${c.id}`}
                      comic={c}
                      ageVerified={ageVerified}
                      onLocked={() => setShowGate(true)}
                      rot={ROT[i % ROT.length] * 0.55}
                      sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, 180px"
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* ------------------------------------------------ DISCOVERY COLLAGE */}
          <section>
            <BlockHeader title="Grab bag" color="var(--z-blue)" />
            <p className="-mt-3 mb-6 max-w-md text-[14px] font-semibold text-[var(--z-ink-2)]">
              A wall of everything. Keep scrolling — the pile refills as you go.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {discover.map((c, i) => (
                <ZineCard
                  key={`disc:${c.source}:${c.id}:${i}`}
                  comic={c}
                  ageVerified={ageVerified}
                  onLocked={() => setShowGate(true)}
                  rot={ROT[i % ROT.length]}
                  sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, 180px"
                />
              ))}
            </div>
            <div ref={loaderRef} className="flex justify-center py-12">
              {hasMore ? (
                <span className="z-tag z-tag--ink animate-pulse !text-[13px] !px-4 !py-2">Loading more…</span>
              ) : (
                <span className="z-display -rotate-1 text-[clamp(1.5rem,4vw,2.4rem)] text-[var(--z-ink)]">That&apos;s the whole pile ★</span>
              )}
            </div>
          </section>
        </div>
      </main>

      <ZineFooter />

      {showGate ? (
        <AgeGateOverlay
          title={copy.restricted}
          description={copy.ageDesc}
          confirmLabel={copy.verifyBtn}
          cancelLabel={copy.cancelBtn}
          confirmAction={verify}
          cancelAction={() => setShowGate(false)}
        />
      ) : null}
    </div>
  );
}
