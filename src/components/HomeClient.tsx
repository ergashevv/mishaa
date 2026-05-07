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
  Play,
  Sparkles,
  Heart,
  Zap
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  MANGA_LANGUAGE_OPTIONS,
  MangaLanguage,
  readStoredMangaLanguage,
  persistStoredMangaLanguage,
} from '@/lib/manga-language';
import { readAgeVerification, persistAgeVerification } from '@/lib/age-verification';
import { readBookmarks, readRecentHistoryItems, BOOKMARKS_UPDATED_EVENT, LIBRARY_ACTIVITY_EVENT } from '@/lib/library-storage';

// --- Types ---
type ComicSource = 'mangadex' | 'marvel' | 'nhentai';
type ShelfKey = 'featured' | 'manga-hub' | 'webtoons' | 'manhwa' | 'marvel' | 'trending' | 'for-you' | 'new' | 'doujinshi' | 'milf' | 'ntr';

interface LibraryComic {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  bannerUrl?: string;
  source: ComicSource;
  href: string;
  meta: string;
  rating?: string;
  year?: string;
  timestamp?: number;
  progressPercent?: number;
  progressStatus?: string;
}

type NhentaiGallery = {
  id?: number | string;
  gallery_id?: number | string;
  english_title?: string;
  title?: { english?: string; japanese?: string };
  num_pages?: number;
  thumbnail?: string | { path?: string };
};

interface ShelfDefinition {
  key: ShelfKey;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const SHELVES: ShelfDefinition[] = [
  {
    key: 'trending',
    title: 'Global Trending',
    subtitle: 'Real-time popular picks',
    icon: <Flame className="text-orange-500" size={18} />,
  },
  {
    key: 'for-you',
    title: 'For You',
    subtitle: 'Neural tailored picks',
    icon: <Sparkles className="text-[#ffca3a]" size={18} />,
  },
  {
    key: 'manga-hub',
    title: 'Manga Hub',
    subtitle: 'Popular Japanese narratives',
    icon: <LayoutGrid className="text-pink-500" size={18} />,
  },
  {
    key: 'new',
    title: 'Newly Added',
    subtitle: 'Fresh narrative arrivals',
    icon: <Clock className="text-green-500" size={18} />,
  },
  {
    key: 'doujinshi',
    title: 'Popular Doujinshi',
    subtitle: 'High-quality fan comics',
    icon: <Star className="text-yellow-500" size={18} />,
  },
  {
    key: 'milf',
    title: 'MILF / Mature',
    subtitle: 'Mature relationship stories',
    icon: <Heart className="text-red-500" size={18} />,
  },
  {
    key: 'ntr',
    title: 'NTR / Netorare',
    subtitle: 'Dramatic emotional narratives',
    icon: <Zap className="text-purple-500" size={18} />,
  },
  {
    key: 'manhwa',
    title: 'Manhwa',
    subtitle: 'Korean catalog picks',
    icon: <TrendingUp className="text-cyan-500" size={18} />,
  },
  {
    key: 'webtoons',
    title: 'Webtoons',
    subtitle: 'Long-strip vertical reads',
    icon: <Clock className="text-amber-500" size={18} />,
  },
];

import JsonLd from '@/components/JsonLd';
import AgeGateOverlay from './AgeGateOverlay';
import { isAdultComic } from '@/lib/age-verification';

type HomeClientProps = {
  initialData?: Record<string, LibraryComic[]>;
  initialAgeVerified?: boolean;
};

export default function HomeClient({ initialData, initialAgeVerified = false }: HomeClientProps) {
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [previewCardKey, setPreviewCardKey] = useState<string | null>(null);
  const hasCompleteInitialData = SHELVES.every((shelf) => (initialData?.[shelf.key]?.length ?? 0) > 0);
  const visibleShelves = isAgeVerified
    ? SHELVES
    : SHELVES.filter((shelf) => !['doujinshi', 'milf', 'ntr'].includes(shelf.key));

  const [shelfState, setShelfState] = useState<Record<string, { items: LibraryComic[]; loading: boolean }>>(() => {
    const base = {} as Record<string, { items: LibraryComic[]; loading: boolean }>;
    SHELVES.forEach(s => {
      base[s.key] = { items: initialData?.[s.key] || [], loading: !(initialData?.[s.key]?.length) };
    });
    base['trending'] = { items: initialData?.['trending'] || [], loading: !(initialData?.['trending']?.length) };
    return base;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ShelfKey>(initialData ? 'trending' : 'for-you');

  // Infinite Scroll State
  const [infiniteItems, setInfiniteItems] = useState<LibraryComic[]>([]);
  const [infiniteOffset, setInfiniteOffset] = useState(0);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [hasMoreInfinite, setHasMoreInfinite] = useState(true);
  const [loaderInView, setLoaderInView] = useState(false);
  const spicyThresholdRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadMoreInfinite = useCallback(async () => {
    if (!isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    if (infiniteLoading || !hasMoreInfinite) return;
    setInfiniteLoading(true);

    try {
      const page = Math.floor(infiniteOffset / 25) + 1;
      const res = await fetch(`/api/proxy/nhentai?path=${encodeURIComponent(`galleries?page=${page}`)}`);
      if (!res.ok) {
        if (res.status === 403) {
          setShowAgeGate(true);
          setHasMoreInfinite(false);
          return;
        }
        throw new Error('Search failed');
      }
      const data = await res.json();
      const results = Array.isArray(data?.result) ? data.result : [];

      if (results.length > 0) {
        const items: LibraryComic[] = results.map((item: NhentaiGallery) => {
          const thumbnailPath = typeof item.thumbnail === 'object'
            ? item.thumbnail?.path
            : item.thumbnail;

          return {
            id: (item.id || item.gallery_id || '').toString(),
            title: item.english_title || item.title?.english || item.title?.japanese || 'Untitled',
            description: `${item.num_pages || '?'} pages`,
            coverUrl: thumbnailPath
              ? `/api/proxy/nhentai/image?path=${encodeURIComponent(thumbnailPath)}`
              : '/logo.png',
            source: 'nhentai' as const,
            href: `/library/nhentai/${item.id || item.gallery_id}`,
            meta: '18+',
            rating: '5.0',
          };
        });
        setInfiniteItems(prev => [...prev, ...items]);
        setInfiniteOffset(prev => prev + results.length);
        setHasMoreInfinite(true);
      } else {
        setHasMoreInfinite(true);
        setInfiniteOffset(prev => prev + 25);
      }
    } catch (e) {
      console.error(e);
      setHasMoreInfinite(false);
    } finally {
      setInfiniteLoading(false);
    }
  }, [infiniteLoading, hasMoreInfinite, infiniteOffset, isAgeVerified]);

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

  // Scroll Trigger for Age Verification
  useEffect(() => {
    if (isAgeVerified) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isAgeVerified) {
          setShowAgeGate(true);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
    );

    if (spicyThresholdRef.current) {
      observer.observe(spicyThresholdRef.current);
    }

    return () => observer.disconnect();
  }, [isAgeVerified]);

  const handleVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>('en');
  const [personalRecs, setPersonalRecs] = useState<LibraryComic[]>([]);
  const [isRecsLoading, setIsRecsLoading] = useState(false);
  const [now] = useState(() => new Date());
  const [savedBookmarks, setSavedBookmarks] = useState<LibraryComic[]>([]);
  const [recentHistory, setRecentHistory] = useState<LibraryComic[]>([]);
  const [remoteHistory, setRemoteHistory] = useState<LibraryComic[]>([]);
  const hasTrendingInitialItems = Boolean(initialData?.['trending']?.length);

  useEffect(() => {
    const saved = readStoredMangaLanguage();
    const t = setTimeout(() => setMangaLanguage(prev => (saved !== prev ? saved : prev)), 0);
    return () => clearTimeout(t);
  }, []);

  const syncLibraryActivity = useCallback(() => {
    if (typeof window === 'undefined') return;

    const localHistory = readRecentHistoryItems(6).map((entry) => ({
      id: entry.id,
      title: entry.title || 'Continue reading',
      description: entry.chapterTitle
        ? `Last chapter: ${entry.chapterTitle}`
        : entry.progressPercent
          ? `${entry.progressPercent}% read`
          : 'Continue reading',
      coverUrl: entry.coverUrl || '/logo.png',
      source: entry.source as ComicSource,
      href: entry.href,
      meta: entry.progressPercent ? `${entry.progressPercent}%` : 'Resume',
      rating: 'Reading',
      timestamp: Number(entry.timestamp || 0),
      progressPercent: entry.progressPercent,
      progressStatus: entry.progressStatus,
    }));

    const mergedHistory = [...remoteHistory, ...localHistory].reduce((acc, item) => {
      const key = `${item.source}:${item.id}`;
      const existing = acc.get(key);
      if (!existing || Number(item.timestamp || 0) >= Number(existing.timestamp || 0)) {
        acc.set(key, item);
      }
      return acc;
    }, new Map<string, LibraryComic>());

    const bookmarks = readBookmarks().map((bookmark) => ({
      id: bookmark.id,
      title: bookmark.title || 'Untitled',
      description: bookmark.rating ? `Saved item · ${bookmark.rating}` : 'Saved for later',
      coverUrl: bookmark.coverUrl || '/logo.png',
      source: bookmark.source as ComicSource,
      href: bookmark.href || `/library/${bookmark.source}/${bookmark.id}`,
      meta: bookmark.rating || 'Saved',
      rating: bookmark.rating,
    }));

    setSavedBookmarks(bookmarks);
    setRecentHistory(Array.from(mergedHistory.values()).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)));
  }, [remoteHistory]);

  useEffect(() => {
    const timer = window.setTimeout(syncLibraryActivity, 0);
    const handleActivity = () => syncLibraryActivity();
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, handleActivity);
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, handleActivity);
    window.addEventListener('storage', handleActivity);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, handleActivity);
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, handleActivity);
      window.removeEventListener('storage', handleActivity);
    };
  }, [syncLibraryActivity]);

  useEffect(() => {
    let cancelled = false;

    const loadCloudHistory = async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json().catch(() => null);
        if (cancelled) return;

        if (!meData?.user) {
          setRemoteHistory([]);
          return;
        }

        const progressRes = await fetch('/api/reading-progress');
        const progressData = await progressRes.json().catch(() => null);
        if (cancelled) return;

        const items: LibraryComic[] = Array.isArray(progressData?.items)
          ? progressData.items.map((item: {
              comicId?: string;
              comicTitle?: string;
              comicCoverUrl?: string | null;
              source?: string;
              chapterTitle?: string | null;
              progressPercent?: number;
              progressStatus?: string;
              updatedAt?: string;
              createdAt?: string;
              chapterId?: string | null;
            }) => ({
              id: String(item.comicId || ''),
              title: item.comicTitle || 'Continue reading',
              description: item.chapterTitle
                ? `Last chapter: ${item.chapterTitle}`
                : 'Continue reading',
              coverUrl: item.comicCoverUrl || '/logo.png',
              source: item.source as ComicSource,
              href: `/library/${item.source}/${item.comicId}`,
              meta: item.progressPercent ? `${item.progressPercent}%` : 'Resume',
              rating: item.progressStatus || 'Reading',
              timestamp: Date.parse(item.updatedAt || item.createdAt || '') || Date.now(),
              progressPercent: item.progressPercent,
              progressStatus: item.progressStatus,
            }))
          : [];

        setRemoteHistory(items.filter((item) => item.id && item.source));
      } catch (error) {
        console.error('Cloud reading progress error:', error);
        if (!cancelled) setRemoteHistory([]);
      }
    };

    void loadCloudHistory();

    return () => {
      cancelled = true;
    };
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
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setIsTouchDevice(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const fetchShelves = async (lang: MangaLanguage) => {
    setShelfState(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(key => newState[key].loading = true);
      return newState;
    });

    try {
      const res = await fetch(`/api/home/data?lang=${lang}`, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error('Home data fetch failed');
      const data = await res.json();

      if (data?.shelves) {
        setShelfState({
          'trending': { items: data.shelves['trending'] || [], loading: false },
          'manga-hub': { items: data.shelves['manga-hub'] || [], loading: false },
          'new': { items: data.shelves['new'] || [], loading: false },
          webtoons: { items: data.shelves['webtoons'] || [], loading: false },
          manhwa: { items: data.shelves['manhwa'] || [], loading: false },
          marvel: { items: data.shelves['marvel'] || [], loading: false },
          'doujinshi': { items: data.shelves['doujinshi'] || [], loading: false },
          'milf': { items: data.shelves['milf'] || [], loading: false },
          'ntr': { items: data.shelves['ntr'] || [], loading: false },
          'for-you': { items: [], loading: false },
        });
      }
    } catch (error) {
      console.error('Home data error:', error);
      setShelfState(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(key => newState[key].loading = false);
        return newState;
      });
    }
  };

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
  }, [hasCompleteInitialData, isAgeVerified, mangaLanguage]);

  useEffect(() => {
    const loadPersonalRecs = async () => {
      if (typeof window === 'undefined') return;
      setIsRecsLoading(true);
      try {
        const history = JSON.parse(localStorage.getItem('reading_history') || '{}');
        const ids = Object.keys(history);
        if (ids.length === 0) {
          setIsRecsLoading(false);
          return;
        }

        const historyEntries = Object.values(history) as Array<{ aniListId?: number | string }>;
        const aniListIds = historyEntries
          .map(entry => entry.aniListId)
          .filter(Boolean);

        const backupIds = Object.keys(history).slice(-5).map(id => id.split(':')[1]);

        const res = await fetch('/api/recommendations', {
          method: 'POST',
          body: JSON.stringify({
            history: aniListIds.length > 0 ? aniListIds.slice(-5) : backupIds
          }),
        });
        const data = await res.json();
        if (data.items?.length > 0) {
          setPersonalRecs(data.items);
          setActiveTab(prev => (prev === 'for-you' || !hasTrendingInitialItems) ? 'for-you' : prev);
        }
      } catch (e) {
        console.error('Recs error:', e);
      } finally {
        setIsRecsLoading(false);
      }
    };
    loadPersonalRecs();
  }, [hasTrendingInitialItems]);

  const handleLanguageChange = (newLang: MangaLanguage) => {
    setMangaLanguage(newLang);
    persistStoredMangaLanguage(newLang);
  };

  const featuredComic = useMemo(() => {
    const pool = activeTab === 'for-you' ? personalRecs : (shelfState[activeTab]?.items || []);
    if (!pool.length) return null;
    return pool[now.getHours() % pool.length];
  }, [activeTab, shelfState, personalRecs, now]);

  const hasPersonalLibrary = recentHistory.length > 0 || savedBookmarks.length > 0;
  const activeShelfCount = shelfState[activeTab]?.items.length || 0;
  const featuredImageSrc = featuredComic?.bannerUrl || featuredComic?.coverUrl || '/logo.png';
  const featuredImageMode = featuredComic?.bannerUrl ? 'banner' : 'cover';

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
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-10%] top-[8rem] h-[30rem] w-[30rem] rounded-full bg-[#ff5a1f]/10 blur-[140px]" />
          <div className="absolute right-[-12%] top-[18rem] h-[26rem] w-[26rem] rounded-full bg-[#ffd36b]/8 blur-[160px]" />
          <div className="absolute inset-x-0 top-[20rem] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

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
                  <div className="grid gap-8 rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
                    <div className="space-y-6">
                      <div className="h-6 w-32 rounded-full bg-white/5 animate-pulse" />
                      <div className="h-16 w-3/4 rounded-2xl bg-white/5 animate-pulse" />
                      <div className="h-20 w-2/3 rounded-2xl bg-white/5 animate-pulse" />
                      <div className="flex flex-wrap gap-3">
                        <div className="h-12 w-36 rounded-2xl bg-white/5 animate-pulse" />
                        <div className="h-12 w-36 rounded-2xl bg-white/5 animate-pulse" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
                        <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
                        <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
                      </div>
                    </div>
                    <div className="hidden lg:block rounded-[2rem] border border-white/10 bg-white/5 animate-pulse" />
                  </div>
                </div>
              </motion.div>
            ) : featuredComic ? (
              <motion.div
                key={featuredComic.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="relative w-full"
              >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 pb-16">
                  <div className="grid gap-8 rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:p-10">
                    {/* Text Info */}
                    <div className="space-y-6 lg:pr-4">
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex flex-wrap items-center gap-3"
                      >
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#ffca3a] backdrop-blur-md">
                          Trending Now
                        </span>
                        <div className="flex items-center gap-1 text-[#ffca3a]">
                          <Star size={14} fill="currentColor" />
                          <span className="text-sm font-black">{featuredComic.rating}</span>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/35">
                          {activeShelfCount} items
                        </span>
                      </motion.div>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:hidden"
                      >
                        <div className="relative aspect-[16/10] w-full bg-black">
                          <Image
                            src={featuredImageSrc}
                            alt={featuredComic.title}
                            fill
                            priority
                            unoptimized
                            className="scale-110 object-cover opacity-35 blur-2xl"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/25 to-transparent" />
                          <Image
                            src={featuredImageSrc}
                            alt={featuredComic.title}
                            fill
                            priority
                            unoptimized
                            className={featuredImageMode === 'banner'
                              ? 'object-cover'
                              : 'object-contain p-6'
                            }
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent" />
                        </div>
                      </motion.div>

                      <motion.h1
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-display text-4xl leading-[0.9] sm:text-5xl lg:text-7xl xl:text-8xl"
                      >
                        {featuredComic.title}
                      </motion.h1>

                      <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="max-w-2xl text-sm leading-7 text-white/60 md:text-base line-clamp-3"
                      >
                        {featuredComic.description}
                      </motion.p>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex flex-wrap gap-3 pt-2"
                      >
                        <Link href={featuredComic.href} className="group flex items-center gap-3 rounded-2xl bg-white px-6 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-[#ff5a1f] hover:text-white md:px-8 md:py-4 md:text-[11px]">
                          Start Reading
                          <Play size={16} fill="currentColor" className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </Link>
                        <button className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md transition-all hover:bg-white/10 md:px-8 md:py-4 md:text-[11px]">
                          Add to Library
                        </button>
                      </motion.div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Focus</p>
                          <p className="mt-2 text-sm font-black uppercase tracking-tight text-white">{shelfState[activeTab]?.loading ? 'Refreshing feed' : 'Ready to read'}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Library</p>
                          <p className="mt-2 text-sm font-black uppercase tracking-tight text-white">{activeShelfCount} items</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Mode</p>
                          <p className="mt-2 text-sm font-black uppercase tracking-tight text-white">{activeTab.replace('-', ' ')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Featured Card Side */}
                    <div className="hidden lg:block">
                      <motion.div
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="perspective-container relative flex h-full min-h-[540px] w-full items-center justify-center"
                      >
                        <div className="perspective-card relative w-full max-w-[460px] overflow-hidden rounded-[2.5rem] border border-white/15 bg-black shadow-2xl aspect-[16/10]">
                          <Image
                            src={featuredImageSrc}
                            alt="Cover"
                            fill
                            priority
                            unoptimized
                            className="scale-110 object-cover opacity-30 blur-2xl"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
                          <Image
                            src={featuredImageSrc}
                            alt="Cover"
                            fill
                            priority
                            unoptimized
                            className={featuredImageMode === 'banner'
                              ? 'object-cover'
                              : 'object-contain bg-black p-6'
                            }
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-6">
                            <div className="rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl">
                              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#ffca3a]">Featured pick</p>
                              <p className="mt-2 text-lg font-black uppercase tracking-tight text-white line-clamp-2">{featuredComic.title}</p>
                              <p className="mt-2 text-xs leading-6 text-white/55 line-clamp-2">{featuredComic.description}</p>
                            </div>
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

        {hasPersonalLibrary && (
          <section className="relative z-20 container mx-auto px-4 sm:px-6 md:px-8 pb-10">
            <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-2">
              {recentHistory.length > 0 && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff5a1f]">Continue Reading</p>
                      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mt-2">Pick up where you left off</h2>
                    </div>
                    <Link href="/library" className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40 hover:text-white transition-colors">
                      Open Library
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {recentHistory.slice(0, 4).map((comic) => (
                      <Link
                        key={`${comic.source}:${comic.id}`}
                        href={comic.href}
                        className="group flex items-center gap-5 rounded-2xl border border-white/5 bg-black/30 p-3 transition-all hover:border-[#ff5a1f]/30 hover:bg-black/50"
                      >
                        <div className="relative h-32 w-24 overflow-hidden rounded-xl border border-white/10 bg-black shrink-0 md:h-36 md:w-28">
                          <Image src={comic.coverUrl || '/logo.png'} alt={comic.title} fill unoptimized className="object-contain object-center p-1" />
                        </div>
                        <div className="min-w-0 flex-1 py-1">
                          <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#ffca3a]">
                            {comic.progressPercent ? `${comic.progressPercent}% Resume` : 'Resume'}
                          </p>
                          <h3 className="mt-2 truncate text-sm font-black uppercase tracking-widest text-white group-hover:text-[#ff5a1f] transition-colors">
                            {comic.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-white/35">
                            {comic.description}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {savedBookmarks.length > 0 && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff5a1f]">Bookmarks</p>
                      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mt-2">Saved for later</h2>
                    </div>
                    <Link href="/settings" className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40 hover:text-white transition-colors">
                      Manage
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {savedBookmarks.slice(0, 4).map((comic) => (
                      <Link
                        key={`${comic.source}:${comic.id}`}
                        href={comic.href}
                        className="group flex items-center gap-5 rounded-2xl border border-white/5 bg-black/30 p-3 transition-all hover:border-[#ff5a1f]/30 hover:bg-black/50"
                      >
                        <div className="relative h-32 w-24 overflow-hidden rounded-xl border border-white/10 bg-black shrink-0 md:h-36 md:w-28">
                          <Image src={comic.coverUrl || '/logo.png'} alt={comic.title} fill unoptimized className="object-contain object-center p-1" />
                        </div>
                        <div className="min-w-0 flex-1 py-1">
                          <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#ffca3a]">Bookmark</p>
                          <h3 className="mt-2 truncate text-sm font-black uppercase tracking-widest text-white group-hover:text-[#ff5a1f] transition-colors">
                            {comic.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-white/35">
                            {comic.meta || 'Saved item'}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {!hasPersonalLibrary && (
          <section className="relative z-20 container mx-auto px-4 sm:px-6 md:px-8 pb-10">
            <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6 md:p-8">
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
                <div className="rounded-[2rem] border border-white/5 bg-black/20 p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff5a1f]">Your library is empty</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-black uppercase tracking-[0.35em] text-white/45">
                      Fresh start
                    </span>
                  </div>
                  <h2 className="mt-4 max-w-2xl text-3xl font-black uppercase tracking-tight leading-[0.95] md:text-5xl">
                    Start reading to unlock continue reading and bookmarks
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45 md:text-base">
                    Once you open a comic and bookmark it, this section will start showing your personal reading queue and saved items here.
                  </p>
                </div>
                <div className="grid gap-3 rounded-[2rem] border border-white/5 bg-black/35 p-4 sm:grid-cols-2 lg:grid-cols-1 lg:p-6">
                  <Link href="/library" className="group rounded-[1.5rem] border border-[#ff5a1f]/30 bg-[#ff5a1f] px-5 py-5 text-center transition-all hover:-translate-y-0.5 hover:bg-white hover:text-black">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/70 group-hover:text-black/60">
                      Start here
                    </div>
                    <div className="mt-3 text-base font-black uppercase tracking-[0.28em] text-white group-hover:text-black">
                      Explore Library
                    </div>
                  </Link>
                  <Link href="/settings" className="group rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-5 text-center transition-all hover:border-white/25 hover:bg-white/[0.06]">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/35">
                      Tune it up
                    </div>
                    <div className="mt-3 text-base font-black uppercase tracking-[0.28em] text-white/80 group-hover:text-white">
                      Configure Preferences
                    </div>
                  </Link>
                  <div className="rounded-[1.5rem] border border-white/5 bg-white/[0.03] p-5 sm:col-span-2 lg:col-span-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.45em] text-[#ffca3a]">What appears here later</p>
                    <p className="mt-3 text-sm leading-7 text-white/45">
                      Your recent reading queue, saved items, and bookmarks will auto-fill this area once you start interacting with comics.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- EXPLORE SECTION --- */}
        <section className="relative z-20 -mt-8 container mx-auto px-4 sm:px-6 md:px-8 pb-24 sm:-mt-10 sm:pb-28 lg:-mt-12 lg:pb-32">

          {/* --- EXPLORE & DISCOVERY CONTROLS --- */}
          <div className="mb-14 flex flex-col gap-10 max-w-6xl mx-auto sm:mb-16">

            {/* 1. Category Navigation Layer */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 px-2">
                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.45em] text-[#ff5a1f]">01_Explore_Archives</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-[2.5rem] backdrop-blur-3xl overflow-x-auto no-scrollbar">
                {visibleShelves.map((shelf) => (
                  <button
                    key={shelf.key}
                    onClick={() => setActiveTab(shelf.key)}
                    className={`relative flex items-center gap-3 md:gap-4 rounded-full px-5 md:px-8 py-3 md:py-4 transition-all duration-500 whitespace-nowrap ${activeTab === shelf.key
                      ? 'bg-white text-black shadow-2xl scale-[1.02]'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <div className={`transition-all duration-500 ${activeTab === shelf.key ? 'text-[#ff5a1f] scale-110' : 'text-white/20'}`}>
                      {shelf.icon}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{shelf.title}</span>
                      <span className={`text-[6px] md:text-[7px] font-bold uppercase tracking-widest opacity-40 ${activeTab === shelf.key ? 'text-black/60' : 'text-white/40'}`}>
                        {shelf.subtitle.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </div>
                    {activeTab === shelf.key && (
                      <motion.div layoutId="active-nav-bg" className="absolute inset-0 bg-white rounded-full -z-10" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Reading Preference Layer */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 px-2">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ff5a1f]">02_Language_Sync</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6 backdrop-blur-2xl">
                  <div className="flex flex-col items-center sm:items-start pl-0 sm:pl-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40 text-center sm:text-left">Translated_In</span>
                    <span className="text-[7px] font-bold uppercase tracking-[0.3em] text-white/10 hidden sm:block">Global localization</span>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5 overflow-x-auto max-w-full no-scrollbar">
                    {MANGA_LANGUAGE_OPTIONS.filter(o => ['en', 'ru', 'es', 'fr', 'all'].includes(o.value)).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleLanguageChange(opt.value)}
                        className={`px-4 md:px-5 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${mangaLanguage === opt.value ? 'bg-[#ff5a1f] text-white shadow-lg' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                      >
                        {opt.value === 'all' ? 'MIX' : opt.value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative group">
                  <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-white/20 transition-all duration-500 group-focus-within:text-[#ff5a1f]" size={20} />
                  <input
                    type="text"
                    placeholder="Search by title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-[2rem] border border-white/10 bg-white/[0.03] py-5 pl-16 pr-8 text-[11px] font-black uppercase tracking-widest outline-none backdrop-blur-2xl transition-all duration-500 focus:border-[#ff5a1f]/40 focus:bg-black/40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Shelves Layout */}
          <div className="space-y-20">
            {visibleShelves.every(s => shelfState[s.key]?.items.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) &&
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
              {visibleShelves.map((shelf) => {
                const state = shelf.key === 'for-you' ? { items: personalRecs, loading: isRecsLoading } : shelfState[shelf.key];
                if (!state) return null;

                const filteredItems = state.items.filter(comic =>
                  comic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  comic.description.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (shelf.key === 'for-you' && filteredItems.length === 0 && !isRecsLoading) return null;
                if (searchQuery && filteredItems.length === 0) return null;

                return (
                  <motion.div
                    key={shelf.key}
                    id={shelf.key}
                    ref={shelf.key === 'doujinshi' ? spicyThresholdRef : null}
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

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {state.loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />
                        ))
                      ) : (
                        filteredItems.map((comic, i) => {
                          const cardKey = `${shelf.key}:${comic.source}:${comic.id}`;
                          const adultContent = isAdultComic(comic);
                          const isPreviewOpen = adultContent && previewCardKey === cardKey;

                          return (
                            <motion.article
                              key={comic.id}
                              initial={false}
                              whileHover={{ y: -8 }}
                              transition={{ duration: 0.25, delay: i * 0.02 }}
                              className="group relative cursor-pointer"
                            >
                              <Link
                                href={comic.href}
                                onClickCapture={(event) => {
                                  if (!isTouchDevice || !adultContent) return;
                                  if (!isPreviewOpen) {
                                    event.preventDefault();
                                    setPreviewCardKey(cardKey);
                                  }
                                }}
                              >
                                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl transition-all duration-300 group-hover:-translate-y-2 group-hover:border-white/30 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
                                  <Image
                                    src={comic.coverUrl}
                                    alt={comic.title}
                                    fill
                                    unoptimized
                                    className={`object-cover transition-all duration-700 ${
                                      adultContent && !isPreviewOpen ? 'scale-105 blur-[2px]' : 'scale-100'
                                    } group-hover:scale-110 group-hover:blur-0`}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                                  {adultContent && !isPreviewOpen && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[2px] opacity-100 transition-opacity group-hover:opacity-0">
                                      <div className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[8px] font-black uppercase tracking-[0.4em] text-white">
                                        Tap to reveal
                                      </div>
                                    </div>
                                  )}

                                  <div className={`absolute bottom-4 left-4 right-4 space-y-1 transition-all duration-300 ${
                                    adultContent && !isPreviewOpen
                                      ? 'translate-y-0 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                                      : 'translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                                  } ${isPreviewOpen ? '!translate-y-0 !opacity-100' : ''}`}>
                                    <div className="flex items-center gap-2 text-[8px] font-black text-[#ffca3a]">
                                      <Star size={10} fill="currentColor" />
                                      {comic.rating}
                                    </div>
                                    <h4 className="line-clamp-2 text-sm font-black uppercase tracking-tight text-white">{comic.title}</h4>
                                  </div>

                                  <div className={`absolute right-3 top-3 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-md transition-all duration-300 ${
                                    adultContent && !isPreviewOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                                  } ${isPreviewOpen ? 'opacity-100' : ''}`}>
                                    READ NOW
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

        {/* Infinite Discover Section */}
        <section className="py-20 bg-black/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-8 bg-[#ff4d00] rounded-full" />
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight italic">Discover More</h2>
                <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.3em]">Endless content stream</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
              {infiniteItems.map((comic, idx) => {
                const cardKey = `discover:${comic.source}:${comic.id}`;
                const adultContent = isAdultComic(comic);
                const isPreviewOpen = adultContent && previewCardKey === cardKey;

                return (
                  <motion.div
                    key={`${comic.id}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (idx % 6) * 0.1 }}
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
                      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-white/5 transition-all duration-500 group-hover:border-[#ff4d00]/30 group-hover:shadow-[0_20px_50px_rgba(255,77,0,0.15)] group-hover:-translate-y-2">
                        <Image
                          src={comic.coverUrl || '/logo.png'}
                          alt={comic.title}
                          fill
                          className={`object-cover transition-all duration-700 ${
                            adultContent && !isPreviewOpen ? 'scale-105 blur-[2px]' : 'scale-100'
                          } group-hover:scale-110 group-hover:blur-0`}
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                        {adultContent && !isPreviewOpen && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[2px] opacity-100 transition-opacity group-hover:opacity-0">
                            <div className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[8px] font-black uppercase tracking-[0.4em] text-white">
                              Tap to reveal
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                          <div className="text-[9px] font-black uppercase tracking-widest text-[#ff4d00] mb-1">{comic.meta}</div>
                          <div className="text-xs font-bold text-white line-clamp-1">{comic.title}</div>
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
                  <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Syncing_New_Realities</div>
                </>
              ) : (
                <div className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">All_Realities_Synchronized</div>
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
            iComics.wiki // Sequential Narrative Archive 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
