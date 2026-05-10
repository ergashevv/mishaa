'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Clock,
  Search,
  Flame,
  TrendingUp,
  LayoutGrid,
  Star,
  Heart,
  Zap,
  BookOpen,
  Theater,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
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
  icon: React.ReactNode;
}

const DEFAULT_IMAGE_SRC = '/logo.png';

function resolveImageSrc(src?: string | null) {
  return typeof src === 'string' && src.trim().length > 0 ? src : DEFAULT_IMAGE_SRC;
}

function resolveComicHref(comic: LibraryComic) {
  return comic.href || `/library/${comic.source}/${comic.id}`;
}

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
  className?: string;
};

function SafeCoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: SafeCoverImageProps) {
  const [currentSrc, setCurrentSrc] = useState(() => resolveImageSrc(src));

  useEffect(() => {
    setCurrentSrc(resolveImageSrc(src));
  }, [src]);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized
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
  {
    key: 'romance',
    title: 'Romance',
    subtitle: 'Reader picks',
    icon: <Heart className="text-rose-400" size={18} />,
  },
  {
    key: 'fantasy',
    title: 'Fantasy',
    subtitle: 'Adventure reads',
    icon: <BookOpen className="text-emerald-400" size={18} />,
  },
  {
    key: 'drama',
    title: 'Drama',
    subtitle: 'Emotional storytelling',
    icon: <Theater className="text-indigo-400" size={18} />,
  },
  {
    key: 'trending',
    title: 'Trending',
    subtitle: 'Popular now',
    icon: <Flame className="text-orange-500" size={18} />,
  },
  {
    key: 'for-you',
    title: 'For You',
    subtitle: 'From your library',
    icon: <Star className="text-[#ffca3a]" size={18} />,
  },
  {
    key: 'manga-hub',
    title: 'Manga',
    subtitle: 'Japanese comics',
    icon: <LayoutGrid className="text-pink-500" size={18} />,
  },
  {
    key: 'new',
    title: 'New',
    subtitle: 'Recently added',
    icon: <Clock className="text-green-500" size={18} />,
  },
  {
    key: 'manhwa',
    title: 'Manhwa',
    subtitle: 'Korean comics',
    icon: <TrendingUp className="text-cyan-500" size={18} />,
  },
  {
    key: 'webtoons',
    title: 'Webtoons',
    subtitle: 'Vertical reads',
    icon: <Clock className="text-amber-500" size={18} />,
  },
  {
    key: 'doujinshi',
    title: 'Doujinshi',
    subtitle: 'Fan comics',
    icon: <Star className="text-yellow-500" size={18} />,
  },
  {
    key: 'milf',
    title: 'Mature',
    subtitle: '18+ titles',
    icon: <Heart className="text-red-500" size={18} />,
  },
  {
    key: 'ntr',
    title: 'NTR',
    subtitle: 'Drama-focused',
    icon: <Zap className="text-purple-500" size={18} />,
  },
];

import AgeGateOverlay from './AgeGateOverlay';
import { isAdultComic } from '@/lib/age-verification';

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

  // Infinite Scroll State
  const [infiniteItems, setInfiniteItems] = useState<LibraryComic[]>([]);
  const [infinitePage, setInfinitePage] = useState(0);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [hasMoreInfinite, setHasMoreInfinite] = useState(true);
  const [loaderInView, setLoaderInView] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const autoCarouselRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const carouselPausedRef = useRef(false);
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
    const raw = readStorageItem(MANGA_LANGUAGE_STORAGE_KEY);
    if (
      raw &&
      MANGA_LANGUAGE_OPTIONS.some((option) => option.value === raw) &&
      raw !== initialMangaLanguage
    ) {
      setMangaLanguage(raw as MangaLanguage);
    }
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
      }
    } catch (error) {
      console.error('Home data error:', error);
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

  const featuredBackgroundSrc = featuredComic?.bannerUrl || featuredComic?.coverUrl || DEFAULT_IMAGE_SRC;
  const featuredPosterSrc = featuredComic?.coverUrl || featuredComic?.bannerUrl || DEFAULT_IMAGE_SRC;
  const renderedShelves = activeTab === 'all'
    ? visibleShelves
    : visibleShelves.filter((shelf) => shelf.key === activeTab);
  const shelfSearchNorm = homeShelfSearch.trim().toLowerCase();
  const shelfCardLimit = isTouchDevice ? 8 : 12;

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

  useEffect(() => {
    if (!useRichMotion) return;

    const interval = window.setInterval(() => {
      if (carouselPausedRef.current) return;

      Object.values(autoCarouselRefs.current).forEach((node) => {
        if (!node || node.scrollWidth <= node.clientWidth) return;
        const nextLeft = node.scrollLeft + Math.max(180, node.clientWidth * 0.55);
        node.scrollTo({
          left: nextLeft >= node.scrollWidth - node.clientWidth - 8 ? 0 : nextLeft,
          behavior: 'smooth',
        });
      });
    }, 6200);

    return () => window.clearInterval(interval);
  }, [useRichMotion, renderedShelves.length]);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-[#06070b] dark:text-neutral-100">
      <Navbar />

      <main className="relative overflow-hidden bg-white pt-nav-catalog dark:bg-[#06070b]">
        {/* --- DYNAMIC HERO BANNER --- */}
        <section className="relative w-full">
          <AnimatePresence mode="wait">
            {showHeroSkeleton ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full"
              >
                <div className="bg-gradient-to-b from-neutral-100 via-white to-white pb-12 pt-4 dark:from-neutral-950 dark:via-neutral-950 dark:to-[#06070b]">
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-8 border border-neutral-200 bg-neutral-50 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:p-10 dark:border-white/10 dark:bg-black/40">
                      <div className="space-y-5">
                        <div className="h-6 w-36 animate-pulse bg-neutral-200 dark:bg-white/10" />
                        <div className="h-14 w-full max-w-md animate-pulse bg-neutral-200 dark:bg-white/10" />
                        <div className="h-10 w-3/4 max-w-sm animate-pulse bg-neutral-200 dark:bg-white/10" />
                        <div className="h-11 w-44 animate-pulse bg-[#ff5a1f]/40" />
                      </div>
                      <div className="aspect-[3/4] max-h-[22rem] animate-pulse bg-neutral-200 lg:max-h-none lg:justify-self-end lg:w-full lg:max-w-sm dark:bg-white/10" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : featuredComic ? (
              <motion.div
                key="home-hero"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full"
                onPointerEnter={() => {
                  heroCarouselPausedRef.current = true;
                }}
                onPointerLeave={() => {
                  heroCarouselPausedRef.current = false;
                }}
              >
                <div className="bg-gradient-to-b from-neutral-100 via-white to-white pb-10 dark:from-neutral-950 dark:via-neutral-950 dark:to-[#06070b]">
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="relative min-h-[clamp(20rem,48vw,30rem)] overflow-hidden border border-neutral-200 bg-neutral-50 lg:min-h-[26rem] dark:border-white/10 dark:bg-black">
                    <AnimatePresence initial={false} mode="wait">
                      <motion.div
                        key={heroFeaturedKey}
                        initial={
                          prefersReducedMotion ? false : { opacity: 0 }
                        }
                        animate={{ opacity: 1 }}
                        exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.38,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="relative min-h-[clamp(20rem,48vw,30rem)] lg:min-h-[26rem]"
                      >
                        <div className="pointer-events-none absolute inset-0 z-0">
                          {!isTouchDevice ? (
                            <>
                              <SafeCoverImage
                                src={featuredBackgroundSrc}
                                alt={`${featuredComic.title} — featured series background`}
                                priority
                                sizes="100vw"
                                className="object-cover object-center opacity-[0.35]"
                              />
                              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/70 dark:from-black dark:via-black/88 dark:to-black/55" />
                            </>
                          ) : (
                            <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-950" />
                          )}
                        </div>

                        <div className="relative z-10 grid gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-12 lg:py-12">
                      <div className="relative z-20 max-w-2xl lg:py-8">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-500 dark:text-white/55">
                          {featuredComic.source}
                        </p>

                        <h1 className="mt-4 min-h-[2.4em] text-4xl font-bold uppercase leading-[1.05] tracking-tight text-neutral-900 sm:min-h-[2.2em] sm:text-5xl xl:text-6xl dark:text-white">
                          {featuredComic.title}
                        </h1>

                        {heroRating?.showBlock ? (
                          <div className="mt-6 flex min-h-[2.25rem] flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-white/45">
                              {heroRating.label}
                            </span>
                            <span className="text-lg font-semibold uppercase tracking-wide text-neutral-900 dark:text-white">
                              {heroRating.value}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-6 min-h-[2.25rem]" aria-hidden />
                        )}

                        <Link
                          href={resolveComicHref(featuredComic)}
                          className="group mt-9 inline-block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5a1f]"
                        >
                          <span className="inline-flex -skew-x-6 bg-[#ff5a1f] px-8 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg transition-transform group-hover:-translate-y-0.5 group-active:translate-y-0">
                            <span className="skew-x-6">Read now</span>
                          </span>
                        </Link>
                      </div>

                      <div className="relative z-20 mx-auto w-full max-w-[14rem] sm:max-w-[17rem] lg:mx-0 lg:ml-auto lg:max-w-[18rem]">
                        <div className="relative aspect-[2/3] overflow-hidden border border-neutral-200 bg-neutral-100 shadow-lg shadow-neutral-900/10 dark:border-white/15 dark:bg-neutral-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
                          <SafeCoverImage
                            key={featuredPosterSrc}
                            src={featuredPosterSrc}
                            alt={featuredComic.title}
                            priority
                            sizes="(max-width: 1024px) 55vw, 320px"
                            className="object-cover object-center"
                          />
                          {heroRating?.badge ? (
                            <div className="absolute right-3 top-3 border border-neutral-200 bg-white/90 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-800 dark:border-white/20 dark:bg-black/70 dark:text-white/85">
                              {heroRating.badge}
                            </div>
                          ) : null}
                        </div>
                      </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {heroCarouselSlides.length > 1 ? (
                    <div className="mt-6 flex justify-center gap-2">
                      {heroCarouselSlides.map((_, i) => (
                        <button
                          key={`hero-dot-${heroDeckKey}-${i}`}
                          type="button"
                          aria-label={`Featured slide ${i + 1}`}
                          aria-current={i === heroSlideIndex}
                          className={`h-2 w-2 rounded-full transition-colors ${
                            i === heroSlideIndex ? 'bg-[#ff5a1f]' : 'bg-neutral-300 hover:bg-neutral-400 dark:bg-white/25 dark:hover:bg-white/40'
                          }`}
                          onClick={() => setHeroSlideIndex(i)}
                        />
                      ))}
                    </div>
                  ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
        {/* Shelves Layout */}
        <section className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24 lg:pb-28">
          <div className="space-y-16 sm:space-y-20 pt-10 sm:pt-12">
            <HomeQuickSearch
              mangaLanguage={mangaLanguage}
              isAgeVerified={isAgeVerified}
              onDebouncedShelfFilter={setHomeShelfSearch}
            />
            {renderedShelves.every((s) =>
              shelfState[s.key]?.items.filter(
                (c) =>
                  c.title.toLowerCase().includes(shelfSearchNorm) ||
                  c.description.toLowerCase().includes(shelfSearchNorm),
              ).length === 0,
            ) &&
              shelfSearchNorm && (
                <div className="py-20 text-center">
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center border border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
                    <Search size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="mb-2 text-xl font-bold uppercase tracking-tight text-neutral-900 dark:text-white">
                    {shelfCopy.shelfNoMatchesTitle}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{shelfCopy.shelfNoMatchesBody}</p>
                </div>
              )}

            <AnimatePresence>
              {renderedShelves.map((shelf) => {
                const state = shelf.key === 'for-you' ? { items: personalRecs, loading: isRecsLoading } : shelfState[shelf.key];
                if (!state) return null;

                const filteredItems = rankComicsForHome(
                  state.items.filter(
                    (comic) =>
                      comic.title.toLowerCase().includes(shelfSearchNorm) ||
                      comic.description.toLowerCase().includes(shelfSearchNorm),
                  ),
                  {
                    profile: preferenceProfile,
                    ageVerified: isAgeVerified,
                    shelfKey: shelf.key,
                  }
                );

                if (shelf.key === 'for-you' && filteredItems.length === 0 && !isRecsLoading) return null;
                if (shelfSearchNorm && filteredItems.length === 0) return null;

                return (
                  <motion.div
                    key={shelf.key}
                    id={shelf.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-5"
                  >
                    <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-white/10">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">
                          {shelf.subtitle}
                        </p>
                        <h2 className="mt-1 text-xl font-bold uppercase tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
                          {shelf.title}
                        </h2>
                      </div>
                      <Link
                        href={`/library?tab=${encodeURIComponent(shelf.title)}`}
                        className="group flex shrink-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#ff5a1f]"
                      >
                        See all
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>

                    <div
                      ref={(node) => {
                        autoCarouselRefs.current[shelf.key] = node;
                      }}
                      onPointerEnter={() => {
                        carouselPausedRef.current = true;
                      }}
                      onPointerLeave={() => {
                        carouselPausedRef.current = false;
                      }}
                      onTouchStart={() => {
                        carouselPausedRef.current = true;
                      }}
                      onTouchEnd={() => {
                        window.setTimeout(() => {
                          carouselPausedRef.current = false;
                        }, 1200);
                      }}
                      className="-mx-4 flex snap-x snap-mandatory touch-pan-x gap-x-4 gap-y-8 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:gap-x-5 lg:px-8 [&::-webkit-scrollbar]:hidden"
                    >
                      {state.loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex w-[38vw] max-w-[10.5rem] shrink-0 snap-start flex-col gap-3 sm:w-[10.5rem] lg:w-[11rem]"
                          >
                            <div className="aspect-[2/3] animate-pulse bg-neutral-200 dark:bg-white/10" />
                            <div className="h-3 w-4/5 animate-pulse bg-neutral-200 dark:bg-white/10" />
                            <div className="h-3 w-3/5 animate-pulse bg-neutral-100 dark:bg-white/5" />
                          </div>
                        ))
                      ) : (
                        filteredItems.slice(0, shelfCardLimit).map((comic) => {
                          const cardKey = `${shelf.key}:${comic.source}:${comic.id}`;
                          const adultContent = isAdultComic(comic);
                          const isPreviewOpen = adultContent && previewCardKey === cardKey;
                          const shouldBlur = adultContent && !isAgeVerified;

                          return (
                            <motion.article
                              key={`${shelf.key}:${comicKey(comic)}`}
                              initial={false}
                              whileHover={useRichMotion ? { y: -4 } : undefined}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="group relative w-[38vw] max-w-[10.5rem] shrink-0 snap-start snap-always cursor-pointer sm:w-[10.5rem] lg:w-[11rem]"
                            >
                              <Link
                                href={resolveComicHref(comic)}
                                onClickCapture={(event) => {
                                  if (!isTouchDevice || !adultContent) return;
                                  if (!isPreviewOpen) {
                                    event.preventDefault();
                                    setPreviewCardKey(cardKey);
                                  }
                                }}
                              >
                                <div className="flex flex-col">
                                  <div
                                    className={`relative aspect-[2/3] w-full overflow-hidden border border-neutral-200 bg-neutral-50 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20 ${
                                      useRichMotion ? 'group-hover:border-neutral-400 group-hover:shadow-md dark:group-hover:border-white/25 dark:group-hover:shadow-black/30' : ''
                                    }`}
                                  >
                                    <SafeCoverImage
                                      key={`${shelf.key}:${comicKey(comic)}`}
                                      src={comic.coverUrl}
                                      alt={shouldBlur ? 'Restricted' : comic.title}
                                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
                                      className={`object-cover object-center transition-transform duration-500 ${
                                        shouldBlur ? 'scale-105 blur-md' : 'scale-100'
                                      } ${useRichMotion && !shouldBlur ? 'group-hover:scale-[1.03]' : ''}`}
                                    />

                                    {shouldBlur ? (
                                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-950/25 backdrop-blur-[2px]">
                                        <Zap size={20} className="mb-2 text-[#ff5a1f]" />
                                        <span className="border border-white/40 bg-black/70 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white">
                                          Restricted
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 min-h-[3.75rem] space-y-1">
                                    <h4 className="line-clamp-3 text-[11px] font-bold uppercase leading-snug tracking-tight text-neutral-900 dark:text-white">
                                      {shouldBlur ? 'Age restricted' : comic.title}
                                    </h4>
                                    <p className="line-clamp-2 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                                      {shouldBlur
                                        ? isTouchDevice && !isPreviewOpen
                                          ? 'Tap to confirm age'
                                          : 'Verify age to view details'
                                        : [comic.meta, comic.rating].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            </motion.article>

                          );
                        })
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        <section className="border-t border-neutral-200 bg-neutral-100 py-16 sm:py-20 dark:border-white/10 dark:bg-black/25">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-10 border-b border-neutral-200 pb-5 dark:border-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">
                  Discover
                </p>
                <h2 className="mt-1 text-xl font-bold uppercase tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
                  More titles
                </h2>
                <p className="mt-2 max-w-lg text-sm text-neutral-600 dark:text-neutral-400">
                  Scroll to load more — picks refresh as you explore.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4 lg:grid-cols-6">
                {infiniteItems.map((comic, idx) => {
                  const cardKey = `discover:${comic.source}:${comic.id}`;
                  const adultContent = isAdultComic(comic);
                  const isPreviewOpen = adultContent && previewCardKey === cardKey;
                  const shouldBlur = adultContent && !isAgeVerified;

                  return (
                    <motion.div
                      key={`${comicKey(comic)}:${idx}`}
                      initial={useRichMotion ? { opacity: 0, scale: 0.97 } : false}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{
                        delay: useRichMotion ? (idx % 6) * 0.04 : 0,
                        duration: useRichMotion ? 0.45 : 0.15,
                        ease: useRichMotion ? [0.22, 1, 0.36, 1] : 'linear',
                      }}
                    >
                      <Link
                        href={comic.href || `/library/${comic.source}/${comic.id}`}
                        className="group block"
                        onClickCapture={(event) => {
                          if (!isTouchDevice || !adultContent) return;
                          if (!isPreviewOpen) {
                            event.preventDefault();
                            setPreviewCardKey(cardKey);
                          }
                        }}
                      >
                        <div className="flex flex-col">
                          <div
                            className={`relative aspect-[2/3] w-full overflow-hidden border border-neutral-200 bg-white shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20 ${
                              useRichMotion ? 'group-hover:border-neutral-400 group-hover:shadow-md dark:group-hover:border-white/25 dark:group-hover:shadow-black/30' : ''
                            }`}
                          >
                            <SafeCoverImage
                              key={comic.coverUrl || '/logo.png'}
                              src={comic.coverUrl || '/logo.png'}
                              alt={shouldBlur ? 'Restricted' : comic.title}
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                              className={`object-cover transition-transform duration-500 ${
                                shouldBlur ? 'scale-105 blur-md' : 'scale-100'
                              } ${useRichMotion && !shouldBlur ? 'group-hover:scale-[1.03]' : ''}`}
                            />

                            {shouldBlur ? (
                              <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/25 backdrop-blur-[2px]">
                                <span className="border border-white/40 bg-black/70 px-2.5 py-1 text-[7px] font-bold uppercase tracking-[0.2em] text-white">
                                  Restricted
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-3 min-h-[3.5rem] space-y-1">
                            <div className="line-clamp-3 text-[11px] font-bold uppercase leading-snug tracking-tight text-neutral-900 dark:text-white">
                              {shouldBlur ? 'Age restricted' : comic.title}
                            </div>
                            <div className="line-clamp-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                              {shouldBlur
                                ? isTouchDevice && !isPreviewOpen
                                  ? 'Tap to confirm age'
                                  : 'Verify age to view details'
                                : [comic.meta, comic.rating].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>

                  );
                })}
              </div>

              <div ref={loaderRef} className="flex flex-col items-center justify-center gap-5 py-16">
                {hasMoreInfinite ? (
                  <>
                    <div className="relative h-12 w-12">
                      {useRichMotion ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#ff5a1f]"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="absolute inset-4 rounded-full bg-[#ff5a1f]/15"
                          />
                        </>
                      ) : prefersReducedMotion ? (
                        <div className="absolute inset-0 rounded-full border-2 border-[#ff5a1f]/35" />
                      ) : (
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-neutral-300 border-t-[#ff5a1f] dark:border-white/15" style={{ animationDuration: '1.2s' }} />
                      )}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-500 dark:text-neutral-400">
                      Loading more
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#ff5a1f]">
                    You&apos;re all caught up
                  </div>
                )}
              </div>
            </div>
        </section>

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

      <footer className="border-t border-neutral-200 bg-neutral-100 text-neutral-900 dark:border-white/10 dark:bg-black dark:text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
            <div>
              <div className="font-accent text-xl tracking-wide">
                <span className="text-neutral-900 dark:text-white">iComics</span>
                <span className="mx-px text-[#ffd36b]">·</span>
                <span className="text-[#ff5a1f]">wiki</span>
              </div>
              <p className="mt-2 max-w-xs text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-600 dark:text-neutral-500">
                Manga, manhwa & comics
              </p>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-400">
              <Link href="/guides" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                Guides
              </Link>
              <Link href="/reading" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                Reading hub
              </Link>
              <Link href="/faq" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                FAQ
              </Link>
              <Link href="/library" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                Library
              </Link>
              <Link href="/gallery" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                Gallery
              </Link>
              <Link href="/about" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                About
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-[#ff5a1f] dark:hover:text-white">
                Terms
              </Link>
            </nav>
          </div>
          <div className="mt-12 border-t border-neutral-200 pt-8 text-center text-[10px] font-medium uppercase tracking-[0.35em] text-neutral-500 dark:border-white/10 dark:text-neutral-600">
            © {new Date().getFullYear()} iComics.wiki
          </div>
        </div>
      </footer>
    </div>
  );
}
