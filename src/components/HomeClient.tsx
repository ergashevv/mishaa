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
}

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

type HomeClientProps = {
  initialData?: Record<string, LibraryComic[]>;
  initialAgeVerified?: boolean;
};

export default function HomeClient({ initialData, initialAgeVerified = false }: HomeClientProps) {
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  const visibleShelves = isAgeVerified
    ? SHELVES
    : SHELVES.filter((shelf) => !['doujinshi', 'milf', 'ntr'].includes(shelf.key));

  const [shelfState, setShelfState] = useState<Record<string, { items: LibraryComic[]; loading: boolean }>>(() => {
    const base: any = {};
    SHELVES.forEach(s => {
      base[s.key] = { items: initialData?.[s.key] || [], loading: !initialData?.[s.key] };
    });
    base['trending'] = { items: initialData?.['trending'] || [], loading: !initialData?.['trending'] };
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
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const results = Array.isArray(data?.result) ? data.result : [];

      if (results.length > 0) {
        const items: LibraryComic[] = results.map((item: any) => {
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
      setHasMoreInfinite(true);
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
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>('en');
  const [personalRecs, setPersonalRecs] = useState<LibraryComic[]>([]);
  const [isRecsLoading, setIsRecsLoading] = useState(false);
  const [now] = useState(() => new Date());

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
    if (isFirstMount.current && initialData) {
      isFirstMount.current = false;
      return;
    }
    const t = setTimeout(() => {
      void fetchShelves(mangaLanguage);
    }, 0);
    return () => clearTimeout(t);
  }, [isAgeVerified, initialData, mangaLanguage]);

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

        const historyEntries = Object.values(history) as any[];
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
          setActiveTab(prev => (prev === 'for-you' || shelfState['trending'].items.length === 0) ? 'for-you' : prev);
        }
      } catch (e) {
        console.error('Recs error:', e);
      } finally {
        setIsRecsLoading(false);
      }
    };
    loadPersonalRecs();
  }, []);

  const handleLanguageChange = (newLang: MangaLanguage) => {
    setMangaLanguage(newLang);
    persistStoredMangaLanguage(newLang);
  };

  const featuredComic = useMemo(() => {
    const pool = activeTab === 'for-you' ? personalRecs : (shelfState[activeTab]?.items || []);
    if (!pool.length) return null;
    return pool[now.getHours() % pool.length];
  }, [activeTab, shelfState, personalRecs, now]);

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

      <main className="relative pt-20">

        {/* --- DYNAMIC HERO BANNER --- */}
        <section className="relative min-h-[70vh] md:min-h-[85vh] w-full">
          <AnimatePresence mode="wait">
            {!featuredComic && (shelfState[activeTab]?.loading || isRecsLoading) ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative min-h-[70vh] md:min-h-[85vh] w-full pt-48 pb-32"
              >
                <div className="container mx-auto px-4 md:px-8 h-full flex items-center">
                  <div className="grid w-full gap-12 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-6">
                      <div className="h-6 w-32 bg-white/5 rounded-full animate-pulse" />
                      <div className="h-20 w-3/4 bg-white/5 rounded-2xl animate-pulse" />
                      <div className="h-24 w-2/3 bg-white/5 rounded-2xl animate-pulse" />
                      <div className="flex gap-4">
                        <div className="h-14 w-40 bg-white/5 rounded-2xl animate-pulse" />
                        <div className="h-14 w-40 bg-white/5 rounded-2xl animate-pulse" />
                      </div>
                    </div>
                    <div className="hidden lg:block h-[450px] w-full bg-white/5 rounded-[2rem] animate-pulse" />
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
                className="relative min-h-[70vh] md:min-h-[85vh] w-full"
              >
                <div className="relative h-full w-full">
                  <Image
                    src={featuredComic.bannerUrl || featuredComic.coverUrl}
                    alt={featuredComic.title}
                    fill
                    priority
                    unoptimized
                    className="object-cover opacity-25 md:opacity-40 md:blur-[2px]"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-[#05060a]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#05060a] via-transparent to-transparent" />

                <div className="container relative z-10 mx-auto flex h-full items-center px-4 md:px-8 py-20">
                  <div className="grid w-full gap-12 lg:grid-cols-[1fr_320px]">

                    {/* Text Info */}
                    <div className="space-y-6">
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-4"
                      >
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#ffca3a] backdrop-blur-md">
                          Trending Now
                        </span>
                        <div className="flex items-center gap-1 text-[#ffca3a]">
                          <Star size={14} fill="currentColor" />
                          <span className="text-sm font-black">{featuredComic.rating}</span>
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="lg:hidden relative mx-auto w-full max-w-[320px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                      >
                        <div className="relative aspect-[3/4] w-full bg-black">
                          <Image
                            src={featuredComic.bannerUrl || featuredComic.coverUrl}
                            alt={featuredComic.title}
                            fill
                            priority
                            unoptimized
                            className="object-contain object-center p-2"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent" />
                        </div>
                      </motion.div>

                      <motion.h1
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-display text-3xl sm:text-5xl md:text-8xl leading-[0.9]"
                      >
                        {featuredComic.title}
                      </motion.h1>

                      <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="max-w-xl text-base md:text-lg text-white/60 line-clamp-3"
                      >
                        {featuredComic.description}
                      </motion.p>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex flex-wrap gap-3 pt-4"
                      >
                        <Link href={featuredComic.href} className="group flex items-center gap-3 rounded-2xl bg-white px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-black transition-all hover:bg-[#ff5a1f] hover:text-white">
                          Start Reading
                          <Play size={16} fill="currentColor" className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </Link>
                        <button className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-white backdrop-blur-md transition-all hover:bg-white/10">
                          Add to Library
                        </button>
                      </motion.div>
                    </div>

                    {/* Featured Card Side */}
                    <div className="hidden lg:block">
                      <motion.div
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="perspective-container relative h-[450px] w-full"
                      >
                        <div className="perspective-card relative h-full w-full overflow-hidden rounded-[2rem] border border-white/20 shadow-2xl">
                          <Image
                            src={featuredComic.coverUrl}
                            alt="Cover"
                            fill
                            priority
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      </motion.div>
                    </div>

                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {/* --- EXPLORE SECTION --- */}
        <section className="relative z-20 -mt-16 container mx-auto px-4 md:px-8 pb-32">

          {/* --- EXPLORE & DISCOVERY CONTROLS --- */}
          <div className="mb-20 flex flex-col gap-10 max-w-6xl mx-auto">

            {/* 1. Category Navigation Layer */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 px-2">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ff5a1f]">01_Explore_Archives</span>
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
                        filteredItems.map((comic, i) => (
                          <motion.article
                            key={comic.id}
                            initial={false}
                            whileHover={{ y: -8 }}
                            transition={{ duration: 0.25, delay: i * 0.02 }}
                            className="group relative cursor-pointer"
                          >
                            <Link href={comic.href}>
                              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl transition-all duration-300 group-hover:-translate-y-2 group-hover:border-white/30 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
                                <Image
                                  src={comic.coverUrl}
                                  alt={comic.title}
                                  fill
                                  unoptimized
                                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                                <div className="absolute bottom-4 left-4 right-4 translate-y-4 space-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                  <div className="flex items-center gap-2 text-[8px] font-black text-[#ffca3a]">
                                    <Star size={10} fill="currentColor" />
                                    {comic.rating}
                                  </div>
                                  <h4 className="line-clamp-2 text-sm font-black uppercase tracking-tight text-white">{comic.title}</h4>
                                </div>

                                <div className="absolute right-3 top-3 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100">
                                  READ NOW
                                </div>
                              </div>
                            </Link>
                          </motion.article>
                        ))
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
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-8 bg-[#ff4d00] rounded-full" />
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight italic">Discover More</h2>
                <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.3em]">Endless content stream</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
              {infiniteItems.map((comic, idx) => (
                <motion.div
                  key={`${comic.id}-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (idx % 6) * 0.1 }}
                >
                  <Link href={comic.href || `/library/${comic.source}/${comic.id}`} className="group block">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-white/5 transition-all duration-500 group-hover:border-[#ff4d00]/30 group-hover:shadow-[0_20px_50px_rgba(255,77,0,0.15)] group-hover:-translate-y-2">
                      <Image
                        src={comic.coverUrl || '/logo.png'}
                        alt={comic.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="text-[9px] font-black uppercase tracking-widest text-[#ff4d00] mb-1">{comic.meta}</div>
                        <div className="text-xs font-bold text-white line-clamp-1">{comic.title}</div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
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
