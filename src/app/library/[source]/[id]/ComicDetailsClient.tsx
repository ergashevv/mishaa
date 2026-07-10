"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Play, Star, Clock, Globe, BookOpen, Share2, 
  Bookmark, ChevronRight, Loader2, Sparkles, X, Send, Copy, Check, ExternalLink,
  Users, BarChart2,
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import RichTextContent from '@/components/RichTextContent';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { translations, Lang } from '@/lib/translations';
import { useLibraryAgeDescription } from '@/hooks/useLibraryAgeDescription';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { removeBookmark, upsertBookmark, BOOKMARKS_UPDATED_EVENT, LIBRARY_ACTIVITY_EVENT, readReadingHistory } from '@/lib/library-storage';
import { trackEvent } from '@/lib/analytics';
import {
  readStoredMangaLanguage,
  MangaLanguage,
} from '@/lib/manga-language';
import { getChapters, getComicDetails } from '@/actions/comic';
import { isRestrictedLibrarySource } from '@/lib/comic-sources';
import type { ComicChapter, ComicDetail } from '@/lib/comic-types';
import type {
  MarvelCharacter,
  MarvelIssue,
  MarvelSeries,
  MarvelSeriesIssue,
} from '@/lib/marvel/types';
import { normalizeMarvelImageToProxyUrl } from '@/lib/marvel/image';
import Image from 'next/image';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';
import Link from 'next/link';
import { useDominantColor } from '@/hooks/use-dominant-color';
import {
  TelegramShareIcon,
  XShareIcon,
  WhatsAppShareIcon,
  LinkShareIcon,
} from '@/components/icons/ShareBrandIcons';


const formatMarvelDate = (value?: string) => {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const trimText = (value?: string, max = 140) => {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}...` : cleaned;
};

interface ComicDetailsClientProps {
  initialComic: ComicDetail | null;
  initialChapters?: ComicChapter[];
  source: string;
  id: string;
  initialAgeVerified?: boolean;
}

/** Chapter rows rendered initially and added per "show more" click. */
const CHAPTER_RENDER_BATCH = 100;

export default function ComicDetailsClient({ initialComic, initialChapters, source, id, initialAgeVerified = false }: ComicDetailsClientProps) {
  const router = useRouter();
  const [readNavPending, startReadNavTransition] = useTransition();
  const [pendingReadChapterId, setPendingReadChapterId] = useState<string | null>(null);
  /** Avoid duplicate “opening reader…” when primary Read and Continue target the same chapter. */
  const [pendingReadVia, setPendingReadVia] = useState<'primary' | 'continue' | 'list' | null>(null);

  const [comic, setComic] = useState<ComicDetail | null>(initialComic);
  const [chapters, setChapters] = useState<ComicChapter[]>(initialChapters || []);
  /** Long series (500+ chapters) rendered in one pass lock up mobile — reveal in batches. */
  const [visibleChapterCount, setVisibleChapterCount] = useState(CHAPTER_RENDER_BATCH);
  const [marvelIssue, setMarvelIssue] = useState<MarvelIssue | null>(initialComic?.marvelIssue || null);
  const [marvelSeries, setMarvelSeries] = useState<MarvelSeries | null>(initialComic?.marvelSeries || null);
  const [marvelSeriesIssues, setMarvelSeriesIssues] = useState<MarvelSeriesIssue[]>(initialComic?.marvelSeriesIssues || []);
  const [marvelCharacters, setMarvelCharacters] = useState<MarvelCharacter[]>(initialComic?.marvelCharacters || []);
  const [loading, setLoading] = useState(!initialComic);

  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t = translations[lang].library;
  const ageDescription = useLibraryAgeDescription(t.ageDesc, {
    ageDescEastAsia: t.ageDescEastAsia,
    ageDescEurope: t.ageDescEurope,
  });

  // UI State
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [lastReadChapter, setLastReadChapter] = useState<{ id: string, title: string, progressPercent?: number, currentPage?: number } | null>(null);

  const dominantColor = useDominantColor(comic?.coverUrl);
  const restrictedSource = isRestrictedLibrarySource(source);

  useEffect(() => {
    const verified = initialAgeVerified || readAgeVerification();
    const t = setTimeout(() => setIsAgeVerified(prev => (verified !== prev ? verified : prev)), 0);
    if (verified) persistAgeVerification();
    return () => clearTimeout(t);
  }, [initialAgeVerified]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      t = setTimeout(() => setLang(prev => (savedLang !== prev ? savedLang : prev)), 0);
    }

    const handleLang = (e: Event) => {
      const nextLang = (e as CustomEvent<Lang>).detail;
      setLang(prev => (translations[nextLang] && nextLang !== prev ? nextLang : prev));
    };

    window.addEventListener('langChange', handleLang as EventListener);
    return () => {
      window.removeEventListener('langChange', handleLang as EventListener);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const handleMangaLang = (e: Event) => {
      setMangaLanguage((e as CustomEvent<MangaLanguage>).detail);
    };
    window.addEventListener('langChange', handleMangaLang as EventListener);
    return () => window.removeEventListener('langChange', handleMangaLang as EventListener);
  }, []);

  const fetchComicDetails = useCallback(async () => {
    if (restrictedSource && !isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    const chaptersCacheKey = `chapters_${source}_${id}_${mangaLanguage}`;
    const comicCacheKey = `comic_${source}_${id}_${mangaLanguage}`;

    const cachedChapters = readStorageItem(chaptersCacheKey);
    const cachedComic = readStorageItem(comicCacheKey);
    if (cachedChapters) setChapters(JSON.parse(cachedChapters));
    if (cachedComic) setComic(JSON.parse(cachedComic));

    setLoading(!cachedComic);
    try {
      const [comicData, chapterData] = await Promise.all([
        getComicDetails(source as string, id as string, mangaLanguage),
        getChapters(source as string, id as string, mangaLanguage)
      ]);
      
      if (comicData) {
        setComic(comicData);
        writeStorageItem(comicCacheKey, JSON.stringify(comicData));
        if (comicData.marvelIssue) setMarvelIssue(comicData.marvelIssue);
        if (comicData.marvelSeries) setMarvelSeries(comicData.marvelSeries);
        if (comicData.marvelSeriesIssues) setMarvelSeriesIssues(comicData.marvelSeriesIssues);
        if (comicData.marvelCharacters) setMarvelCharacters(comicData.marvelCharacters);
      }
      if (chapterData) {
        setChapters(chapterData);
        writeStorageItem(chaptersCacheKey, JSON.stringify(chapterData));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, source, mangaLanguage, isAgeVerified, restrictedSource]);

  // SSR already provided this comic + chapters, and the component is keyed per
  // comic so this ref is fresh on every navigation. Skip the redundant initial
  // client refetch — it set loading=true (a flash) and re-hit the server on every
  // comic→comic navigation, which read as "freezes / stale text". Later runs
  // (language switch, age-unlock changing fetchComicDetails identity) still fetch.
  const skipInitialFetch = useRef(Boolean(initialComic) && (initialChapters?.length ?? 0) > 0);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void fetchComicDetails();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchComicDetails]);


  useEffect(() => {
    let cancelled = false;

    const crLabel = translations[lang].library.continueReading;

    const syncLibraryState = async () => {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      const bookmarked = bookmarks.some((b: any) => b.id === id && b.source === source);
      setIsBookmarked(bookmarked);

      const localHistory = readReadingHistory();
      const localComicHistory = localHistory[`${source}:${id}`];
      let nextHistory = localComicHistory
        ? {
            id: localComicHistory.chapterId || localComicHistory.id || id,
            title: localComicHistory.chapterTitle || localComicHistory.title || crLabel,
            progressPercent: localComicHistory.progressPercent,
            currentPage: localComicHistory.currentPage,
          }
        : null;

      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json().catch(() => null);

        if (meData?.user) {
          const progressRes = await fetch(`/api/reading-progress?source=${encodeURIComponent(source)}&comicId=${encodeURIComponent(id)}`);
          const progressData = await progressRes.json().catch(() => null);
          const progress = progressData?.progress;
          if (progress?.chapterId) {
            nextHistory = {
              id: progress.chapterId,
              title: progress.chapterTitle || crLabel,
              progressPercent: progress.progressPercent,
              currentPage: progress.currentPage,
            };
          }
        }
      } catch {
        // Local history is still available even if the cloud sync fails.
      }

      if (!cancelled) {
        setLastReadChapter(nextHistory);
      }
    };

    void syncLibraryState();
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, syncLibraryState);
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, syncLibraryState);
    window.addEventListener('storage', syncLibraryState);
    return () => {
      cancelled = true;
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, syncLibraryState);
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, syncLibraryState);
      window.removeEventListener('storage', syncLibraryState);
    };
  }, [id, source, lang]);

  const toggleBookmark = () => {
    if (typeof window === 'undefined') return;
    if (isBookmarked) {
      removeBookmark(source, id);
      trackEvent('bookmark_removed', { source, comicId: id, comicTitle: comic?.title || id });
    } else {
      upsertBookmark({
        id,
        source,
        title: comic?.title,
        coverUrl: comic?.coverUrl,
        rating: comic?.rating,
        href: `/library/${source}/${id}`,
        savedAt: Date.now(),
      });
      trackEvent('bookmark_added', { source, comicId: id, comicTitle: comic?.title || id });
    }
    setIsBookmarked(!isBookmarked);
  };

  const openExternalShare = useCallback(
    (target: 'telegram' | 'twitter' | 'whatsapp') => {
      if (typeof window === 'undefined') return;
      const pageUrl = window.location.href;
      const title = comic?.title ?? 'iComics.wiki';
      const snippet = trimText(comic?.description, 100);
      const body = snippet
        ? `Check out ${title} on iComics.wiki!\n\n${snippet}`
        : `Check out ${title} on iComics.wiki!`;
      const urls = {
        telegram: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(body)}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(`Reading ${title} on iComics.wiki!`)}`,
        whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${body}\n\n${pageUrl}`)}`,
      } as const;
      window.open(urls[target], '_blank', 'noopener,noreferrer');
    },
    [comic?.title, comic?.description],
  );

  const socialShares = useMemo(
    () =>
      [
        {
          id: 'telegram' as const,
          name: 'Telegram',
          Icon: TelegramShareIcon,
          iconClass: 'text-[#24A1DE]',
        },
        {
          id: 'twitter' as const,
          name: t.socialTwitterX,
          Icon: XShareIcon,
          iconClass: 'text-fg',
        },
        {
          id: 'whatsapp' as const,
          name: 'WhatsApp',
          Icon: WhatsAppShareIcon,
          iconClass: 'text-[#25D366]',
        },
        {
          id: 'copy' as const,
          name: t.socialCopyLink,
          Icon: LinkShareIcon,
          iconClass: 'text-fg-secondary',
        },
      ] as const,
    [t.socialTwitterX, t.socialCopyLink],
  );

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const reportIssue = () => {
    const params = new URLSearchParams({
      category: 'CONTENT_ISSUE',
      comic: comic?.title || id,
      source,
      details: `Please review this item for broken metadata, unsafe content, or copyright concerns.\n\n${comic?.title || id} (${source}:${id})`,
    });

    trackEvent('report_opened', { source, comicId: id, comicTitle: comic?.title || id });
    router.push(`/support?${params.toString()}`);
  };

  useEffect(() => {
    if ((restrictedSource || (comic && isAdultComic(comic))) && !isAgeVerified && !showAgeGate) {
      const timer = setTimeout(() => setShowAgeGate(true), 0);
      return () => clearTimeout(timer);
    }
  }, [comic, isAgeVerified, showAgeGate, restrictedSource]);

  const handleAgeVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };

  const nextReadChapterId = useMemo(() => {
    if (!chapters.length) return null;
    return lastReadChapter?.id && chapters.some((c) => c.id === lastReadChapter.id)
      ? lastReadChapter.id
      : chapters[0].id;
  }, [chapters, lastReadChapter]);

  const navigateToReaderChapter = useCallback(
    (chapterId: string, via: 'primary' | 'continue' | 'list') => {
      setPendingReadChapterId(chapterId);
      setPendingReadVia(via);
      startReadNavTransition(() => {
        router.push(`/library/${source}/${id}/read/${chapterId}`);
      });
    },
    [id, router, source, startReadNavTransition],
  );

  const startReading = () => {
    if (chapters.length > 0 && nextReadChapterId) {
      trackEvent('comic_start_reading', {
        source,
        comicId: id,
        comicTitle: comic?.title || id,
        chapterId: nextReadChapterId,
      });
      navigateToReaderChapter(nextReadChapterId, 'primary');
    } else {
      // Professional approach: Scroll to the chapters section to show the explanation
      const chaptersSection = document.getElementById('chapters-section');
      if (chaptersSection) {
        chaptersSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        console.warn("No chapters available to read.");
      }
    }
  };

  const primaryReadPending =
    readNavPending &&
    pendingReadVia === 'primary' &&
    nextReadChapterId != null &&
    pendingReadChapterId === nextReadChapterId;


  if (restrictedSource && !isAgeVerified) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
        <AnimatePresence>
          <AgeGateOverlay
            title={t.restricted}
            description={ageDescription}
            confirmLabel={t.verifyBtn}
            cancelLabel={t.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => router.push('/library')}
            zIndex={10000}
          />
        </AnimatePresence>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center bg-app">
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <div className="ic-eyebrow">{t.loadingComic}</div>
      </div>
    </div>
  );

  if (!comic && showAgeGate) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
        <AnimatePresence>
          {showAgeGate && (
            <AgeGateOverlay
              title={t.restricted}
              description={ageDescription}
              confirmLabel={t.verifyBtn}
              cancelLabel={t.cancelBtn}
              confirmAction={handleAgeVerify}
              cancelAction={() => router.push('/library')}
              zIndex={10000}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (!comic) {
    // A swallowed upstream failure used to land here as a bare `return null` — a completely
    // blank page. Show a reassuring, actionable error state instead (age gate above still wins).
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app px-4 text-fg">
        <div className="state-block w-full max-w-md">
          <h4>{t.loadFailedTitle}</h4>
          <p>{t.loadFailedBody}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="ic-btn ic-btn--primary ic-btn--md" onClick={() => void fetchComicDetails()}>
              {t.loadFailedRetry}
            </button>
            <Link href="/library" className="ic-btn ic-btn--secondary ic-btn--md">
              {t.backToLibrary}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (comic.source === 'marvel' && !marvelIssue) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <div className="ic-eyebrow">{t.loadingIssue}</div>
        </div>
      </div>
    );
  }

  if (comic.source === 'marvel' && marvelIssue) {
    return (
      <LazyMotion features={domAnimation} strict>
      <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
        <main id="main-content" tabIndex={-1} className="relative z-10 pt-24 md:pt-28 pb-24 px-4 md:px-20 max-w-7xl mx-auto">
          <m.button
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.back()}
            className="group mb-10 flex items-center gap-2 text-sm font-medium text-fg-secondary transition-colors hover:text-accent-text"
          >
            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Back
          </m.button>

          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-12 lg:gap-20 items-start">
            <m.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 lg:sticky lg:top-28"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-cover bg-card [box-shadow:var(--cover-frame),var(--shadow-md)]">
                <Image
                  src={comic.coverUrl}
                  fill
                  className="object-cover"
                  alt={`${comic.title} — cover`}
                  sizes="360px"
                  quality={76}
                  priority
                  unoptimized={imageUnoptimizedForSrc(comic.coverUrl)}
                />
                <div className="absolute left-3 top-3">
                  <span className="ic-badge ic-badge--solid">Marvel</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={marvelIssue.detailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ic-btn ic-btn--primary ic-btn--md"
                >
                  Official site
                </a>
                <button
                  onClick={() => router.push('/library')}
                  className="ic-btn ic-btn--secondary ic-btn--md"
                >
                  Library
                </button>
              </div>

              <div className="space-y-3 rounded-card border border-line bg-card p-5">
                <div className="ic-eyebrow">Issue details</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-fg-muted">Series</div>
                    <div className="mt-1 font-medium text-fg">{marvelIssue.seriesName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-fg-muted">Year</div>
                    <div className="mt-1 font-mono text-fg">{marvelIssue.yearPage || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-fg-muted">On sale</div>
                    <div className="mt-1 font-mono text-fg">{formatMarvelDate(marvelIssue.onSaleDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-fg-muted">Unlimited</div>
                    <div className="mt-1 font-mono text-fg">{formatMarvelDate(marvelIssue.unlimitedDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-fg-muted">Pages</div>
                    <div className="mt-1 font-mono text-fg">{marvelIssue.pageCount ?? 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-fg-muted">Modified</div>
                    <div className="mt-1 font-mono text-fg">{formatMarvelDate(marvelIssue.modified)}</div>
                  </div>
                </div>
              </div>

              {marvelCharacters.length > 0 && (
                <div className="space-y-4 rounded-card border border-line bg-card p-5">
                  <div className="ic-eyebrow">Featured characters</div>
                  <div className="flex flex-wrap gap-2">
                    {marvelCharacters.slice(0, 10).map((character) => (
                      <button
                        key={character.id}
                        onClick={() => router.push(`/library?tab=Marvel%20Universe&q=${encodeURIComponent(character.name || '')}`)}
                        className="ic-tag ic-tag--interactive"
                      >
                        {character.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </m.div>

            <m.div
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-10"
            >
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ic-badge ic-badge--solid">
                    Marvel Comics
                  </span>
                  <span className="ic-badge ic-badge--neutral">
                    Issue #{marvelIssue.issueNumber || '?'}
                  </span>
                  <span className="ic-badge ic-badge--neutral">
                    {comic.rating}
                  </span>
                </div>

                <h1 className="ic-display text-4xl text-fg md:text-6xl">
                  {comic.title}
                </h1>
                <p className="max-w-3xl text-sm leading-relaxed text-fg-muted md:text-base">
                  {t.titlePageSeoIntroLegacyIssue.replace(/\{\{title\}\}/g, comic.title)}
                </p>
                <p className="max-w-3xl text-base leading-relaxed text-fg-secondary md:text-lg">
                  {comic.description}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-card border border-line bg-card p-5">
                  <div className="ic-eyebrow">Series</div>
                  <div className="mt-2 text-sm font-medium text-fg">{marvelIssue.seriesName}</div>
                </div>
                <div className="rounded-card border border-line bg-card p-5">
                  <div className="ic-eyebrow">Issue</div>
                  <div className="mt-2 font-mono text-sm text-fg">#{marvelIssue.issueNumber || '?'}</div>
                </div>
                <div className="rounded-card border border-line bg-card p-5">
                  <div className="ic-eyebrow">Year</div>
                  <div className="mt-2 font-mono text-sm text-fg">{marvelIssue.yearPage || 'Unknown'}</div>
                </div>
                <div className="rounded-card border border-line bg-card p-5">
                  <div className="ic-eyebrow">Pages</div>
                  <div className="mt-2 font-mono text-sm text-fg">{marvelIssue.pageCount ?? 'Unknown'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8">
                <div className="space-y-6 rounded-card border border-line bg-card p-6 md:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="ic-eyebrow">Creators</div>
                      <h2 className="ic-display mt-2 text-2xl text-fg">Credits</h2>
                    </div>
                    <BookOpen className="text-fg-muted" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(marvelIssue.creators || []).map((creator) => (
                      <div key={`${creator.id}-${creator.role}`} className="rounded-btn border border-line bg-inset p-4">
                        <div className="ic-eyebrow">{creator.role}</div>
                        <div className="mt-2 text-sm font-medium leading-tight text-fg">{creator.name}</div>
                      </div>
                    ))}
                    {(marvelIssue.creators || []).length === 0 && (
                      <div className="state-block sm:col-span-2">
                        <p>No creator metadata available.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 rounded-card border border-line bg-card p-6 md:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="ic-eyebrow">Series order</div>
                      <h2 className="ic-display mt-2 text-2xl text-fg">Issues</h2>
                    </div>
                    <span className="font-mono text-xs text-fg-muted">
                      {marvelSeriesIssues.length} total
                    </span>
                  </div>

                  <div className="max-h-[640px] divide-y divide-line-subtle overflow-auto pr-2">
                    {marvelSeriesIssues.slice(0, 18).map((issue) => (
                      <button
                        key={issue.id}
                        onClick={() => router.push(`/library/marvel/${issue.id}`)}
                        className="group flex w-full items-center justify-between gap-4 px-2 py-3 text-left transition-colors hover:bg-inset"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-fg-muted">
                            #{issue.issueNumber || issue.id}
                          </div>
                          <div className="mt-1 truncate text-sm font-medium leading-tight text-fg">
                            {issue.title}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-xs text-fg-muted">
                            {formatMarvelDate(issue.onSaleDate)}
                          </div>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-fg-muted transition-colors group-hover:text-accent-text" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {marvelSeries && (
                <div className="space-y-6 rounded-card border border-line bg-card p-6 md:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="ic-eyebrow">Series</div>
                      <h2 className="ic-display mt-2 text-2xl text-fg">About this series</h2>
                    </div>
                    <Globe className="text-fg-muted" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-cover bg-sunken [box-shadow:var(--cover-frame)]">
                      <Image
                        src={normalizeMarvelImageToProxyUrl(marvelSeries.thumbnail) || comic.coverUrl}
                        alt={`${marvelSeries.title || marvelIssue.seriesName || 'Series'} — cover`}
                        fill
                        sizes="220px"
                        quality={72}
                        unoptimized={imageUnoptimizedForSrc(
                          normalizeMarvelImageToProxyUrl(marvelSeries.thumbnail) || comic.coverUrl,
                        )}
                        className="object-cover"
                      />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-semibold text-fg">
                          {marvelSeries.title || marvelIssue.seriesName}
                        </div>
                        <p className="mt-3 max-w-3xl text-base leading-relaxed text-fg-secondary">
                          {trimText(marvelSeries.description, 300) || 'Series description from Marvel.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-btn border border-line bg-inset p-4">
                          <div className="ic-eyebrow">Series ID</div>
                          <div className="mt-2 font-mono text-sm text-fg">{marvelSeries.id}</div>
                        </div>
                        <div className="rounded-btn border border-line bg-inset p-4">
                          <div className="ic-eyebrow">Start year</div>
                          <div className="mt-2 font-mono text-sm text-fg">{marvelSeries.startYear || 'Unknown'}</div>
                        </div>
                        <div className="rounded-btn border border-line bg-inset p-4">
                          <div className="ic-eyebrow">End year</div>
                          <div className="mt-2 font-mono text-sm text-fg">{marvelSeries.endYear || 'Ongoing'}</div>
                        </div>
                        <div className="rounded-btn border border-line bg-inset p-4">
                          <div className="ic-eyebrow">Updated</div>
                          <div className="mt-2 font-mono text-sm text-fg">{formatMarvelDate(marvelSeries.modified)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </m.div>
          </div>
        </main>
      </div>
      </LazyMotion>
    );
  }

  const titleLength = comic.title.trim().length;
  const titleSizeClass =
    titleLength > 120
      ? 'text-[clamp(0.95rem,4.2vw+0.2rem,2.2rem)] sm:text-[clamp(1.15rem,2.6vw+0.45rem,2.5rem)]'
      : titleLength > 80
        ? 'text-[clamp(1.1rem,3.8vw+0.35rem,2.5rem)] sm:text-[clamp(1.35rem,2.4vw+0.6rem,2.65rem)]'
        : titleLength > 55
          ? 'text-[clamp(1.35rem,3.4vw+0.5rem,2.95rem)] sm:text-[clamp(1.6rem,2.8vw+0.65rem,3.15rem)]'
          : titleLength > 35
            ? 'text-[clamp(1.55rem,3vw+0.55rem,3.35rem)] sm:text-[clamp(1.85rem,3.2vw+0.7rem,3.85rem)]'
            : 'text-[clamp(1.75rem,3.5vw+0.45rem,3.85rem)] sm:text-[clamp(2rem,3.8vw+0.5rem,4.5rem)]';
  const titleTrackingClass =
    titleLength > 70 ? 'tracking-normal sm:tracking-tight' : 'tracking-tight';
  /** Quiet editorial wash from the cover's dominant color — flat tint, no gradients. */
  const backdropTintStyle = { backgroundColor: `rgba(${dominantColor}, 0.06)` };

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      {/* Age Gate Overlay */}
      <AnimatePresence>
        {showAgeGate && (
          <AgeGateOverlay
            title={t.restricted}
            description={ageDescription}
            confirmLabel={t.verifyBtn}
            cancelLabel={t.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => router.push('/library')}
            zIndex={20000}
          />
        )}
      </AnimatePresence>

      {/* Backdrop — flat tint sampled from the cover, follows the active theme */}
      <div className="pointer-events-none fixed inset-0 z-0" style={backdropTintStyle} aria-hidden />

      <main className="relative z-10 mx-auto max-w-[min(100%,88rem)] px-4 pb-28 pt-20 sm:px-6 lg:px-10">
        <m.div initial={false} animate={{ opacity: 1, x: 0 }}>
          <Link
            href="/library"
            className="group mb-10 flex items-center gap-2 text-sm font-medium text-fg-secondary transition-colors hover:text-accent-text"
          >
            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" /> {t.backToLibrary}
          </Link>
        </m.div>

        <article
          itemScope
          itemType="https://schema.org/ComicStory"
          className="space-y-14 lg:space-y-20"
        >
          <section className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12 xl:gap-16">
          <m.div initial={false} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-[14rem] shrink-0 sm:max-w-[15rem] lg:mx-0 lg:max-w-[15.5rem] xl:max-w-[16.5rem] lg:sticky lg:top-24">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-cover bg-card [box-shadow:var(--cover-frame),var(--shadow-md)]">
               <Image 
                 src={comic.coverUrl} 
                 fill
                 className="object-cover"
                 alt={`${comic.title} — cover`} 
                 itemProp="image"
                 sizes="(max-width: 1024px) 256px, 288px"
                 quality={78}
                 priority
                 unoptimized={imageUnoptimizedForSrc(comic.coverUrl)}
               />
            </div>
            
            <div className="mt-6 grid grid-cols-1 gap-3">
               {comic.source !== 'superhero' && (
                 <button
                   type="button"
                   onClick={startReading}
                   aria-busy={primaryReadPending}
                   className="ic-btn ic-btn--primary ic-btn--lg w-full"
                 >
                   {primaryReadPending ? (
                     <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                   ) : (
                     <Play fill="currentColor" size={16} className="shrink-0" aria-hidden />
                   )}
                   <span className="truncate">{primaryReadPending ? t.openingReader : t.read}</span>
                 </button>
               )}

               {lastReadChapter && (
                 <m.div
                   initial={false}
                   animate={{ opacity: 1, y: 0 }}
                 >
                   <button
                     type="button"
                     onClick={() => navigateToReaderChapter(lastReadChapter.id, 'continue')}
                     aria-busy={readNavPending && pendingReadVia === 'continue' && pendingReadChapterId === lastReadChapter.id}
                     className="flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-btn border border-line bg-card px-4 py-3 transition-colors hover:bg-card-hov"
                   >
                     <span className="flex items-center gap-2 text-xs font-semibold text-accent-text">
                       {readNavPending && pendingReadVia === 'continue' && pendingReadChapterId === lastReadChapter.id ? (
                         <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                       ) : null}
                       {readNavPending && pendingReadVia === 'continue' && pendingReadChapterId === lastReadChapter.id
                         ? t.openingReader
                         : t.continueReading}
                     </span>
                     <span className="w-full truncate text-center text-xs text-fg-secondary">{lastReadChapter.title}</span>
                     {typeof lastReadChapter.progressPercent === 'number' && (
                       <span className="font-mono text-[11px] text-fg-muted">
                         {t.progressComplete.replace('{percent}', String(lastReadChapter.progressPercent))}
                       </span>
                     )}
                   </button>
                 </m.div>
               )}
              {/* 2 cols at ~115px each clipped RU labels ("Заклад…" / "Подели…"); tighter
                  padding/type + no truncate keeps whole words visible in every locale. */}
              <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={toggleBookmark}
                    aria-pressed={isBookmarked}
                    className={`ic-btn ic-btn--md !px-2 text-xs ${isBookmarked ? 'ic-btn--primary' : 'ic-btn--secondary'}`}
                  >
                    <Bookmark size={14} className="shrink-0" fill={isBookmarked ? "currentColor" : "none"} />
                    <span>{isBookmarked ? t.bookmarked : t.bookmark}</span>
                  </button>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="ic-btn ic-btn--secondary ic-btn--md !px-2 text-xs"
                  >
                    <Share2 size={14} className="shrink-0" /> <span>{t.share}</span>
                  </button>
                  <button
                    onClick={reportIssue}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-btn border border-line text-xs font-semibold text-danger transition-colors hover:bg-card"
                  >
                    {t.reportIssue}
                  </button>
               </div>
            </div>
          </m.div>

          <div className="flex min-w-0 flex-1 flex-col gap-10 lg:gap-12">
          {/* Main Info */}
          <m.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="min-w-0 space-y-6">
            <div className="min-w-0 space-y-5">
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-3">
                 <span className="ic-score shrink-0">
                    <Star size={13} fill="currentColor" aria-hidden /> {comic.rating}
                 </span>
                 <span className="ic-badge ic-badge--neutral shrink-0">
                    {comic.source}
                 </span>
                 <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-fg-muted"><Clock size={12} className="shrink-0" aria-hidden /> {comic.year || 'N/A'}</span>
                 {comic.author && (
                   <span className="flex min-w-0 w-full basis-full flex-col gap-1 text-sm text-fg-secondary sm:basis-auto sm:max-w-[min(100%,42rem)] sm:flex-row sm:items-baseline sm:gap-2">
                     <span className="ic-eyebrow shrink-0">{t.authorLabel}</span>
                     <span className="min-w-0 wrap-anywhere leading-snug">{comic.author}</span>
                   </span>
                 )}
                 <span className="ic-badge ic-badge--accent shrink-0">{comic.status}</span>
              </div>

              {comic.source === 'mangadex' && comic.mangaDexStats && (
                <div className="-mt-1 flex flex-wrap items-center gap-2">
                  {comic.mangaDexStats.follows != null && comic.mangaDexStats.follows > 0 ? (
                    <div className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-card px-3 py-1.5 text-xs text-fg-secondary">
                      <Users size={12} className="text-fg-muted" aria-hidden />
                      <span>MangaDex · {comic.mangaDexStats.follows.toLocaleString()} follows</span>
                    </div>
                  ) : null}
                  {(comic.mangaDexStats.ratingBayesian != null || comic.mangaDexStats.ratingAverage != null) ? (
                    <div className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-card px-3 py-1.5 text-xs text-fg-secondary">
                      <BarChart2 size={12} className="text-fg-muted" aria-hidden />
                      <span>
                        {comic.mangaDexStats.ratingAverage != null
                          ? `Avg ${comic.mangaDexStats.ratingAverage.toFixed(2)}`
                          : null}
                        {comic.mangaDexStats.ratingAverage != null && comic.mangaDexStats.ratingBayesian != null
                          ? ' · '
                          : null}
                        {comic.mangaDexStats.ratingBayesian != null
                          ? `Bayesian ${comic.mangaDexStats.ratingBayesian.toFixed(2)}`
                          : null}
                      </span>
                    </div>
                  ) : null}
                  {(comic.mangaDexStats.unavailableChaptersCount ?? 0) > 0 ? (
                    <div className="inline-flex rounded-btn border border-line bg-card px-3 py-1.5 text-xs text-warning">
                      Some chapters unavailable ({comic.mangaDexStats.unavailableChaptersCount})
                    </div>
                  ) : null}
                </div>
              )}

                <h1
                  itemProp="name"
                  className={`${titleSizeClass} ${titleTrackingClass} ic-display w-full min-w-0 max-w-full hyphens-auto text-fg leading-snug md:leading-[1.05] text-balance wrap-anywhere`}
                >
                  {comic.title}
                </h1>

                <p className="wrap-anywhere hyphens-auto text-pretty text-sm leading-relaxed text-fg-muted md:text-base">
                  {t.titlePageSeoIntro.replace(/\{\{title\}\}/g, comic.title)}
                </p>

              <div className="flex min-w-0 max-w-full flex-wrap gap-2 pt-4">
                {comic.genres.map(genre => (
                  <span key={genre} className="ic-tag max-w-[min(100%,100vw-2rem)] wrap-anywhere">
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          </m.div>

            <div className="min-w-0 space-y-12 lg:space-y-14">
            <section className="space-y-4">
                  <div className="flex items-center gap-3 pb-1">
                     <h2 className="text-base font-semibold text-fg">{t.synopsis}</h2>
                     <div className="ic-rule flex-1" />
                  </div>
                  <div
                    itemProp="description"
                    className="description-content max-h-[min(70vh,48rem)] overflow-y-auto rounded-card border border-line bg-card p-5 text-[0.95rem] leading-relaxed text-fg-secondary md:p-6 md:text-[1.02rem]"
                  >
                    <RichTextContent
                      content={String(comic.description || "")
                        .replace(/\[b\]/g, '')
                        .replace(/\[\/b\]/g, '')
                        .replace(/\[i\]/g, '')
                        .replace(/\[\/i\]/g, '')}
                    />
                  </div>
            </section>

               {comic.related && comic.related.length > 0 && (
                 <section className="space-y-4">
                   <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="section__titles">
                        <span className="ic-eyebrow">{t.similarTitles}</span>
                        <h2 className="text-base font-semibold text-fg">{t.moreLikeThis}</h2>
                      </div>
                   </div>

                   <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
                     {comic.related.map((item) => (
                       <div
                         key={item.id}
                         className="w-[6.75rem] shrink-0 snap-start sm:w-[7.25rem]"
                       >
                         <Link
                           href={`/library/${item.source}/${item.id}`}
                           className="ic-cover block text-left"
                         >
                           <div className="ic-cover__poster">
                             <Image
                               src={item.coverUrl}
                               fill
                               sizes="116px"
                               quality={68}
                               unoptimized={imageUnoptimizedForSrc(item.coverUrl)}
                               className="object-cover"
                               alt={`${item.title} — cover`}
                             />
                           </div>
                           <p className="ic-cover__title text-xs">
                             {item.title}
                           </p>
                         </Link>
                       </div>
                     ))}
                   </div>
                 </section>
               )}

                {/* Big Data - Characters & Actors Section */}
                {comic.aniListData && (comic.aniListData.characters?.edges?.length ?? 0) > 0 && (
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center gap-3 pb-1">
                      <h2 className="text-base font-semibold text-fg">Characters & cast</h2>
                      <div className="ic-rule flex-1" />
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                      {(comic.aniListData?.characters?.edges ?? []).map((edge, index) => (
                        <div key={edge.node?.id ?? `char-${index}`} className="group cursor-default">
                          <div className="relative aspect-[3/4] overflow-hidden rounded-cover bg-card [box-shadow:var(--cover-frame)]">
                            <Image
                              src={edge.node?.image?.large || '/logo.png'}
                              alt={edge.node?.name?.full ? `${edge.node.name.full} — character` : 'Character'}
                              fill
                              sizes="80px"
                              quality={62}
                              className="object-cover object-top"
                            />
                          </div>
                          <div className="mt-2 space-y-0.5">
                            <div className="truncate text-xs font-medium text-fg-secondary">
                              {edge.node?.name?.userPreferred}
                            </div>
                            <div className="ic-eyebrow">
                              {edge.role === 'MAIN' ? 'Main' : 'Support'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advanced Metadata Stats */}
                {(comic.aniListData || comic.jikanData) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <div className="min-w-0 space-y-3 rounded-card border border-line bg-card p-4 md:p-6">
                      <div className="ic-eyebrow">Community score</div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <div className="ic-display text-2xl leading-none text-accent-text md:text-4xl lg:text-5xl">
                          {Math.round(Number(comic.aniListData?.averageScore || (comic.jikanData?.score ? (comic.jikanData.score * 10) : 85)))}
                        </div>
                        <div className="font-mono text-xs text-fg-muted md:text-sm">/100</div>
                      </div>
                      <div className="text-xs text-fg-muted">
                        Based on {comic.aniListData?.popularity || comic.jikanData?.members || '15k'} users
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3 rounded-card border border-line bg-card p-4 md:p-6">
                      <div className="ic-eyebrow">Trending rank</div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <div className="ic-display text-2xl leading-none text-fg md:text-4xl lg:text-5xl">
                          #{comic.aniListData?.trending || comic.jikanData?.rank || '42'}
                        </div>
                        <div className="font-mono text-xs text-fg-muted md:text-sm">top</div>
                      </div>
                      <div className="text-xs text-fg-muted">
                        Trending globally
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3 rounded-card border border-line bg-card p-4 md:p-6">
                      <div className="ic-eyebrow">Series status</div>
                      <div className="flex items-baseline gap-2 overflow-hidden">
                        <div className="ic-display truncate text-lg leading-none text-fg md:text-xl lg:text-2xl">
                          {comic.status}
                        </div>
                      </div>
                      <div className="text-xs text-fg-muted">
                        {comic.year ? `Since ${comic.year}` : 'Active timeline'}
                      </div>
                    </div>
                  </div>
                )}
             </div>

            {/* Conditional Content based on source */}
            {comic.source === 'superhero' && (comic as any).superheroData ? (
               <div className="space-y-10">
                  <div className="space-y-6">
                     <div className="flex items-center gap-3 border-b border-line pb-4">
                        <h3 className="text-base font-semibold text-fg">Power stats</h3>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries((comic as any).superheroData.powerstats || {}).map(([stat, val]) => (
                           <div key={stat} className="flex flex-col items-center justify-center gap-2 rounded-card border border-line bg-card p-5">
                              <span className="ic-eyebrow">{stat}</span>
                              <span className="ic-display text-2xl text-fg">{val === 'null' ? '?' : String(val)}</span>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <div className="ic-eyebrow border-b border-line pb-2">Appearance</div>
                        <div className="space-y-2 text-sm leading-relaxed text-fg-secondary">
                           <p><span className="text-fg-muted">Gender:</span> {(comic as any).superheroData.appearance?.gender}</p>
                           <p><span className="text-fg-muted">Race:</span> {(comic as any).superheroData.appearance?.race}</p>
                           <p><span className="text-fg-muted">Height:</span> {(comic as any).superheroData.appearance?.height?.join(' / ')}</p>
                           <p><span className="text-fg-muted">Weight:</span> {(comic as any).superheroData.appearance?.weight?.join(' / ')}</p>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="ic-eyebrow border-b border-line pb-2">Work & base</div>
                        <div className="space-y-2 text-sm leading-relaxed text-fg-secondary">
                           <p><span className="text-fg-muted">Occupation:</span> {(comic as any).superheroData.work?.occupation}</p>
                           <p><span className="text-fg-muted">Base:</span> {(comic as any).superheroData.work?.base}</p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="ic-eyebrow border-b border-line pb-2">Connections</div>
                     <div className="space-y-4 rounded-card border border-line bg-card p-6 text-sm leading-loose text-fg-secondary">
                        <p><span className="mr-2 text-fg-muted">Affiliation:</span> {(comic as any).superheroData.connections?.['group-affiliation']}</p>
                        <p><span className="mr-2 text-fg-muted">Relatives:</span> {(comic as any).superheroData.connections?.relatives}</p>
                     </div>
                  </div>
               </div>
            ) : (
              <div id="chapters-section" className="space-y-6">
                 <div className="flex items-center justify-between border-b border-line pb-4">
                    <h3 className="text-base font-semibold text-fg">{t.chaptersHeading}</h3>
                    <span className="font-mono text-xs text-fg-muted">{t.chaptersTotal.replace('{count}', String(chapters.length))}</span>
                 </div>
                 <div className="max-h-[min(70vh,44rem)] overflow-y-auto custom-scrollbar pr-2 md:pr-4 divide-y divide-line-subtle">
                    {chapters.length > 0 ? (
                      chapters.slice(0, visibleChapterCount).map((ch) => {
                        const sharedClass =
                          'group relative flex w-full items-center gap-4 px-2 py-4 text-left transition-colors hover:bg-inset md:px-3';
                        const chapterOpening =
                          readNavPending && pendingReadVia === 'list' && pendingReadChapterId === ch.id;
                        const inner = (
                          <>
                            <div className="relative z-10 min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-mono text-xs text-fg-muted">
                                  Vol. {ch.volume || '0'} · Ch. {ch.chapterNum}
                                </div>
                                {ch.externalUrl && (
                                  <div className="ic-badge ic-badge--info">
                                    {t.externalChapter}
                                  </div>
                                )}
                              </div>
                              <div className="wrap-anywhere line-clamp-2 text-sm font-medium leading-snug text-fg md:text-[15px]">
                                {ch.title || t.chapterTitleFallback.replace('{num}', String(ch.chapterNum))}
                              </div>
                              {ch.scanlationGroup ? (
                                <div className="text-xs text-fg-muted">
                                  Group: <span className="text-fg-secondary">{ch.scanlationGroup}</span>
                                </div>
                              ) : null}
                            </div>
                            {ch.externalUrl ? (
                              <ExternalLink
                                size={18}
                                className="relative z-10 shrink-0 text-fg-muted transition-colors group-hover:text-info"
                              />
                            ) : chapterOpening ? (
                              <Loader2
                                size={18}
                                className="relative z-10 shrink-0 animate-spin text-accent"
                                aria-hidden
                              />
                            ) : (
                              <ChevronRight
                                size={18}
                                className="relative z-10 shrink-0 text-fg-muted transition-all group-hover:translate-x-0.5 group-hover:text-accent-text"
                              />
                            )}
                          </>
                        );

                        if (ch.externalUrl) {
                          return (
                            <a
                              key={ch.id}
                              href={ch.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={sharedClass}
                            >
                              {inner}
                            </a>
                          );
                        }

                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => navigateToReaderChapter(ch.id, 'list')}
                            aria-busy={chapterOpening}
                            aria-label={chapterOpening ? t.openingReader : undefined}
                            className={sharedClass}
                          >
                            {inner}
                          </button>
                        );
                      })
                    ) : (
                      <div className="state-block">
                         <BookOpen className="text-fg-muted" size={28} />
                         <h4>{t.noChaptersForLanguage}</h4>
                         <p>
                            {t.noChaptersHintBefore}
                            <b>{mangaLanguage.toUpperCase()}</b>
                            {t.noChaptersHintAfter}
                         </p>
                         <div className="flex flex-wrap justify-center gap-3">
                            <span className="text-xs font-medium text-accent-text">{t.tryHeaderLanguage}</span>
                         </div>
                      </div>
                    )}
                    {chapters.length > visibleChapterCount && (
                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => setVisibleChapterCount((count) => count + CHAPTER_RENDER_BATCH)}
                          className="ic-btn ic-btn--secondary ic-btn--md ic-btn--block"
                        >
                          Show more chapters ({chapters.length - visibleChapterCount})
                          <ChevronRight size={14} className="rotate-90" />
                        </button>
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>
          </section>
        </article>
      </main>

      {/* Custom Creative Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="ic-dialog relative w-full max-w-md"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="ic-eyebrow">{t.shareModalKicker}</div>
                  <div className="ic-dialog__title">{t.shareModalTitle}</div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="ic-iconbtn ic-iconbtn--solid ic-iconbtn--sm"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Comic preview card */}
              <div className="mb-6 flex items-center gap-4 rounded-card border border-line bg-card p-4">
                 <div className="relative aspect-[2/3] w-14 flex-shrink-0 overflow-hidden rounded-cover [box-shadow:var(--cover-frame)]">
                    <Image src={comic.coverUrl} fill sizes="64px" quality={62} unoptimized={imageUnoptimizedForSrc(comic.coverUrl)} className="object-cover" alt={`${comic.title} — cover`} />
                 </div>
                 <div className="min-w-0 flex-1">
                    <div className="ic-eyebrow mb-1">{comic.source}</div>
                    <div className="truncate text-sm font-semibold text-fg">{comic.title}</div>
                 </div>
              </div>

              {/* Social grid */}
              <div className="mb-6 grid grid-cols-4 gap-4">
                {socialShares.map((social) => (
                  <button
                    key={social.id}
                    type="button"
                    onClick={() => {
                      if (social.id === 'copy') {
                        void copyToClipboard();
                        return;
                      }
                      openExternalShare(social.id);
                    }}
                    className="group flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 text-left"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-btn border border-line bg-card transition-colors group-hover:bg-card-hov">
                      <social.Icon
                        className={`h-5 w-5 shrink-0 ${social.iconClass} opacity-90 transition-opacity group-hover:opacity-100`}
                      />
                    </div>
                    <span className="text-xs text-fg-muted transition-colors group-hover:text-fg">
                      {social.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Copy field */}
              <div className="space-y-2">
                 <div className="ic-field__label">{t.pageLinkLabel}</div>
                 <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== 'undefined' ? window.location.href : ''}
                      className="h-11 w-full rounded-btn border border-line bg-card pl-4 pr-24 font-mono text-xs text-fg-secondary outline-none transition-colors focus:border-accent"
                    />
                    <button
                      onClick={copyToClipboard}
                      className={`absolute bottom-1.5 right-1.5 top-1.5 rounded-btn px-3 text-xs font-semibold transition-colors ${
                        linkCopied ? 'bg-success text-white' : 'bg-accent text-on-accent hover:bg-accent-hover'
                      }`}
                    >
                      {linkCopied ? t.copiedButton : t.copyButton}
                    </button>
                 </div>
              </div>

              <div className="ic-rule mt-8" />
            </m.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
        .description-content strong { color: var(--text-primary); }
        .description-content em { color: var(--text-secondary); font-style: italic; }
      `}</style>
    </div>
    </LazyMotion>
  );
}
