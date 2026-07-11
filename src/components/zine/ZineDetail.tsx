'use client';

/**
 * ZineDetail — the series detail page, rebuilt from zero in the Bold Pop Zine language.
 * New composition: a cover-story header (sticker-framed cover + huge Anton title + sticker
 * meta), stat stamps, a paper synopsis panel, a chapter ledger, and a related-reads rail.
 * Reuses ONLY data/actions (getComicDetails/getChapters, bookmarks, reading history) and the
 * unchanged Read Mode route. No JSX shared with the old ComicDetailsClient.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Play, ChevronLeft, Bookmark, Share2, Star, Clock, ChevronRight, Loader2,
  X, ExternalLink, Users, BarChart2, TrendingUp, Lock, ArrowRight, User,
} from 'lucide-react';
import ZineNav from './ZineNav';
import ZineFooter from './ZineFooter';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import RichTextContent from '@/components/RichTextContent';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';
import { removeBookmark, upsertBookmark, BOOKMARKS_UPDATED_EVENT, LIBRARY_ACTIVITY_EVENT, readReadingHistory } from '@/lib/library-storage';
import { trackEvent } from '@/lib/analytics';
import { readStoredMangaLanguage, MangaLanguage } from '@/lib/manga-language';
import { getChapters, getComicDetails } from '@/actions/comic';
import { isRestrictedLibrarySource } from '@/lib/comic-sources';
import type { ComicChapter, ComicDetail } from '@/lib/comic-types';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';
import { TelegramShareIcon, XShareIcon, WhatsAppShareIcon, LinkShareIcon } from '@/components/icons/ShareBrandIcons';

const CHAPTER_BATCH = 80;
const FALLBACK_IMG = '/logo.png';
const trim = (v?: string, n = 120) => { const c = String(v || '').replace(/\s+/g, ' ').trim(); return c.length > n ? `${c.slice(0, n - 1)}…` : c; };

const GENRE_TINTS = ['var(--z-blue)', 'var(--z-red)', 'var(--z-green)', 'var(--z-purple)', 'var(--z-orange)', 'var(--z-pink)'];

type Props = {
  initialComic: ComicDetail | null;
  initialChapters?: ComicChapter[];
  source: string;
  id: string;
  initialAgeVerified?: boolean;
  initialMangaLanguage?: MangaLanguage;
};

export default function ZineDetail({ initialComic, initialChapters, source, id, initialAgeVerified = false, initialMangaLanguage = 'en' }: Props) {
  const router = useRouter();
  const [readPending, startRead] = useTransition();
  const [pendingChapter, setPendingChapter] = useState<string | null>(null);

  const [comic, setComic] = useState<ComicDetail | null>(initialComic);
  const [chapters, setChapters] = useState<ComicChapter[]>(initialChapters || []);
  const [visibleCount, setVisibleCount] = useState(CHAPTER_BATCH);
  const [loading, setLoading] = useState(!initialComic);

  const [lang, setLang] = useState<Lang>('en');
  const [mangaLang, setMangaLang] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t = translations[lang].library;

  const [ageVerified, setAgeVerified] = useState(Boolean(initialAgeVerified));
  const [showGate, setShowGate] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRead, setLastRead] = useState<{ id: string; title: string; progressPercent?: number } | null>(null);
  const [engagedIds, setEngagedIds] = useState<Set<string>>(() => new Set());

  const restricted = isRestrictedLibrarySource(source);
  const [imgSrc, setImgSrc] = useState(comic?.coverUrl || FALLBACK_IMG);
  useEffect(() => setImgSrc(comic?.coverUrl || FALLBACK_IMG), [comic?.coverUrl]);

  useEffect(() => { if (readAgeVerification()) setAgeVerified(true); }, []);

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => { const n = (e as CustomEvent<Lang>).detail; if (translations[n]) setLang(n); };
    const onManga = (e: Event) => setMangaLang((e as CustomEvent<MangaLanguage>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    window.addEventListener('langChange', onManga as EventListener);
    return () => { window.removeEventListener('langChange', onLang as EventListener); window.removeEventListener('langChange', onManga as EventListener); };
  }, []);

  // Read via a ref (not a useCallback dependency) — `fetchDetails` itself sets `comic`, so
  // depending on `comic` directly would recreate the callback on every fetch and loop forever.
  const comicRef = useRef(comic);
  useEffect(() => { comicRef.current = comic; }, [comic]);

  const fetchDetails = useCallback(async () => {
    if (restricted && !ageVerified) { setShowGate(true); return; }
    setLoading(!comicRef.current);
    try {
      const [c, ch] = await Promise.all([
        getComicDetails(source, id, mangaLang),
        getChapters(source, id, mangaLang),
      ]);
      if (c) setComic(c);
      if (ch) setChapters(ch);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [source, id, mangaLang, restricted, ageVerified]);

  // SSR provided the first render; only skip the refetch if it was actually fetched in the
  // content language this client instance is using — otherwise (e.g. an explicit content-language
  // override in Settings that differs from the UI-language-derived SSR default) correct it.
  const skipInitial = useRef(
    Boolean(initialComic) && (initialChapters?.length ?? 0) > 0 && mangaLang === initialMangaLanguage
  );
  useEffect(() => {
    if (skipInitial.current) { skipInitial.current = false; return; }
    const timer = setTimeout(() => void fetchDetails(), 0);
    return () => clearTimeout(timer);
  }, [fetchDetails]);

  // Bookmark + last-read sync (local first, then cloud).
  useEffect(() => {
    let cancelled = false;
    const crLabel = translations[lang].library.continueReading;
    const sync = async () => {
      const bm = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      setBookmarked(bm.some((b: { id: string; source: string }) => b.id === id && b.source === source));
      const hist = readReadingHistory();
      // "More like this" shouldn't re-pitch what the reader already bookmarked or has read —
      // a recommendation rail that only ever repeats your own shelf back at you feels stale.
      const engaged = new Set<string>(Object.keys(hist));
      bm.forEach((b: { id: string; source: string }) => engaged.add(`${b.source}:${b.id}`));
      setEngagedIds(engaged);
      const h = hist[`${source}:${id}`];
      let next = h ? { id: h.chapterId || h.id || id, title: h.chapterTitle || h.title || crLabel, progressPercent: h.progressPercent } : null;
      try {
        const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => null);
        if (me?.user) {
          const pd = await fetch(`/api/reading-progress?source=${encodeURIComponent(source)}&comicId=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null);
          if (pd?.progress?.chapterId) next = { id: pd.progress.chapterId, title: pd.progress.chapterTitle || crLabel, progressPercent: pd.progress.progressPercent };
        }
      } catch { /* local only */ }
      if (!cancelled) setLastRead(next);
    };
    void sync();
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, sync);
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { cancelled = true; window.removeEventListener(BOOKMARKS_UPDATED_EVENT, sync); window.removeEventListener(LIBRARY_ACTIVITY_EVENT, sync); window.removeEventListener('storage', sync); };
  }, [id, source, lang]);

  useEffect(() => {
    if ((restricted || (comic && isAdultComic(comic))) && !ageVerified && !showGate) {
      const timer = setTimeout(() => setShowGate(true), 0);
      return () => clearTimeout(timer);
    }
  }, [comic, ageVerified, showGate, restricted]);

  const toggleBookmark = () => {
    if (bookmarked) { removeBookmark(source, id); trackEvent('bookmark_removed', { source, comicId: id }); }
    else { upsertBookmark({ id, source, title: comic?.title, coverUrl: comic?.coverUrl, rating: comic?.rating, href: `/library/${source}/${id}`, savedAt: Date.now() }); trackEvent('bookmark_added', { source, comicId: id }); }
    setBookmarked((b) => !b);
  };

  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ } };
  const externalShare = (target: 'telegram' | 'twitter' | 'whatsapp') => {
    const url = window.location.href; const title = comic?.title ?? 'iComics.wiki'; const body = `Check out ${title} on iComics.wiki!`;
    const urls = {
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(body)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(body)}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${body}\n\n${url}`)}`,
    } as const;
    window.open(urls[target], '_blank', 'noopener,noreferrer');
  };

  const relatedToShow = useMemo(
    () => (comic?.related || []).filter((r) => !engagedIds.has(`${r.source}:${r.id}`)),
    [comic?.related, engagedIds]
  );

  const nextChapterId = useMemo(() => {
    if (!chapters.length) return null;
    return lastRead?.id && chapters.some((c) => c.id === lastRead.id) ? lastRead.id : chapters[0].id;
  }, [chapters, lastRead]);

  const goRead = useCallback((chapterId: string) => {
    setPendingChapter(chapterId);
    startRead(() => router.push(`/library/${source}/${id}/read/${chapterId}`));
  }, [id, router, source]);

  const startReading = () => {
    if (chapters.length && nextChapterId) { trackEvent('comic_start_reading', { source, comicId: id, chapterId: nextChapterId }); goRead(nextChapterId); }
    else document.getElementById('chapters')?.scrollIntoView({ behavior: 'smooth' });
  };

  const verify = () => { persistAgeVerification(); setAgeVerified(true); setShowGate(false); };

  // ---- gated / loading / empty states ----
  if (restricted && !ageVerified) {
    return (
      <div className="zine grid min-h-dvh place-items-center">
        <AgeGateOverlay title={t.restricted} description={t.ageDesc} confirmLabel={t.verifyBtn} cancelLabel={t.cancelBtn} confirmAction={verify} cancelAction={() => router.push('/library')} zIndex={10000} />
      </div>
    );
  }
  if (loading) {
    return (
      <div className="zine flex min-h-dvh flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        <span className="z-tag z-tag--yellow">{t.loadingComic}</span>
      </div>
    );
  }
  if (!comic) {
    return (
      <div className="zine">
        <ZineNav />
        <div className="z-wrap grid min-h-[60vh] place-items-center">
          <div className="z-box max-w-md p-8 text-center">
            <h2 className="z-display text-[2rem]">{t.loadFailedTitle}</h2>
            <p className="mt-3 text-[15px] font-semibold text-[var(--z-ink-2)]">{t.loadFailedBody}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => void fetchDetails()} className="z-btn z-btn--red z-btn--sm">{t.loadFailedRetry}</button>
              <Link href="/library" className="z-btn z-btn--paper z-btn--sm">{t.backToLibrary}</Link>
            </div>
          </div>
        </div>
        <ZineFooter />
      </div>
    );
  }

  const isMarvel = comic.source === 'marvel';
  const score = comic.aniListData?.averageScore ?? (comic.jikanData?.score ? comic.jikanData.score * 10 : null);
  const rank = comic.aniListData?.trending ?? comic.jikanData?.rank ?? null;

  return (
    <div className="zine">
      <ZineNav />

      <main id="main-content" tabIndex={-1} className="z-wrap pb-10 pt-8">
        <Link href="/library" className="z-tag z-tag--ink mb-8 inline-flex hover:-translate-x-0.5" style={{ transition: 'transform 120ms ease' }}>
          <ChevronLeft size={13} strokeWidth={3} /> {t.backToLibrary}
        </Link>

        {/* ---------------------------------------------- COVER STORY */}
        <section className="grid gap-8 md:grid-cols-[300px_1fr] lg:gap-12">
          <div className="mx-auto w-full max-w-[300px] md:mx-0">
            <div className="z-box relative aspect-[2/3] overflow-hidden !shadow-[9px_9px_0_var(--z-ink)]" style={{ background: 'var(--z-paper-2)' }}>
              <Image src={imgSrc} alt={`${comic.title} — cover`} fill sizes="300px" quality={78} priority unoptimized={imageUnoptimizedForSrc(imgSrc)} onError={() => imgSrc !== FALLBACK_IMG && setImgSrc(FALLBACK_IMG)} className="object-cover" />
              <span className="z-tag z-tag--ink absolute left-2 top-2 !text-[10px] capitalize">{comic.source}</span>
            </div>

            <div className="mt-5 grid gap-3">
              {!isMarvel ? (
                <button type="button" onClick={startReading} className="z-btn z-btn--red w-full text-[16px]">
                  {readPending && pendingChapter === nextChapterId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play size={16} fill="currentColor" />}
                  {t.read}
                </button>
              ) : null}

              {lastRead ? (
                <button type="button" onClick={() => goRead(lastRead.id)} className="z-box z-pop flex w-full flex-col items-start gap-1 px-4 py-3 text-left">
                  <span className="z-tag z-tag--green !text-[10px]">{t.continueReading}</span>
                  <span className="w-full truncate text-[13px] font-bold text-[var(--z-ink)]">{lastRead.title}</span>
                  {typeof lastRead.progressPercent === 'number' ? (
                    <span className="text-[11px] font-bold text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{t.progressComplete.replace('{percent}', String(lastRead.progressPercent))}</span>
                  ) : null}
                </button>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={toggleBookmark} aria-pressed={bookmarked} className={`z-btn z-btn--sm ${bookmarked ? 'z-btn--blue' : 'z-btn--paper'}`}>
                  <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} /> {bookmarked ? t.bookmarked : t.bookmark}
                </button>
                <button type="button" onClick={() => setShareOpen(true)} className="z-btn z-btn--paper z-btn--sm">
                  <Share2 size={14} /> {t.share}
                </button>
              </div>
              <button type="button" onClick={() => router.push(`/support?category=CONTENT_ISSUE&comic=${encodeURIComponent(comic.title)}&source=${source}`)} className="text-[12px] font-bold uppercase tracking-wide text-[var(--z-red)] underline-offset-4 hover:underline" style={{ fontFamily: 'var(--font-zine-mono)' }}>
                {t.reportIssue}
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {comic.rating ? <span className="z-tag z-tag--yellow"><Star size={12} fill="currentColor" /> {comic.rating}</span> : null}
              {comic.status ? <span className="z-tag z-tag--green">{comic.status}</span> : null}
              {comic.year ? <span className="z-tag z-tag--paper"><Clock size={11} /> {comic.year}</span> : null}
            </div>

            <h1 className="z-display mt-4 text-[clamp(2.2rem,6vw,5rem)] leading-[0.84]">{comic.title}</h1>

            {comic.author ? (
              <p className="mt-4 flex items-center gap-2 text-[14px] font-bold text-[var(--z-ink-2)]">
                <User size={15} strokeWidth={2.5} /> {comic.author}
              </p>
            ) : null}

            {comic.source === 'mangadex' && comic.mangaDexStats ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {comic.mangaDexStats.follows ? <span className="z-tag z-tag--paper"><Users size={11} /> {comic.mangaDexStats.follows.toLocaleString()} follows</span> : null}
                {comic.mangaDexStats.ratingBayesian != null ? <span className="z-tag z-tag--paper"><BarChart2 size={11} /> Bayes {comic.mangaDexStats.ratingBayesian.toFixed(2)}</span> : null}
              </div>
            ) : null}

            {comic.genres?.length ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {comic.genres.map((g, i) => (
                  <Link key={g} href={`/library?q=${encodeURIComponent(g)}`} className="rounded-[6px] border-2 border-[var(--z-ink)] px-2.5 py-1 text-[12px] font-bold hover:-translate-y-0.5" style={{ background: 'var(--z-card)', color: 'var(--z-ink)', boxShadow: '2px 2px 0 var(--z-ink)', transition: 'transform 120ms ease', borderLeftWidth: 5, borderLeftColor: GENRE_TINTS[i % GENRE_TINTS.length] }}>
                    {g}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* stat stamps */}
            {score || rank ? (
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {score ? (
                  <div className="z-box p-4">
                    <span className="z-kicker text-[var(--z-ink-2)]">Score</span>
                    <div className="z-display mt-1 text-[2.4rem] leading-none text-[var(--z-red)]">{Math.round(Number(score))}<span className="text-[1rem] text-[var(--z-ink-2)]">/100</span></div>
                  </div>
                ) : null}
                {rank ? (
                  <div className="z-box p-4">
                    <span className="z-kicker text-[var(--z-ink-2)] flex items-center gap-1"><TrendingUp size={12} /> Rank</span>
                    <div className="z-display mt-1 text-[2.4rem] leading-none text-[var(--z-blue)]">#{rank}</div>
                  </div>
                ) : null}
                <div className="z-box p-4">
                  <span className="z-kicker text-[var(--z-ink-2)]">Status</span>
                  <div className="z-display mt-1 truncate text-[1.6rem] leading-none">{comic.status || '—'}</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ---------------------------------------------- SYNOPSIS */}
        {comic.description ? (
          <section className="mt-16">
            <h2 className="z-display -rotate-1 mb-5 inline-block border-[3px] border-[var(--z-ink)] bg-[var(--z-yellow)] px-3 py-1 text-[clamp(1.6rem,4vw,2.4rem)] leading-[0.82] shadow-[4px_4px_0_var(--z-ink)]">{t.synopsis}</h2>
            <div className="z-box p-5 text-[15px] leading-relaxed text-[var(--z-ink)] md:p-7 md:text-[16px]">
              <RichTextContent content={String(comic.description).replace(/\[\/?[bi]\]/g, '')} />
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------- CHAPTERS */}
        {!isMarvel ? (
          <section id="chapters" className="mt-16">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="z-display -rotate-1 inline-block border-[3px] border-[var(--z-ink)] bg-[var(--z-blue)] px-3 py-1 text-[clamp(1.6rem,4vw,2.4rem)] leading-[0.82] text-[var(--z-paper)] shadow-[4px_4px_0_var(--z-ink)]">{t.chaptersHeading}</h2>
              <span className="z-tag z-tag--ink shrink-0">{t.chaptersTotal.replace('{count}', String(chapters.length))}</span>
            </div>

            {chapters.length ? (
              <div className="grid gap-3">
                {chapters.slice(0, visibleCount).map((ch) => {
                  const opening = readPending && pendingChapter === ch.id;
                  const inner = (
                    <>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px] border-2 border-[var(--z-ink)] bg-[var(--z-yellow)] text-[13px] font-black text-[var(--z-ink)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{ch.chapterNum}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-extrabold text-[var(--z-ink)]">{ch.title || t.chapterTitleFallback.replace('{num}', String(ch.chapterNum))}</span>
                        <span className="text-[11px] font-bold uppercase text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>Vol {ch.volume || '0'}{ch.scanlationGroup ? ` · ${ch.scanlationGroup}` : ''}</span>
                      </span>
                      {ch.externalUrl ? <ExternalLink size={17} strokeWidth={2.5} /> : opening ? <Loader2 size={17} className="animate-spin" /> : <ChevronRight size={18} strokeWidth={3} className="transition-transform group-hover:translate-x-1" />}
                    </>
                  );
                  return ch.externalUrl ? (
                    <a key={ch.id} href={ch.externalUrl} target="_blank" rel="noopener noreferrer" className="z-box z-pop group flex items-center gap-3 px-3 py-2.5">{inner}</a>
                  ) : (
                    <button key={ch.id} type="button" onClick={() => goRead(ch.id)} className="z-box z-pop group flex items-center gap-3 px-3 py-2.5 text-left">{inner}</button>
                  );
                })}
                {chapters.length > visibleCount ? (
                  <button type="button" onClick={() => setVisibleCount((c) => c + CHAPTER_BATCH)} className="z-btn z-btn--paper mt-2">
                    Show more ({chapters.length - visibleCount}) <ChevronRight size={14} className="rotate-90" strokeWidth={3} />
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="z-box p-8 text-center">
                <h3 className="z-display text-[1.6rem]">{t.noChaptersForLanguage}</h3>
                <p className="mt-2 text-[14px] font-semibold text-[var(--z-ink-2)]">{t.noChaptersHintBefore}<b>{mangaLang.toUpperCase()}</b>{t.noChaptersHintAfter}</p>
              </div>
            )}
          </section>
        ) : null}

        {/* ---------------------------------------------- RELATED */}
        {relatedToShow.length > 0 ? (
          <section className="mt-16">
            <h2 className="z-display -rotate-1 mb-6 inline-block border-[3px] border-[var(--z-ink)] bg-[var(--z-purple)] px-3 py-1 text-[clamp(1.6rem,4vw,2.4rem)] leading-[0.82] text-[var(--z-paper)] shadow-[4px_4px_0_var(--z-ink)]">{t.moreLikeThis}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {relatedToShow.slice(0, 12).map((r, i) => (
                <Link key={r.id} href={`/library/${r.source}/${r.id}`} className="z-box z-pop group block overflow-hidden" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 0.6}deg)` }}>
                  <span className="z-cover block">
                    <RelatedImg src={r.coverUrl} alt={r.title} />
                  </span>
                  <span className="block px-2.5 py-2 text-[12.5px] font-extrabold leading-tight text-[var(--z-ink)] line-clamp-2">{r.title}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <ZineFooter />

      {/* ---------------------------------------------- SHARE MODAL */}
      {shareOpen ? (
        <div className="fixed inset-0 z-[10000] grid place-items-center p-4">
          <button type="button" aria-label="Close" onClick={() => setShareOpen(false)} className="absolute inset-0 bg-[rgba(23,18,11,0.55)]" />
          <div className="z-box relative w-full max-w-md p-6 !shadow-[9px_9px_0_var(--z-ink)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="z-display text-[1.8rem]">{t.shareModalTitle}</h3>
              <button type="button" onClick={() => setShareOpen(false)} className="grid h-9 w-9 place-items-center rounded-[6px] border-2 border-[var(--z-ink)] bg-[var(--z-card)]"><X size={18} strokeWidth={2.5} /></button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: 'telegram', name: 'Telegram', Icon: TelegramShareIcon, bg: 'var(--z-blue)' },
                { id: 'twitter', name: 'X', Icon: XShareIcon, bg: 'var(--z-ink)' },
                { id: 'whatsapp', name: 'WhatsApp', Icon: WhatsAppShareIcon, bg: 'var(--z-green)' },
                { id: 'copy', name: copied ? 'Copied!' : 'Copy', Icon: LinkShareIcon, bg: 'var(--z-yellow)' },
              ].map((s) => (
                <button key={s.id} type="button" onClick={() => (s.id === 'copy' ? void copyLink() : externalShare(s.id as 'telegram' | 'twitter' | 'whatsapp'))} className="z-pop flex flex-col items-center gap-1.5">
                  <span className="grid h-12 w-12 place-items-center rounded-[8px] border-[2.5px] border-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)]" style={{ background: s.bg }}>
                    <s.Icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="text-[11px] font-bold" style={{ fontFamily: 'var(--font-zine-mono)' }}>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showGate ? (
        <AgeGateOverlay title={t.restricted} description={t.ageDesc} confirmLabel={t.verifyBtn} cancelLabel={t.cancelBtn} confirmAction={verify} cancelAction={() => router.push('/library')} zIndex={20000} />
      ) : null}
    </div>
  );
}

function RelatedImg({ src, alt }: { src?: string; alt: string }) {
  const [cur, setCur] = useState(src && src.trim() ? src : FALLBACK_IMG);
  useEffect(() => setCur(src && src.trim() ? src : FALLBACK_IMG), [src]);
  return <Image src={cur} alt={alt} fill sizes="180px" quality={65} unoptimized={imageUnoptimizedForSrc(cur)} onError={() => cur !== FALLBACK_IMG && setCur(FALLBACK_IMG)} className="object-cover transition-transform duration-300 group-hover:scale-105" />;
}
