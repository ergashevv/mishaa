'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  MangaLanguage,
  readStoredMangaLanguage,
} from '@/lib/manga-language';
import { readAgeVerification, persistAgeVerification } from '@/lib/age-verification';
import {
  LIBRARY_ACTIVITY_EVENT,
  BOOKMARKS_UPDATED_EVENT,
  readBookmarks,
  readReadingHistory,
} from '@/lib/library-storage';
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

// --- Types ---
type ComicSource = 'mangadex' | 'marvel' | 'nhentai';
type ShelfKey = 'all' | 'featured' | 'romance' | 'fantasy' | 'manga-hub' | 'webtoons' | 'manhwa' | 'marvel' | 'trending' | 'for-you' | 'new' | 'doujinshi' | 'milf' | 'ntr';

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

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
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
];

import JsonLd from '@/components/JsonLd';
import AgeGateOverlay from './AgeGateOverlay';
import { isAdultComic } from '@/lib/age-verification';

type HomeClientProps = {
  initialData?: Record<string, LibraryComic[]>;
  initialAgeVerified?: boolean;
  initialIsTouchDevice?: boolean;
};

export default function HomeClient({
  initialData,
  initialAgeVerified = false,
  initialIsTouchDevice = false,
}: HomeClientProps) {
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(() => Boolean(initialIsTouchDevice));
  const [previewCardKey, setPreviewCardKey] = useState<string | null>(null);
  const [preferenceProfile, setPreferenceProfile] = useState<HomePreferenceProfile>(() => createDefaultHomeProfile('initial'));
  const hasCompleteInitialData = SHELVES
    .filter((shelf) => shelf.key !== 'for-you' && !['doujinshi', 'milf', 'ntr', 'marvel'].includes(shelf.key))
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
  const searchQuery = '';
  const [activeTab] = useState<ShelfKey>('all');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>('en');
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
  const seenHomeKeysRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const saved = readStoredMangaLanguage();
    const t = setTimeout(() => setMangaLanguage(prev => (saved !== prev ? saved : prev)), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const verified = readAgeVerification() || initialAgeVerified;
    const timer = window.setTimeout(() => {
      setIsAgeVerified(verified);
      if (verified) persistAgeVerification();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialAgeVerified]);

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

  useEffect(() => {
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
          'manga-hub': { items: data.shelves['manga-hub'] || [], loading: false },
          'new': { items: data.shelves['new'] || [], loading: false },
          webtoons: { items: data.shelves['webtoons'] || [], loading: false },
          manhwa: { items: data.shelves['manhwa'] || [], loading: false },
          marvel: { items: data.shelves['marvel'] || [], loading: false },
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

  const featuredComic = useMemo(() => {
    const pool = activeTab === 'all'
      ? (personalRecs.length > 0 ? personalRecs : shelfState.trending?.items || [])
      : (activeTab === 'for-you' ? personalRecs : (shelfState[activeTab]?.items || []));
    if (!pool.length) return null;
    return rankComicsForHome(pool, {
      profile: preferenceProfile,
      ageVerified: isAgeVerified,
      shelfKey: activeTab,
      adultPenalty: -16,
    })[0] || null;
  }, [activeTab, isAgeVerified, preferenceProfile, shelfState, personalRecs]);

  const featuredBackgroundSrc = featuredComic?.bannerUrl || featuredComic?.coverUrl || DEFAULT_IMAGE_SRC;
  const featuredPosterSrc = featuredComic?.coverUrl || featuredComic?.bannerUrl || DEFAULT_IMAGE_SRC;
  const renderedShelves = activeTab === 'all'
    ? visibleShelves
    : visibleShelves.filter((shelf) => shelf.key === activeTab);
  const shelfCardLimit = isTouchDevice ? 8 : 12;

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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
    }, 4800);

    return () => window.clearInterval(interval);
  }, [renderedShelves.length, isTouchDevice]);

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "iComics.wiki Studio",
    "url": "https://icomics.wiki",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://icomics.wiki/library?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "iComics.wiki Studio",
    "url": "https://icomics.wiki",
    "logo": "https://icomics.wiki/logo.png",
    "sameAs": [
      "https://twitter.com/icomics_studio",
      "https://t.me/icomics_studio"
    ]
  };

  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      <JsonLd data={websiteSchema} />
      <JsonLd data={orgSchema} />
      <Navbar />

      <main className="relative overflow-hidden pt-24 sm:pt-28 lg:pt-32">
        {/* --- DYNAMIC HERO BANNER --- */}
        <section className="relative w-full">
          <AnimatePresence mode="wait">
            {!featuredComic && (shelfState[activeTab]?.loading || isRecsLoading) ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full"
              >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 pb-16">
                  <div className="grid gap-6 rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-5 shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:p-8">
                    <div className="space-y-6">
                      <div className="h-9 w-48 rounded-full bg-white/5 animate-pulse" />
                      <div className="h-24 w-full rounded-[2rem] bg-white/5 animate-pulse" />
                      <div className="h-20 w-4/5 rounded-[2rem] bg-white/5 animate-pulse" />
                      <div className="flex flex-wrap gap-3">
                        <div className="h-12 w-40 rounded-full bg-white/5 animate-pulse" />
                        <div className="h-12 w-40 rounded-full bg-white/5 animate-pulse" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="h-24 rounded-[1.5rem] bg-white/5 animate-pulse" />
                        <div className="h-24 rounded-[1.5rem] bg-white/5 animate-pulse" />
                        <div className="h-24 rounded-[1.5rem] bg-white/5 animate-pulse" />
                      </div>
                    </div>
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] animate-pulse" />
                  </div>
                </div>
              </motion.div>
            ) : featuredComic ? (
              <motion.div
                key={featuredComic.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full"
              >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-14 lg:pb-18">
                  <div className="relative overflow-hidden bg-black shadow-[0_50px_140px_rgba(0,0,0,0.72)]">
                    <div className="absolute inset-0">
                      {!isTouchDevice && (
                        <>
                          <SafeCoverImage
                            key={featuredBackgroundSrc}
                            src={featuredBackgroundSrc}
                            alt={featuredComic.title}
                            priority
                            sizes="100vw"
                            className="object-cover object-center scale-105 opacity-[0.2] blur-[2px]"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,10,0.96)_0%,rgba(5,6,10,0.9)_42%,rgba(5,6,10,0.54)_100%)]" />
                        </>
                      )}
                      {isTouchDevice && (
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.98)_0%,rgba(5,6,10,0.92)_100%)]" />
                      )}
                    </div>

                    <div className="relative grid gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14 lg:px-12 lg:py-12">
                      <div className="relative z-20 max-w-3xl lg:py-12">
                        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/42">
                          {featuredComic.source}
                        </p>

                        <h1 className="mt-6 text-display text-5xl leading-[0.9] text-white sm:text-6xl xl:text-[5.9rem]">
                          {featuredComic.title}
                        </h1>

                        <div className="mt-8 flex items-baseline gap-4">
                          <span className="text-[9px] font-black uppercase tracking-[0.55em] text-white/32">
                            Rating
                          </span>
                          <span className="text-2xl font-black uppercase tracking-[0.18em] text-white">
                            {featuredComic.rating || '8.5'}
                          </span>
                        </div>

                        <Link
                          href={resolveComicHref(featuredComic)}
                          className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-[10px] font-black uppercase tracking-[0.4em] text-black transition-transform hover:scale-[1.02] active:scale-95"
                        >
                          Read
                        </Link>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.06, duration: 0.75 }}
                        className="relative z-20 mx-auto w-full max-w-[26rem] lg:mx-0 lg:ml-auto lg:translate-y-2"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-black shadow-[0_35px_110px_rgba(0,0,0,0.62)]">
                          <SafeCoverImage
                            key={featuredPosterSrc}
                            src={featuredPosterSrc}
                            alt={featuredComic.title}
                            priority
                            sizes="(max-width: 1024px) 78vw, 420px"
                            className="object-cover object-center"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.12)_58%,rgba(0,0,0,0.58)_100%)]" />
                          <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-[9px] font-black uppercase tracking-[0.35em] text-white/70 backdrop-blur-xl">
                            {featuredComic.rating || '8.5'}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
        {/* Shelves Layout */}
        <section className="relative z-20 px-4 sm:px-6 md:px-8 pb-24 sm:pb-28 lg:pb-32">
          <div className="space-y-20">
            {renderedShelves.every(s => shelfState[s.key]?.items.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) &&
              searchQuery && (
                <div className="py-20 text-center">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/5 mb-6 text-white/20">
                    <Search size={40} />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-2">No results found</h3>
                  <p className="text-white/40">We couldn&apos;t find any comics matching &quot;{searchQuery}&quot;</p>
                </div>
              )}

            <AnimatePresence>
              {renderedShelves.map((shelf) => {
                const state = shelf.key === 'for-you' ? { items: personalRecs, loading: isRecsLoading } : shelfState[shelf.key];
                if (!state) return null;

                const filteredItems = rankComicsForHome(
                  state.items.filter(comic =>
                    comic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    comic.description.toLowerCase().includes(searchQuery.toLowerCase())
                  ),
                  {
                    profile: preferenceProfile,
                    ageVerified: isAgeVerified,
                    shelfKey: shelf.key,
                  }
                );

                if (shelf.key === 'for-you' && filteredItems.length === 0 && !isRecsLoading) return null;
                if (searchQuery && filteredItems.length === 0) return null;

                return (
                  <motion.div
                    key={shelf.key}
                    id={shelf.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-6"
                  >
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">
                          {shelf.icon}
                          {shelf.subtitle}
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-white">{shelf.title}</h2>
                      </div>
                      <Link href={`/library?tab=${encodeURIComponent(shelf.title)}`} className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ffca3a]">
                        View All
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
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
                      className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden"
                    >
                      {state.loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-auto w-[42vw] max-w-[12rem] shrink-0 snap-start aspect-[2/3] animate-pulse rounded-2xl bg-white/5 sm:w-[12rem] lg:w-[13rem]" />
                        ))
                      ) : (
                        filteredItems.slice(0, shelfCardLimit).map((comic) => {
                          const cardKey = `${shelf.key}:${comic.source}:${comic.id}`;
                          const adultContent = isAdultComic(comic);
                          const isPreviewOpen = adultContent && previewCardKey === cardKey;
                          const shouldBlur = adultContent && !isAgeVerified;

                          return (
                            <motion.article
                              key={comic.id}
                              initial={false}
                              whileHover={{ y: -12 }}
                              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                              className="group relative w-[42vw] max-w-[12rem] shrink-0 snap-start cursor-pointer sm:w-[12rem] lg:w-[13rem]"
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
                                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl transition-all duration-700 group-hover:border-[#ff5a1f]/40 group-hover:shadow-[0_30px_60px_-15px_rgba(255,90,31,0.25)]">
                                  <SafeCoverImage
                                    key={comic.coverUrl}
                                    src={comic.coverUrl}
                                    alt={comic.title}
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
                                    className={`object-cover transition-all duration-1000 ${
                                      shouldBlur ? 'scale-110 blur-[8px]' : 'scale-100'
                                    } group-hover:scale-115`}
                                  />
                                  
                                  {/* Glassy Gradient Overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 transition-opacity duration-700 group-hover:opacity-100" />

                                  {shouldBlur && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md opacity-100">
                                      <Zap size={24} className="text-[#ffca3a] mb-3 animate-pulse" />
                                      <div className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-white backdrop-blur-xl">
                                        RESTRICTED
                                      </div>
                                    </div>
                                  )}

                                  <div className={`absolute inset-x-0 bottom-0 p-5 space-y-2 transition-all duration-700 ${
                                    shouldBlur
                                      ? 'translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                                      : 'translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                                  } ${isPreviewOpen ? '!translate-y-0 !opacity-100' : ''}`}>
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 rounded-md bg-[#ffca3a] px-1.5 py-0.5 text-[8px] font-black text-black">
                                        <Star size={8} fill="currentColor" />
                                        {comic.rating}
                                      </div>
                                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{comic.meta}</span>
                                    </div>
                                    <h4 className="line-clamp-2 text-sm font-black uppercase tracking-tight text-white leading-tight">{comic.title}</h4>
                                  </div>

                                  {/* Status Chip */}
                                  <div className={`absolute right-4 top-4 rounded-xl border border-white/20 bg-black/40 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-xl transition-all duration-700 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 ${isPreviewOpen ? 'scale-100 opacity-100' : ''}`}>
                                    READ
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

        <section className="py-20 bg-black/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-4 mb-12">
                <div className="w-1.5 h-8 bg-[#ff4d00] rounded-full" />
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight italic">More</h2>
                  <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.3em]">Scroll for more titles</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
                {infiniteItems.map((comic, idx) => {
                  const cardKey = `discover:${comic.source}:${comic.id}`;
                  const adultContent = isAdultComic(comic);
                  const isPreviewOpen = adultContent && previewCardKey === cardKey;
                  const shouldBlur = adultContent && !isAgeVerified;

                  return (
                    <motion.div
                      key={`${comic.id}-${idx}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: (idx % 6) * 0.05, duration: 0.6 }}
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
                        <div className="relative aspect-[2/3] overflow-hidden rounded-[1.5rem] border border-white/5 bg-white/[0.02] transition-all duration-700 group-hover:border-[#ff5a1f]/30 group-hover:shadow-[0_25px_50px_rgba(255,90,31,0.15)] group-hover:-translate-y-3">
                          <SafeCoverImage
                            key={comic.coverUrl || '/logo.png'}
                            src={comic.coverUrl || '/logo.png'}
                            alt={comic.title}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                            className={`object-cover transition-all duration-1000 ${
                              shouldBlur ? 'scale-110 blur-[10px]' : 'scale-100'
                            } group-hover:scale-115`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                          
                          {shouldBlur && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-md opacity-100">
                              <div className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[7px] font-black uppercase tracking-[0.3em] text-white">
                                RESTRICTED
                              </div>
                            </div>
                          )}
                          
                          <div className="absolute bottom-5 left-5 right-5 translate-y-6 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700">
                            <div className="text-[8px] font-black uppercase tracking-[0.3em] text-[#ff5a1f] mb-2">{comic.meta}</div>
                            <div className="text-[11px] font-black uppercase tracking-tight text-white line-clamp-2 leading-tight">{comic.title}</div>
                          </div>

                          <div className="absolute right-4 top-4 h-8 w-8 rounded-full border border-white/10 bg-black/40 flex items-center justify-center text-white/40 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-700 backdrop-blur-xl">
                            <ArrowRight size={14} />
                          </div>
                        </div>
                      </Link>
                    </motion.div>

                  );
                })}
              </div>

              <div ref={loaderRef} className="py-20 flex flex-col items-center justify-center gap-6">
                {hasMoreInfinite ? (
                  <>
                    <div className="w-12 h-12 relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-t-2 border-[#ff4d00] rounded-full"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute inset-4 bg-[#ff4d00]/20 rounded-full"
                      />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Loading more</div>
                  </>
                ) : (
                  <div className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">No more titles</div>
                )}
              </div>
            </div>
        </section>

      </main>

      <AnimatePresence>
        {showAgeGate && (
          <AgeGateOverlay
            title="AGE RESTRICTED"
            description="YOU MUST BE AT LEAST 18 YEARS OLD TO ACCESS THIS CONTENT."
            confirmLabel="I AM 18+"
            cancelLabel="EXIT"
            confirmAction={handleVerify}
            cancelAction={() => setShowAgeGate(false)}
          />
        )}
      </AnimatePresence>

      {/* Footer minimal */}
      <footer className="border-t border-white/10 py-12 text-center">
        <div className="container mx-auto px-4">
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">
            iComics.wiki
          </div>
        </div>
      </footer>
    </div>
  );
}
