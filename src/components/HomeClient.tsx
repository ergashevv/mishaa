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
  const featuredHasBanner = Boolean(featuredComic?.bannerUrl);

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
                  <div className="grid gap-8 rounded-[3rem] border border-white/5 bg-white/[0.02] p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-12 backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                    <div className="space-y-8">
                      <div className="h-8 w-40 rounded-full bg-white/5 animate-pulse" />
                      <div className="h-20 w-full rounded-2xl bg-white/5 animate-pulse" />
                      <div className="h-24 w-3/4 rounded-2xl bg-white/5 animate-pulse" />
                      <div className="flex flex-wrap gap-4">
                        <div className="h-14 w-44 rounded-2xl bg-white/5 animate-pulse" />
                        <div className="h-14 w-44 rounded-2xl bg-white/5 animate-pulse" />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="h-28 rounded-[2rem] bg-white/5 animate-pulse" />
                        <div className="h-28 rounded-[2rem] bg-white/5 animate-pulse" />
                        <div className="h-28 rounded-[2rem] bg-white/5 animate-pulse" />
                      </div>
                    </div>
                    <div className="hidden lg:block rounded-[2.5rem] border border-white/5 bg-white/[0.03] animate-pulse" />
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
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-32">
                  <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-16 items-center">
                    
                    {/* Content Left Side */}
                    <div className="space-y-12 relative z-20 order-2 lg:order-1">
                      <div className="space-y-6">
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-4 text-[#ff5a1f]"
                        >
                          <div className="h-px w-10 bg-current" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Featured Story</span>
                        </motion.div>

                        <motion.h1
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1, duration: 0.8 }}
                          className="text-display text-4xl sm:text-6xl xl:text-7xl text-white leading-[1.1]"
                        >
                          {featuredComic.title}
                        </motion.h1>

                        <motion.p
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2, duration: 0.8 }}
                          className="max-w-xl text-lg sm:text-xl leading-relaxed text-white/40 font-medium"
                        >
                          {featuredComic.description}
                        </motion.p>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-wrap items-center gap-6"
                      >
                        <Link
                          href={featuredComic.href}
                          className="h-20 px-12 rounded-full bg-white text-black text-xs font-black uppercase tracking-widest flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl"
                        >
                          Begin Narrative
                        </Link>
                        
                        <button className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 hover:text-white transition-colors">
                          Add to Collection +
                        </button>
                      </motion.div>
                    </div>

                    {/* Right Side: Large Visual */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, duration: 1 }}
                      className="relative z-10 order-1 lg:order-2"
                    >
                      <div className="relative aspect-[4/5] sm:aspect-square w-full rounded-[4rem] overflow-hidden border border-white/5 shadow-2xl">
                        <Image
                          src={featuredImageSrc}
                          alt={featuredComic.title}
                          fill
                          priority
                          sizes="(max-width: 1024px) 100vw, 600px"
                          unoptimized
                          className="object-cover object-center transition-transform duration-1000"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                        
                        <div className="absolute bottom-12 left-12 right-12">
                          <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/40 mb-2">Primary Feature</p>
                          <h3 className="text-3xl font-black text-white">{featuredComic.title}</h3>
                        </div>
                      </div>
                      
                      {/* Atmospheric Glow */}
                      <div className="absolute -inset-20 -z-10 bg-[#ff5a1f]/10 blur-[120px] rounded-full" />
                    </motion.div>

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
          <section className="relative z-20 container mx-auto px-6 pb-32">
            <div className="max-w-4xl mx-auto text-center space-y-12">
              <div className="space-y-4">
                <h2 className="text-5xl sm:text-7xl font-display text-white">Your Collection</h2>
                <p className="text-xl text-white/30 max-w-2xl mx-auto">
                  A dedicated space for your reading journey. Start exploring to build your personal library.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Link href="/library" className="h-20 px-16 rounded-full bg-white text-black text-sm font-black uppercase tracking-widest hover:scale-105 transition-all active:scale-95">
                  Explore Now
                </Link>
                <Link href="/settings" className="h-20 px-16 rounded-full border border-white/10 text-white/40 text-sm font-black uppercase tracking-widest hover:text-white hover:border-white/20 transition-all">
                  Configure
                </Link>
              </div>

              <div className="flex items-center justify-center gap-12 pt-12 border-t border-white/5">
                {['Live Sync', 'Tracking', 'Bookmarks'].map((tag) => (
                  <span key={tag} className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20">{tag}</span>
                ))}
              </div>
            </div>
          </section>
        )}


        {/* --- EXPLORE SECTION --- */}
        <section className="relative z-20 -mt-12 container mx-auto px-4 sm:px-6 md:px-8 pb-24 sm:-mt-16 sm:pb-28 lg:-mt-20 lg:pb-32">

          {/* --- CATEGORY NAVIGATION --- */}
          <div className="mb-24 flex flex-col gap-16 max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {visibleShelves.map((shelf) => (
                <button
                  key={shelf.key}
                  onClick={() => setActiveTab(shelf.key)}
                  className={`group relative flex flex-col items-center transition-all duration-500 ${
                    activeTab === shelf.key ? 'scale-110' : 'opacity-30 hover:opacity-100'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-[0.5em] transition-colors ${
                    activeTab === shelf.key ? 'text-[#ff5a1f]' : 'text-white'
                  }`}>
                    {shelf.title}
                  </span>
                  {activeTab === shelf.key && (
                    <motion.div
                      layoutId="active-bar"
                      className="absolute -bottom-4 h-[2px] w-8 bg-[#ff5a1f]"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Preference Controls */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-12 border-b border-white/5 pb-12">
              <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 whitespace-nowrap">Linguistic:</span>
                {MANGA_LANGUAGE_OPTIONS.filter(o => ['en', 'ru', 'es', 'fr', 'all'].includes(o.value)).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleLanguageChange(opt.value)}
                    className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                      mangaLanguage === opt.value ? 'text-[#ffca3a]' : 'text-white/20 hover:text-white'
                    }`}
                  >
                    {opt.value === 'all' ? 'Mixed' : opt.value}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[300px]">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input
                  type="text"
                  placeholder="Find stories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent pl-8 pr-4 py-2 text-xs font-medium text-white outline-none placeholder:text-white/10 border-b border-white/10 focus:border-[#ff5a1f] transition-colors"
                />
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
                              whileHover={{ y: -12 }}
                              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
                                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl transition-all duration-700 group-hover:border-[#ff5a1f]/40 group-hover:shadow-[0_30px_60px_-15px_rgba(255,90,31,0.25)]">
                                  <Image
                                    src={comic.coverUrl}
                                    alt={comic.title}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
                                    className={`object-cover transition-all duration-1000 ${
                                      adultContent && !isPreviewOpen ? 'scale-110 blur-[8px]' : 'scale-100'
                                    } group-hover:scale-115 group-hover:blur-0`}
                                  />
                                  
                                  {/* Glassy Gradient Overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 transition-opacity duration-700 group-hover:opacity-100" />

                                  {adultContent && !isPreviewOpen && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md opacity-100 transition-opacity duration-700 group-hover:opacity-0">
                                      <Zap size={24} className="text-[#ffca3a] mb-3 animate-pulse" />
                                      <div className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-white backdrop-blur-xl">
                                        RESTRICTED
                                      </div>
                                    </div>
                                  )}

                                  <div className={`absolute inset-x-0 bottom-0 p-5 space-y-2 transition-all duration-700 ${
                                    adultContent && !isPreviewOpen
                                      ? 'translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                                      : 'translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                                  } ${isPreviewOpen ? '!translate-y-0 !opacity-100' : ''}`}>
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 rounded-md bg-[#ffca3a] px-1.5 py-0.5 text-[8px] font-black text-black">
                                        <Star size={8} fill="currentColor" />
                                        {comic.rating}
                                      </div>
                                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Full Access</span>
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
                        <Image
                          src={comic.coverUrl || '/logo.png'}
                          alt={comic.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                          className={`object-cover transition-all duration-1000 ${
                            adultContent && !isPreviewOpen ? 'scale-110 blur-[10px]' : 'scale-100'
                          } group-hover:scale-115 group-hover:blur-0`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                        
                        {adultContent && !isPreviewOpen && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-md opacity-100 transition-opacity duration-700 group-hover:opacity-0">
                            <div className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[7px] font-black uppercase tracking-[0.3em] text-white">
                              RESTRICTED
                            </div>
                          </div>
                        )}
                        
                        <div className="absolute bottom-5 left-5 right-5 translate-y-6 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700">
                          <div className="text-[8px] font-black uppercase tracking-[0.3em] text-[#ff5a1f] mb-2">{comic.meta}</div>
                          <div className="text-[11px] font-black uppercase tracking-tight text-white line-clamp-2 leading-tight">{comic.title}</div>
                        </div>

                        {/* Quick View Icon */}
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
