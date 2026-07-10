'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HomeQuickSearch from '@/components/HomeQuickSearch';
import {
  MangaLanguage,
  MANGA_LANGUAGE_OPTIONS,
  MANGA_LANGUAGE_STORAGE_KEY,
} from '@/lib/manga-language';
import { readStorageItem } from '@/lib/browser-storage';
import { readAgeVerification, persistAgeVerification } from '@/lib/age-verification';
import {
  LIBRARY_ACTIVITY_EVENT,
  BOOKMARKS_UPDATED_EVENT,
  readBookmarks,
  readReadingHistory,
} from '@/lib/library-storage';
import { translations, Lang } from '@/lib/translations';
import {
  comicKey,
  createDefaultHomeProfile,
  dedupeComics,
  mergeActivityIntoProfile,
  persistHomePreferenceProfile,
  rankComicsForHome,
  readHomePreferenceProfile,
  type HomePreferenceProfile,
} from '@/lib/home-personalization';
import type { HomeShelfComic } from '@/lib/home-data';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';
import { useLibraryAgeDescription } from '@/hooks/useLibraryAgeDescription';

// --- Types ---
type ComicSource = 'mangadex' | 'marvel' | 'nhentai';
type ShelfKey = 'all' | 'featured' | 'romance' | 'fantasy' | 'drama' | 'manga-hub' | 'webtoons' | 'manhwa' | 'trending' | 'for-you' | 'new' | 'doujinshi' | 'milf' | 'ntr';

interface LibraryComic {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  bannerUrl?: string;
  source: ComicSource;
  href?: string;
  meta: string;
  rating?: string;
  year?: string;
  timestamp?: number;
  progressPercent?: number;
  progressStatus?: string;
  genres?: string[];
}

interface ShelfDefinition {
  key: ShelfKey;
  title: string;
  subtitle: string;
  /**
   * Library tab label for the "See all" link when it differs from `title`
   * (must match a CATEGORIES label in ComicLibraryClient, or the library
   * silently falls back to "All sources"). `null` = no library equivalent,
   * hide the link. Omitted = `title` is already a valid tab label.
   */
  libraryTab?: string | null;
}

interface ContinueItem {
  id: string;
  source: string;
  title: string;
  coverUrl?: string;
  progressPercent?: number;
  timestamp: number;
}

const DEFAULT_IMAGE_SRC = '/logo.png';

function resolveImageSrc(src?: string | null) {
  return typeof src === 'string' && src.trim().length > 0 ? src : DEFAULT_IMAGE_SRC;
}

function resolveComicHref(comic: LibraryComic) {
  return comic.href || `/library/${comic.source}/${comic.id}`;
}

/** Deterministic hue from the title so placeholder posters differ per card (design system). */
function posterHueFromTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i += 1) h = (h * 31 + title.charCodeAt(i)) % 360;
  return h;
}

/** Content-rating dot colors (system: safe=green, suggestive=yellow, erotica=pink). */
const RATING_DOT_CLASS: Record<string, string> = {
  safe: 'bg-emerald-500/80',
  suggestive: 'bg-yellow-500/80',
  erotica: 'bg-pink-500/80',
  pornographic: 'bg-pink-600/90',
};

/** MangaDex age/maturity flags — not a user score; UI must not label these as “star rating”. */
const MANGADEX_CONTENT_RATINGS = new Set(['safe', 'suggestive', 'erotica', 'pornographic']);

function getHeroRatingPresentation(comic: LibraryComic): {
  showBlock: boolean;
  label: string;
  value: string;
  badge: string | null;
} {
  const raw = String(comic.rating || '').trim();
  const lower = raw.toLowerCase();

  if (MANGADEX_CONTENT_RATINGS.has(lower)) {
    if (lower === 'safe') {
      const meta = String(comic.meta || '').trim();
      if (meta && !/^\d+(\.\d+)?$/.test(meta)) {
        return { showBlock: true, label: 'Status', value: meta.toUpperCase(), badge: null };
      }
      if (comic.genres?.length) {
        return {
          showBlock: true,
          label: 'Genres',
          value: comic.genres.slice(0, 2).join(' · '),
          badge: null,
        };
      }
      return { showBlock: false, label: '', value: '', badge: null };
    }
    const contentLabels: Record<string, string> = {
      suggestive: 'Suggestive',
      erotica: 'Mature',
      pornographic: 'Adult',
    };
    const labelText = contentLabels[lower] || raw;
    return { showBlock: true, label: 'Content', value: labelText, badge: labelText };
  }

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return { showBlock: true, label: 'Score', value: raw, badge: raw };
  }

  if (!raw) {
    return { showBlock: false, label: '', value: '', badge: null };
  }

  return { showBlock: true, label: 'Rating', value: raw, badge: raw };
}

type SafeCoverImageProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  /** Next image optimizer quality (1–100); lower = fewer bytes. */
  quality?: number;
  className?: string;
};

function SafeCoverImage({
  src,
  alt,
  sizes,
  priority = false,
  quality,
  className,
}: SafeCoverImageProps) {
  const [currentSrc, setCurrentSrc] = useState(() => resolveImageSrc(src));

  useEffect(() => {
    setCurrentSrc(resolveImageSrc(src));
  }, [src]);

  const effectiveQuality =
    quality ?? (priority ? 78 : 68);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      quality={effectiveQuality}
      unoptimized={imageUnoptimizedForSrc(currentSrc)}
      onError={() => {
        if (currentSrc !== DEFAULT_IMAGE_SRC) {
          setCurrentSrc(DEFAULT_IMAGE_SRC);
        }
      }}
      className={className}
    />
  );
}

const SHELVES: ShelfDefinition[] = [
  { key: 'romance', title: 'Romance', subtitle: 'Reader picks' },
  { key: 'fantasy', title: 'Fantasy', subtitle: 'Adventure reads' },
  { key: 'drama', title: 'Drama', subtitle: 'Emotional storytelling', libraryTab: null },
  { key: 'trending', title: 'Trending', subtitle: 'Popular now', libraryTab: null },
  { key: 'for-you', title: 'For You', subtitle: 'From your library', libraryTab: null },
  { key: 'manga-hub', title: 'Manga', subtitle: 'Japanese comics', libraryTab: 'Manga Hub' },
  { key: 'new', title: 'New', subtitle: 'Recently added', libraryTab: null },
  { key: 'manhwa', title: 'Manhwa', subtitle: 'Korean comics' },
  { key: 'webtoons', title: 'Webtoons', subtitle: 'Vertical reads' },
  { key: 'doujinshi', title: 'Doujinshi', subtitle: 'Fan comics' },
  { key: 'milf', title: 'Mature', subtitle: '18+ titles', libraryTab: 'Mature Romance' },
  { key: 'ntr', title: 'NTR', subtitle: 'Drama-focused', libraryTab: 'Doujinshi' },
];

/** One shelf renders as a .spotlight-grid bento (lead card + a tight handful of others)
 * instead of the plain horizontal .shelf row — a deliberate "we chose this for you"
 * moment rather than N identical cards. Kept small so it reads as curated, not a runoff grid. */
const SPOTLIGHT_ITEM_LIMIT = 5;

import AgeGateOverlay from './AgeGateOverlay';
import { isAdultComic } from '@/lib/age-verification';

type HomeAdultCoverUi = {
  imageClass: string;
  showRestrictedOverlay: boolean;
  useRestrictedAlt: boolean;
  maskText: boolean;
  politeBlur: boolean;
};

/** Age-blocked: always blurred + overlay. Verified adults: blurred until hover, focus, or tap-to-peek (touch). */
function homeAdultCoverUi(
  comic: LibraryComic,
  isAgeVerified: boolean,
  useRichMotion: boolean,
  isPreviewOpen = false,
): HomeAdultCoverUi {
  const adultContent = isAdultComic(comic);
  const ageBlocked = adultContent && !isAgeVerified;
  const politeBlur = adultContent && isAgeVerified;

  const motion = 'transition-[filter,transform] duration-[var(--dur-slow)]';

  if (ageBlocked) {
    return {
      imageClass: `object-cover object-center ${motion} scale-105 blur-lg saturate-[0.7]`,
      showRestrictedOverlay: true,
      useRestrictedAlt: true,
      maskText: true,
      politeBlur: false,
    };
  }

  if (politeBlur) {
    return {
      // Touch has no hover, so a first tap "peeks" (isPreviewOpen) and renders unblurred here —
      // appending blur-none after blur-lg would not win (same `filter` property, stylesheet order rules).
      imageClass: isPreviewOpen
        ? `object-cover object-center ${motion} scale-[1.03] blur-none saturate-100`
        : `object-cover object-center ${motion} scale-105 blur-lg saturate-[0.7] group-hover:blur-none group-hover:saturate-100 group-hover:scale-[1.03] group-focus-within:blur-none group-focus-within:saturate-100 group-focus-within:scale-[1.03] group-active:blur-none group-active:saturate-100 group-active:scale-100`,
      showRestrictedOverlay: false,
      useRestrictedAlt: false,
      maskText: false,
      politeBlur: true,
    };
  }

  return {
    imageClass: `object-cover object-center transition-transform duration-[var(--dur-base)] scale-100${useRichMotion ? ' group-hover:scale-[1.03]' : ''}`,
    showRestrictedOverlay: false,
    useRestrictedAlt: false,
    maskText: false,
    politeBlur: false,
  };
}

/** Poster-style card used across shelves and the discovery grid. */
function HomeCoverCard({
  comic,
  coverUi,
  isTouchDevice,
  isPreviewOpen,
  onLockedTap,
  sizes,
  rank,
  featured = false,
  className,
}: {
  comic: LibraryComic;
  coverUi: HomeAdultCoverUi;
  isTouchDevice: boolean;
  isPreviewOpen: boolean;
  onLockedTap?: () => void;
  sizes: string;
  /** 1-based position for ranked shelves (Trending) — renders an editorial serif numeral. */
  rank?: number;
  /** Oversized "spotlight" treatment for the lead card in a .spotlight-grid: bigger serif
   * title plus a short description instead of the plain shelf-card title. */
  featured?: boolean;
  /** Extra classes on the card root — e.g. a wider grid span for a leading discover card. */
  className?: string;
}) {
  return (
    <Link
      href={resolveComicHref(comic)}
      className={`group ic-cover${className ? ` ${className}` : ''}`}
      onClickCapture={(event) => {
        if (!isTouchDevice || !(coverUi.maskText || coverUi.politeBlur) || isPreviewOpen) return;
        event.preventDefault();
        onLockedTap?.();
      }}
    >
      <div
        className="ic-cover__poster"
        style={{ ['--poster-h' as string]: posterHueFromTitle(comic.title) }}
      >
        <SafeCoverImage
          src={comic.coverUrl}
          alt={coverUi.useRestrictedAlt ? 'Restricted' : comic.title}
          sizes={sizes}
          className={coverUi.imageClass}
        />
        {coverUi.showRestrictedOverlay ? (
          <div className="ic-cover__lock">
            <Lock size={16} aria-hidden />
            <span>18+ · Verify age</span>
          </div>
        ) : null}
        {typeof rank === 'number' ? (
          <span className="ic-cover__rank" aria-hidden>{rank}</span>
        ) : null}
      </div>
      <div className={featured ? 'min-h-[5rem] space-y-1.5' : 'min-h-[3.4rem] space-y-1'}>
        <h3
          className={
            featured
              ? 'ic-cover__title ic-display !text-xl !font-normal !leading-[1.05] sm:!text-2xl'
              : 'ic-cover__title'
          }
        >
          {coverUi.maskText ? 'Age restricted' : comic.title}
        </h3>
        <p className="ic-eyebrow line-clamp-1 flex items-center gap-1.5">
          {coverUi.maskText ? (
            isTouchDevice && !isPreviewOpen ? 'Tap to confirm age' : 'Verify age to view'
          ) : (
            <>
              {comic.meta}
              {comic.rating && RATING_DOT_CLASS[comic.rating.toLowerCase()] ? (
                // Content rating as a quiet dot (system rule), not a shouted label
                <span
                  className={`inline-block h-1.5 w-1.5 flex-none rounded-full ${RATING_DOT_CLASS[comic.rating.toLowerCase()]}`}
                  title={comic.rating}
                  aria-label={`Content rating: ${comic.rating}`}
                />
              ) : comic.rating ? (
                <>{comic.meta ? ' · ' : ''}{comic.rating}</>
              ) : null}
            </>
          )}
        </p>
        {featured && !coverUi.maskText && comic.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-fg-secondary">
            {comic.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

type HomeClientProps = {
  initialData?: Record<string, HomeShelfComic[]>;
  initialAgeVerified?: boolean;
  initialIsTouchDevice?: boolean;
  /** Must match SSR `getHomeData` lang so shelves/hero agree with hydration. */
  initialMangaLanguage?: MangaLanguage;
};

export default function HomeClient({
  initialData,
  initialAgeVerified = false,
  initialIsTouchDevice = false,
  initialMangaLanguage = 'en',
}: HomeClientProps) {
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(() => Boolean(initialIsTouchDevice));
  /** Desktop-style hover + motion (exclude touch / coarse pointer and reduced-motion). */
  const [useRichMotion, setUseRichMotion] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [previewCardKey, setPreviewCardKey] = useState<string | null>(null);
  const [preferenceProfile, setPreferenceProfile] = useState<HomePreferenceProfile>(() => createDefaultHomeProfile('initial'));
  const hasCompleteInitialData = SHELVES
    .filter((shelf) => shelf.key !== 'for-you' && !['doujinshi', 'milf', 'ntr'].includes(shelf.key))
    .every((shelf) => (initialData?.[shelf.key]?.length ?? 0) > 0);
  const visibleShelves = isAgeVerified
    ? SHELVES
    : SHELVES.filter((shelf) => !['doujinshi', 'milf', 'ntr'].includes(shelf.key));

  const [shelfState, setShelfState] = useState<Record<string, { items: LibraryComic[]; loading: boolean }>>(() => {
    const base = {} as Record<string, { items: LibraryComic[]; loading: boolean }>;
    SHELVES.forEach(s => {
      base[s.key] = { items: initialData?.[s.key] || [], loading: s.key !== 'for-you' && !(initialData?.[s.key]?.length) };
    });
    base['trending'] = { items: initialData?.['trending'] || [], loading: !(initialData?.['trending']?.length) };
    return base;
  });
  const [activeTab] = useState<ShelfKey>('all');
  /** Last shelf fetch failed (or came back with nothing) — offer one retry block instead of bare headings. */
  const [shelfLoadError, setShelfLoadError] = useState(false);
  const [homeShelfSearch, setHomeShelfSearch] = useState('');
  const [uiLang, setUiLang] = useState<Lang>('en');
  const shelfCopy = translations[uiLang].hero;
  const libraryCopy = translations[uiLang].library;
  const homeAgeDescription = useLibraryAgeDescription(libraryCopy.ageDesc, {
    ageDescEastAsia: libraryCopy.ageDescEastAsia,
    ageDescEurope: libraryCopy.ageDescEurope,
  });
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(() => initialMangaLanguage);
  const [personalRecs, setPersonalRecs] = useState<LibraryComic[]>([]);
  const [isRecsLoading, setIsRecsLoading] = useState(false);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);

  // Infinite Scroll State
  const [infiniteItems, setInfiniteItems] = useState<LibraryComic[]>([]);
  const [infinitePage, setInfinitePage] = useState(0);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [hasMoreInfinite, setHasMoreInfinite] = useState(true);
  const [loaderInView, setLoaderInView] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const heroCarouselPausedRef = useRef(false);
  const seenHomeKeysRef = useRef<Set<string>>(new Set());
  /** When SSR trending is empty — fill once when client trending arrives. */
  const [fallbackHeroDeck, setFallbackHeroDeck] = useState<LibraryComic[] | null>(null);
  const heroFallbackSeededRef = useRef(false);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);

  const loadMoreInfinite = useCallback(async () => {
    if (infiniteLoading || !hasMoreInfinite) return;
    setInfiniteLoading(true);

    try {
      const params = new URLSearchParams({
        mode: 'feed',
        lang: mangaLanguage,
        page: String(infinitePage),
        seed: String(preferenceProfile.seed),
      });
      const res = await fetch(`/api/home/data?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Feed failed');
      const data = await res.json();
      const results = Array.isArray(data?.items) ? data.items as LibraryComic[] : [];
      const ranked = rankComicsForHome(results, {
        profile: preferenceProfile,
        ageVerified: isAgeVerified,
        pageIndex: infinitePage,
        seenKeys: seenHomeKeysRef.current,
      });

      ranked.forEach((item) => seenHomeKeysRef.current.add(comicKey(item)));

      if (ranked.length > 0) {
        setInfiniteItems(prev => dedupeComics([...prev, ...ranked]));
        setInfinitePage(prev => prev + 1);
        setHasMoreInfinite(ranked.length >= 10);
      } else {
        setInfinitePage(prev => prev + 1);
        setHasMoreInfinite(infinitePage < 8);
      }
    } catch (e) {
      console.error(e);
      setHasMoreInfinite(false);
    } finally {
      setInfiniteLoading(false);
    }
  }, [hasMoreInfinite, infiniteLoading, infinitePage, isAgeVerified, mangaLanguage, preferenceProfile]);

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setLoaderInView(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px 400px 0px',
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!loaderInView || infiniteLoading || !hasMoreInfinite) return;
    const timer = window.setTimeout(() => {
      void loadMoreInfinite();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loaderInView, infiniteLoading, hasMoreInfinite, loadMoreInfinite]);

  const handleVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };

  useLayoutEffect(() => {
    // Converge on the effective language (storage first, then the SSR prop) instead of
    // comparing storage to the prop: after the navbar language switch router.refresh()es,
    // storage and the new prop already agree, so a `raw !== initialMangaLanguage` guard
    // would never fire and the shelves would stay in the old language.
    const raw = readStorageItem(MANGA_LANGUAGE_STORAGE_KEY);
    const stored =
      raw && MANGA_LANGUAGE_OPTIONS.some((option) => option.value === raw)
        ? (raw as MangaLanguage)
        : null;
    const next = stored ?? initialMangaLanguage;
    setMangaLanguage((prev) => (prev === next ? prev : next));
  }, [initialMangaLanguage]);

  useLayoutEffect(() => {
    const verified = Boolean(readAgeVerification() || initialAgeVerified);
    setIsAgeVerified(verified);
    if (verified) persistAgeVerification();
  }, [initialAgeVerified]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) {
      timer = setTimeout(() => setUiLang((prev) => (saved !== prev ? saved : prev)), 0);
    }
    const onLang = (e: Event) => setUiLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('langChange', onLang as EventListener);
    };
  }, []);

  useEffect(() => {
    const syncPreferenceProfile = async () => {
      const localProfile = readHomePreferenceProfile();
      const history = readReadingHistory();
      const bookmarks = readBookmarks();

      try {
        const res = await fetch('/api/reading-progress', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const accountItems = Array.isArray(data?.items) ? data.items : [];
          accountItems.forEach((item: {
            source?: string;
            comicId?: string;
            comicTitle?: string | null;
            comicCoverUrl?: string | null;
            updatedAt?: string;
            progressPercent?: number;
            progressStatus?: string;
          }) => {
            if (!item.source || !item.comicId) return;
            history[`${item.source}:${item.comicId}`] = {
              id: item.comicId,
              comicSource: item.source,
              comicTitle: item.comicTitle || undefined,
              comicCoverUrl: item.comicCoverUrl || undefined,
              timestamp: item.updatedAt ? Date.parse(item.updatedAt) : Date.now(),
              progressPercent: item.progressPercent,
              progressStatus: item.progressStatus as never,
            };
          });
        }
      } catch {
        // Guest personalization still works without account progress.
      }

      const merged = mergeActivityIntoProfile(localProfile, history, bookmarks);
      setPreferenceProfile(merged);
      persistHomePreferenceProfile(merged);

      // Surface in-progress titles for "Continue reading".
      const resume = Object.values(history)
        .filter((entry) => entry?.id && entry?.comicTitle && entry?.comicSource && entry.progressStatus !== 'completed')
        .map((entry) => ({
          id: entry.id as string,
          source: entry.comicSource as string,
          title: entry.comicTitle as string,
          coverUrl: entry.comicCoverUrl,
          progressPercent: typeof entry.progressPercent === 'number' ? entry.progressPercent : undefined,
          timestamp: entry.timestamp || 0,
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 12);
      setContinueItems(resume);
    };

    void syncPreferenceProfile();
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, syncPreferenceProfile);
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, syncPreferenceProfile);
    window.addEventListener('storage', syncPreferenceProfile);
    return () => {
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, syncPreferenceProfile);
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, syncPreferenceProfile);
      window.removeEventListener('storage', syncPreferenceProfile);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncRichMotion = () => {
      setPrefersReducedMotion(reduceMotion.matches);
      setUseRichMotion(fineHover.matches && !reduceMotion.matches);
    };

    syncRichMotion();
    fineHover.addEventListener('change', syncRichMotion);
    reduceMotion.addEventListener('change', syncRichMotion);
    return () => {
      fineHover.removeEventListener('change', syncRichMotion);
      reduceMotion.removeEventListener('change', syncRichMotion);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setIsTouchDevice(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const fetchShelves = useCallback(async (lang: MangaLanguage) => {
    setShelfState(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(key => newState[key].loading = true);
      return newState;
    });

    try {
      const res = await fetch(`/api/home/data?lang=${lang}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Home data fetch failed');
      const data = await res.json();

      if (data?.shelves) {
        // The API answers 200 with `{shelves: {}}` when upstreams fail — treat an
        // all-empty payload as a failed fetch so the page can offer a retry.
        const hasAnyItems = Object.values(data.shelves as Record<string, unknown>).some(
          (items) => Array.isArray(items) && items.length > 0,
        );
        setShelfLoadError(!hasAnyItems);
        setShelfState(prev => ({
          'trending': { items: data.shelves['trending'] || [], loading: false },
          'romance': { items: data.shelves['romance'] || [], loading: false },
          'fantasy': { items: data.shelves['fantasy'] || [], loading: false },
          drama: { items: data.shelves['drama'] || [], loading: false },
          'manga-hub': { items: data.shelves['manga-hub'] || [], loading: false },
          'new': { items: data.shelves['new'] || [], loading: false },
          webtoons: { items: data.shelves['webtoons'] || [], loading: false },
          manhwa: { items: data.shelves['manhwa'] || [], loading: false },
          'doujinshi': { items: data.shelves['doujinshi'] || [], loading: false },
          'milf': { items: data.shelves['milf'] || [], loading: false },
          'ntr': { items: data.shelves['ntr'] || [], loading: false },
          'for-you': prev['for-you'] || { items: [], loading: false },
        }));
      } else {
        throw new Error('Home data payload missing shelves');
      }
    } catch (error) {
      console.error('Home data error:', error);
      setShelfLoadError(true);
      setShelfState(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(key => newState[key].loading = false);
        return newState;
      });
    }
  }, []);

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current && hasCompleteInitialData) {
      isFirstMount.current = false;
      return;
    }
    const t = setTimeout(() => {
      void fetchShelves(mangaLanguage);
    }, 0);
    return () => clearTimeout(t);
  }, [fetchShelves, hasCompleteInitialData, isAgeVerified, mangaLanguage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsRecsLoading(true);
      const pool = dedupeComics(Object.entries(shelfState)
        .filter(([key]) => key !== 'for-you')
        .flatMap(([key, state]) => state.items.map((comic) => ({ ...comic, meta: comic.meta || key }))));
      const ranked = rankComicsForHome(pool, {
        profile: preferenceProfile,
        ageVerified: isAgeVerified,
        adultPenalty: -14,
      }).slice(0, 12);

      setPersonalRecs(ranked);
      setIsRecsLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isAgeVerified, preferenceProfile, shelfState]);

  const initialTrendingKey = useMemo(
    () =>
      (initialData?.trending as LibraryComic[] | undefined)
        ?.map((c) => comicKey(c))
        .join('|') ?? '',
    [initialData?.trending],
  );

  const ssrHeroDeck = useMemo(() => {
    const rows = initialData?.trending as LibraryComic[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return dedupeComics([...rows]).slice(0, 10);
  }, [initialTrendingKey]);

  const liveTrendingKey =
    shelfState.trending?.items?.map((c) => comicKey(c)).join('|') ?? '';

  useLayoutEffect(() => {
    heroFallbackSeededRef.current = false;
    setFallbackHeroDeck(null);
  }, [initialTrendingKey]);

  useLayoutEffect(() => {
    if (ssrHeroDeck.length > 0 || heroFallbackSeededRef.current) return;
    const live = shelfState.trending?.items ?? [];
    if (!live.length) return;
    heroFallbackSeededRef.current = true;
    setFallbackHeroDeck(dedupeComics([...live]).slice(0, 10));
  }, [ssrHeroDeck.length, liveTrendingKey]);

  const heroCarouselSlides =
    ssrHeroDeck.length > 0 ? ssrHeroDeck : (fallbackHeroDeck ?? []);

  const heroDeckKey = useMemo(
    () => heroCarouselSlides.map((c) => comicKey(c)).join(','),
    [heroCarouselSlides],
  );

  useEffect(() => {
    setHeroSlideIndex(0);
  }, [heroDeckKey]);

  useEffect(() => {
    if (heroCarouselSlides.length <= 1 || prefersReducedMotion) return;

    const id = window.setInterval(() => {
      if (heroCarouselPausedRef.current) return;
      setHeroSlideIndex((i) => (i + 1) % heroCarouselSlides.length);
    }, 8200);

    return () => window.clearInterval(id);
  }, [heroCarouselSlides.length, heroDeckKey, prefersReducedMotion]);

  const featuredComic =
    heroCarouselSlides[heroSlideIndex] || heroCarouselSlides[0] || null;

  const heroRating = featuredComic ? getHeroRatingPresentation(featuredComic) : null;
  const heroAdultContent = Boolean(featuredComic && isAdultComic(featuredComic));
  const heroAgeBlocked = heroAdultContent && !isAgeVerified;

  const featuredBackgroundSrc = featuredComic?.bannerUrl || featuredComic?.coverUrl || DEFAULT_IMAGE_SRC;
  const renderedShelves = activeTab === 'all'
    ? visibleShelves
    : visibleShelves.filter((shelf) => shelf.key === activeTab);
  const shelfSearchNorm = homeShelfSearch.trim().toLowerCase();
  const shelfCardLimit = isTouchDevice ? 8 : 12;

  /** Prefer "For You" for the bento spotlight moment once it has (or is fetching) picks;
   * guests with no activity yet fall back to the first genre shelf instead. */
  const spotlightShelfKey: ShelfKey = useMemo(
    () => (personalRecs.length > 0 || isRecsLoading ? 'for-you' : 'romance'),
    [personalRecs.length, isRecsLoading],
  );
  const rowShelves = renderedShelves.filter((shelf) => shelf.key !== spotlightShelfKey);
  const spotlightShelf = renderedShelves.find((shelf) => shelf.key === spotlightShelfKey) ?? null;

  const anyShelfLoading = renderedShelves.some((shelf) =>
    shelf.key === 'for-you' ? isRecsLoading : Boolean(shelfState[shelf.key]?.loading),
  );
  const allShelvesEmpty = renderedShelves.every((shelf) =>
    shelf.key === 'for-you'
      ? personalRecs.length === 0
      : (shelfState[shelf.key]?.items.length ?? 0) === 0,
  );
  /** Only when the fetch failed AND there is nothing to show — stale shelves beat an error wall. */
  const showShelfLoadError = shelfLoadError && !anyShelfLoading && allShelvesEmpty;

  const heroFeaturedKey = featuredComic ? comicKey(featuredComic) : '';

  /** Trending fuels the hero; `'all'` is not a shelf key (was always `undefined` → wrong loading UX). */
  const showHeroSkeleton =
    !featuredComic &&
    (Boolean(shelfState.trending?.loading) || Boolean(isRecsLoading));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      seenHomeKeysRef.current = new Set();
      setInfiniteItems([]);
      setInfinitePage(0);
      setHasMoreInfinite(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAgeVerified, mangaLanguage, preferenceProfile.seed]);

  // Shelf auto-advance removed: shelves scrolling themselves every few seconds moved
  // content out from under the pointer/finger, fought user wheel gestures mid-smooth-scroll
  // (the page felt scroll-locked), left rows half-snapped with the first card clipped, and
  // violated the design system's "no looping decorative motion" rule.

  const goToHeroSlide = (delta: number) => {
    if (heroCarouselSlides.length === 0) return;
    setHeroSlideIndex((i) => (i + delta + heroCarouselSlides.length) % heroCarouselSlides.length);
  };

  /**
   * One shelf, two possible rhythms: the plain horizontal-scroll `.shelf` row used almost
   * everywhere, or the `.spotlight-grid` bento (lead card bigger, a few smaller siblings)
   * reserved for `spotlightShelf`. Both branches share every bit of ranking/filtering/adult
   * logic — only the grid container and the lead card's treatment differ.
   */
  const renderShelfSection = (shelf: ShelfDefinition, layout: 'row' | 'bento') => {
    const state = shelf.key === 'for-you' ? { items: personalRecs, loading: isRecsLoading } : shelfState[shelf.key];
    if (!state) return null;

    const searchedItems = state.items.filter(
      (comic) =>
        comic.title.toLowerCase().includes(shelfSearchNorm) ||
        comic.description.toLowerCase().includes(shelfSearchNorm),
    );
    // Trending is a ranked chart: keep the real chart order (meta carries
    // "TRENDING #n") so the serif rank numerals match the metadata, instead of
    // letting personalization silently reshuffle a "top 10" list.
    const filteredItems = shelf.key === 'trending'
      ? [...searchedItems].sort((a, b) => {
          const rank = (c: LibraryComic) => {
            const m = /#(\d+)/.exec(c.meta || '');
            return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
          };
          return rank(a) - rank(b);
        })
      : rankComicsForHome(
      searchedItems,
      {
        profile: preferenceProfile,
        ageVerified: isAgeVerified,
        shelfKey: shelf.key,
      }
    );

    if (shelf.key === 'for-you' && filteredItems.length === 0 && !isRecsLoading) return null;
    if (shelfSearchNorm && filteredItems.length === 0) return null;
    // No headed empty rows: a shelf with nothing on it renders nothing.
    if (!state.loading && filteredItems.length === 0) return null;

    const seeAllTab =
      shelf.libraryTab === null ? null : shelf.libraryTab ?? shelf.title;

    const isBento = layout === 'bento';
    const cardLimit = isBento ? SPOTLIGHT_ITEM_LIMIT : shelfCardLimit;
    const skeletonCount = isBento ? SPOTLIGHT_ITEM_LIMIT : 8;

    return (
      <m.section
        key={shelf.key}
        id={shelf.key}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
        className={`section${isBento ? ' !mt-20 sm:!mt-28' : ''}`}
      >
        <div className="section__head">
          <div className="section__titles">
            <span className="ic-eyebrow">{shelf.subtitle}</span>
            <h2 className={`section__heading${isBento ? ' !text-[clamp(2rem,4vw,3rem)]' : ''}`}>
              {shelf.title}
              {shelf.key === 'for-you' ? <span className="pz">personalized</span> : null}
            </h2>
          </div>
          {seeAllTab ? (
            <Link
              href={`/library?tab=${encodeURIComponent(seeAllTab)}`}
              className="seeall"
            >
              See all
              <ArrowRight size={15} aria-hidden />
            </Link>
          ) : null}
        </div>

        <div className={isBento ? 'spotlight-grid' : 'shelf'}>
          {state.loading ? (
            Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i}>
                <div className="sk sk-cover" />
                <div className="sk sk-line" style={{ width: '85%' }} />
                <div className="sk sk-line" style={{ width: '55%' }} />
              </div>
            ))
          ) : (
            filteredItems.slice(0, cardLimit).map((comic, cardIdx) => {
              const cardKey = `${shelf.key}:${comic.source}:${comic.id}`;
              const adultContent = isAdultComic(comic);
              const isPreviewOpen = adultContent && previewCardKey === cardKey;
              const coverUi = homeAdultCoverUi(comic, isAgeVerified, useRichMotion, isPreviewOpen);

              return (
                <HomeCoverCard
                  key={`${shelf.key}:${comicKey(comic)}`}
                  comic={comic}
                  coverUi={coverUi}
                  isTouchDevice={isTouchDevice}
                  isPreviewOpen={isPreviewOpen}
                  // Locked (unverified) → open the age gate; verified adult → tap-to-peek.
                  onLockedTap={
                    coverUi.maskText
                      ? () => setShowAgeGate(true)
                      : () => setPreviewCardKey(cardKey)
                  }
                  sizes={
                    isBento && cardIdx === 0
                      ? '(max-width: 560px) 100vw, (max-width: 900px) 55vw, 32vw'
                      : '(max-width: 680px) 132px, 168px'
                  }
                  rank={shelf.key === 'trending' ? cardIdx + 1 : undefined}
                  featured={isBento && cardIdx === 0}
                />
              );
            })
          )}
        </div>
      </m.section>
    );
  };

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="relative pt-nav-catalog">
        {/* --- FEATURED HERO --- */}
        <section className="relative w-full">
          <AnimatePresence mode="wait">
            {showHeroSkeleton ? (
              <m.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hero"
              >
                <div className="wrap hero__in">
                  <div className="hero__content w-full max-w-[560px]">
                    <div className="sk sk-line" style={{ width: 120 }} />
                    <div className="sk mt-4 h-12 w-full max-w-md rounded-md" />
                    <div className="sk sk-line mt-4 w-3/4" />
                    <div className="sk sk-line mt-2 w-2/3" />
                    <div className="sk mt-6 h-12 w-44 rounded-btn" />
                  </div>
                </div>
              </m.div>
            ) : featuredComic ? (
              <m.div
                key="home-hero"
                // Paint the hero (the mobile LCP element) immediately. Fading the whole hero
                // container from opacity:0 kept the largest element invisible until framer
                // hydrated, delaying LCP; the inner carousel still crossfades between slides.
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.36, ease: [0.22, 0.61, 0.36, 1] }}
                className="group/hero"
                onPointerEnter={() => {
                  heroCarouselPausedRef.current = true;
                }}
                onPointerLeave={() => {
                  heroCarouselPausedRef.current = false;
                }}
              >
                <section className="hero" aria-roledescription="carousel">
                  {/* sync (default) crossfades slides over each other; mode="wait" faded the old
                      slide fully out first, leaving a black hole between every hero slide. */}
                  <AnimatePresence initial={false}>
                    <m.div
                      key={heroFeaturedKey}
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.36,
                        ease: [0.22, 0.61, 0.36, 1],
                      }}
                      className="absolute inset-0"
                    >
                      <div
                        className={`hero__bg ${heroAdultContent ? 'is-adult' : ''}`}
                      >
                        <SafeCoverImage
                          src={featuredBackgroundSrc}
                          alt={heroAgeBlocked ? 'Restricted featured title' : `${featuredComic.title} — featured background`}
                          priority
                          quality={72}
                          sizes="100vw"
                          className="object-cover"
                        />
                      </div>

                      <div className="wrap hero__in">
                        <div className="hero__content">
                          <span className="ic-eyebrow !text-white/70">
                            {shelfCopy.featuredSeries} · {featuredComic.source}
                          </span>
                          <h2 className="hero__title">
                            {heroAgeBlocked ? 'Age restricted' : featuredComic.title}
                          </h2>
                          {featuredComic.description && !heroAgeBlocked ? (
                            <p className="hero__blurb">{featuredComic.description}</p>
                          ) : null}
                          <div className="hero__meta">
                            {heroRating?.showBlock ? (
                              <>
                                <span className="ic-eyebrow !text-white/60">{heroRating.label}</span>
                                <span className="font-mono text-xs font-semibold text-white">
                                  {heroRating.value}
                                </span>
                              </>
                            ) : null}
                          </div>
                          <div className="hero__cta">
                            <Link
                              href={resolveComicHref(featuredComic)}
                              className="ic-btn ic-btn--primary ic-btn--lg"
                            >
                              <BookOpen size={18} aria-hidden />
                              {shelfCopy.readFeaturedCta}
                            </Link>
                            <Link
                              href="/library"
                              className="ic-btn ic-btn--lg border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                            >
                              {shelfCopy.cta}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </m.div>
                  </AnimatePresence>

                  {heroCarouselSlides.length > 1 ? (
                    <div className="hero__dots">
                      <div className="hero__navbtns">
                        <button
                          type="button"
                          aria-label="Previous featured title"
                          className="ic-iconbtn ic-iconbtn--md ic-iconbtn--ghost-scrim"
                          onClick={() => goToHeroSlide(-1)}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label="Next featured title"
                          className="ic-iconbtn ic-iconbtn--md ic-iconbtn--ghost-scrim"
                          onClick={() => goToHeroSlide(1)}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                      {heroCarouselSlides.map((_, i) => (
                        <button
                          key={`hero-dot-${heroDeckKey}-${i}`}
                          type="button"
                          aria-label={`Featured slide ${i + 1}`}
                          aria-current={i === heroSlideIndex}
                          className={`dot ${i === heroSlideIndex ? 'is-active' : ''}`}
                          onClick={() => setHeroSlideIndex(i)}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              </m.div>
            ) : (
              <m.div
                key="home-hero-fallback"
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.36, ease: [0.22, 0.61, 0.36, 1] }}
                className="wrap"
              >
                <div className="mt-8 rounded-sheet border border-line bg-surface px-8 py-12 sm:px-10 sm:py-14">
                  <h2 className="ic-display max-w-3xl text-[clamp(2rem,5vw,3rem)] text-fg">
                    {shelfCopy.pageH1}
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-fg-secondary">
                    {shelfCopy.desc}
                  </p>
                  <Link href="/library" className="ic-btn ic-btn--primary ic-btn--lg mt-8">
                    {shelfCopy.cta}
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </section>

        <div className="wrap pb-20 sm:pb-24">
          {/* --- CONTINUE READING --- */}
          {continueItems.length > 0 && !shelfSearchNorm ? (
            <section className="section !mt-10 sm:!mt-14">
              <div className="section__head">
                <div className="section__titles">
                  <span className="ic-eyebrow">Pick up where you left off</span>
                  <h2 className="section__heading">Continue reading</h2>
                </div>
                <Link href="/library" className="seeall">
                  Your library <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
              <div className="continue">
                {continueItems.map((item) => (
                  <Link
                    key={`${item.source}:${item.id}`}
                    href={`/library/${item.source}/${item.id}`}
                    className="cont-card"
                  >
                    <span className="cont-card__thumb">
                      <SafeCoverImage
                        src={item.coverUrl}
                        alt={`${item.title} — cover`}
                        sizes="56px"
                        quality={60}
                        className="object-cover"
                      />
                    </span>
                    <span className="cont-card__body">
                      <span className="cont-card__title">{item.title}</span>
                      {typeof item.progressPercent === 'number' ? (
                        <>
                          <span className="cont-card__ch">{Math.round(item.progressPercent)}%</span>
                          <span className="ic-progress">
                            <span
                              className="ic-progress__fill block"
                              style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                            />
                          </span>
                        </>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* --- QUICK SEARCH --- */}
          <section className="section !mt-10 sm:!mt-14">
            <div className="searchband">
              <span className="ic-eyebrow">{shelfCopy.searchEyebrow}</span>
              <h2 className="section__heading mb-5 mt-2">{shelfCopy.searchHeading}</h2>
              <HomeQuickSearch
                mangaLanguage={mangaLanguage}
                isAgeVerified={isAgeVerified}
                onDebouncedShelfFilter={setHomeShelfSearch}
              />
            </div>
          </section>

          {renderedShelves.every((s) =>
            shelfState[s.key]?.items.filter(
              (c) =>
                c.title.toLowerCase().includes(shelfSearchNorm) ||
                c.description.toLowerCase().includes(shelfSearchNorm),
            ).length === 0,
          ) &&
            shelfSearchNorm && (
              <section className="section">
                <div className="state-block">
                  <Search size={28} strokeWidth={1.5} aria-hidden />
                  <h4>{shelfCopy.shelfNoMatchesTitle}</h4>
                  <p>{shelfCopy.shelfNoMatchesBody}</p>
                </div>
              </section>
            )}

          {/* --- SHELF LOAD FAILURE (one calm block instead of a wall of empty rows) --- */}
          {showShelfLoadError && !shelfSearchNorm ? (
            <section className="section">
              <div className="state-block">
                <BookOpen size={28} strokeWidth={1.5} aria-hidden />
                <h4>{shelfCopy.shelvesErrorTitle}</h4>
                <p>{shelfCopy.shelvesErrorBody}</p>
                <button
                  type="button"
                  className="ic-btn"
                  onClick={() => void fetchShelves(mangaLanguage)}
                >
                  {shelfCopy.shelvesErrorRetry}
                </button>
              </div>
            </section>
          ) : null}

          {/* --- SHELVES (horizontal-scroll rows) --- */}
          <AnimatePresence>
            {rowShelves.map((shelf) => renderShelfSection(shelf, 'row'))}
          </AnimatePresence>

          {/* --- SPOTLIGHT (bento: one shelf gets a lead card + a curated handful) --- */}
          <AnimatePresence>
            {spotlightShelf ? renderShelfSection(spotlightShelf, 'bento') : null}
          </AnimatePresence>

          {/* --- INFINITE DISCOVERY GRID --- */}
          <section className="section !mt-24 sm:!mt-32">
            <div className="section__head">
              <div className="section__titles">
                <span className="ic-eyebrow">Discover</span>
                <h2 className="section__heading">More titles</h2>
              </div>
            </div>
            <p className="-mt-2 mb-5 text-sm text-fg-muted">
              Scroll to load more — picks refresh as you explore.
            </p>

            <div className="mtgrid !gap-6 sm:!gap-8">
              {infiniteItems.map((comic, idx) => {
                const cardKey = `discover:${comic.source}:${comic.id}`;
                const adultContent = isAdultComic(comic);
                const isPreviewOpen = adultContent && previewCardKey === cardKey;
                const coverUi = homeAdultCoverUi(comic, isAgeVerified, useRichMotion, isPreviewOpen);

                return (
                  <HomeCoverCard
                    key={`${comicKey(comic)}:${idx}`}
                    comic={comic}
                    coverUi={coverUi}
                    isTouchDevice={isTouchDevice}
                    isPreviewOpen={isPreviewOpen}
                    // Locked (unverified) → open the age gate; verified adult → tap-to-peek.
                    onLockedTap={
                      coverUi.maskText
                        ? () => setShowAgeGate(true)
                        : () => setPreviewCardKey(cardKey)
                    }
                    sizes="(max-width: 680px) 45vw, (max-width: 1024px) 25vw, 180px"
                  />
                );
              })}
            </div>

            <div ref={loaderRef} className="mt-loadwrap flex-col items-center gap-3 py-12">
              {hasMoreInfinite ? (
                <>
                  <span
                    className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent"
                    style={prefersReducedMotion ? { animation: 'none' } : undefined}
                    aria-hidden
                  />
                  <span className="ic-eyebrow">Loading more…</span>
                </>
              ) : (
                <div className="mt-end w-full">You&apos;re all caught up</div>
              )}
            </div>
          </section>
        </div>
      </main>

      <AnimatePresence>
        {showAgeGate && (
          <AgeGateOverlay
            title={libraryCopy.restricted}
            description={homeAgeDescription}
            confirmLabel={libraryCopy.verifyBtn}
            cancelLabel={libraryCopy.cancelBtn}
            confirmAction={handleVerify}
            cancelAction={() => setShowAgeGate(false)}
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
    </LazyMotion>
  );
}
