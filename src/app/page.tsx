'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  Clock, 
  Search, 
  Flame, 
  TrendingUp, 
  LayoutGrid,
  Star,
  Play
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  appendMangaDexFilters,
  buildMangaDexCoverUrl,
  MANGADEX_LONG_STRIP_TAG_ID,
  pickMangaDexCoverFileName,
} from '@/lib/mangadex';
import {
  getMangaDexTranslatedLanguages,
  resolveMangaDexLocalizedText,
  MANGA_LANGUAGE_OPTIONS,
  MangaLanguage,
  readStoredMangaLanguage,
  persistStoredMangaLanguage,
} from '@/lib/manga-language';

// --- Types ---
type ComicSource = 'mangadex' | 'marvel';
type ShelfKey = 'featured' | 'manga-hub' | 'webtoons' | 'manhwa' | 'marvel' | 'trending';

interface LibraryComic {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
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
    key: 'manga-hub',
    title: 'Manga Hub',
    subtitle: 'Popular Japanese narratives',
    icon: <LayoutGrid className="text-pink-500" size={18} />,
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
  {
    key: 'marvel',
    title: 'Marvel Universe',
    subtitle: 'Western superhero classics',
    icon: <Flame className="text-red-500" size={18} />,
  },
];

// --- Helpers ---
const safeText = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;

// --- API Loaders ---
const loadMangaDexShelf = async (options: {
  includedTagIds?: string[];
  excludedTagIds?: string[];
  originalLanguages?: string[];
  limit?: number;
  language: MangaLanguage;
}): Promise<LibraryComic[]> => {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 12));
  params.set('offset', '0');
  params.set('order[followedCount]', 'desc');
  params.append('includes[]', 'cover_art');

  appendMangaDexFilters(params, {
    contentRatings: ['safe', 'suggestive'],
    includedTagIds: options.includedTagIds,
    excludedTagIds: options.excludedTagIds,
    originalLanguages: options.originalLanguages,
    translatedLanguages: getMangaDexTranslatedLanguages(options.language),
  });

  try {
    const res = await fetch(`/api/proxy/mangadex?path=${encodeURIComponent(`manga?${params.toString()}`)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];
    return items.map((item: { id: string; attributes?: { title: Record<string, string>; description: Record<string, string>; status?: string }; relationships: { type: string; attributes?: { name?: string } }[] }) => {
      const coverFileName = pickMangaDexCoverFileName(item.relationships);
      return {
        id: item.id,
        title: resolveMangaDexLocalizedText(item.attributes?.title, options.language) || safeText(Object.values(item.attributes?.title || {})[0], 'Untitled'),
        description: resolveMangaDexLocalizedText(item.attributes?.description, options.language) || 'Catalog entry',
        coverUrl: coverFileName ? buildMangaDexCoverUrl(item.id, coverFileName) : '/logo.png',
        source: 'mangadex',
        href: `/library/mangadex/${item.id}`,
        meta: item.attributes?.status?.toUpperCase() || 'MANGA',
        rating: (Math.random() * 2 + 3).toFixed(1), // Mock rating
      };
    }).filter((c: { id: string; title: string }) => c.id && c.title);
  } catch { return []; }
};

const loadMarvelShelf = async (): Promise<LibraryComic[]> => {
  try {
    const res = await fetch('/api/marvel/issues?limit=12&offset=0', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    
    // Fetch details for each item to get covers
    const detailedItems = await Promise.all(
      items.map(async (item: { id: string }) => {
        try {
          const detailRes = await fetch(`/api/marvel/issues/${item.id}`, { cache: 'force-cache' });
          if (!detailRes.ok) return null;
          const detail = await detailRes.json();
          const issue = detail?.data?.results?.[0] || detail?.items?.[0] || detail;
          
          if (!issue) return null;

          const path = issue.cover?.path || issue.thumbnail?.path;
          const ext = issue.cover?.extension || issue.thumbnail?.extension;
          const coverUrl = path && ext 
            ? `${path.replace('http://', 'https://')}/portrait_uncanny.${ext}` 
            : '/logo.png';

          return {
            id: String(issue.id),
            title: issue.title || `Issue ${issue.issueNumber}`,
            description: issue.seriesName || 'Marvel Metadata',
            coverUrl,
            source: 'marvel' as const,
            href: `/library/marvel/${issue.id}`,
            meta: issue.issueNumber ? `ISSUE ${issue.issueNumber}` : 'MARVEL',
            rating: '4.8',
          };
        } catch { return null; }
      })
    );

    return detailedItems.filter((c): c is LibraryComic => c !== null && !!c.id && !!c.title);
  } catch { return []; }
};

export default function Home() {
  const [shelfState, setShelfState] = useState<Record<string, { items: LibraryComic[]; loading: boolean }>>({
    'manga-hub': { items: [], loading: true },
    webtoons: { items: [], loading: true },
    manhwa: { items: [], loading: true },
    marvel: { items: [], loading: true },
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ShelfKey>('manga-hub');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>('en');
  const [now] = useState(() => new Date());

  useEffect(() => {
    const saved = readStoredMangaLanguage();
    if (saved !== mangaLanguage) setMangaLanguage(saved);
  }, []);

  const fetchShelves = async (lang: MangaLanguage) => {
    setShelfState(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(key => newState[key].loading = true);
      return newState;
    });

    const [manga, webtoons, manhwa, marvel] = await Promise.all([
      loadMangaDexShelf({ originalLanguages: ['ja'], limit: 12, language: lang }),
      loadMangaDexShelf({ includedTagIds: [MANGADEX_LONG_STRIP_TAG_ID], limit: 12, language: lang }),
      loadMangaDexShelf({ originalLanguages: ['ko'], excludedTagIds: [MANGADEX_LONG_STRIP_TAG_ID], limit: 12, language: lang }),
      loadMarvelShelf(),
    ]);

    setShelfState({
      'manga-hub': { items: manga, loading: false },
      webtoons: { items: webtoons, loading: false },
      manhwa: { items: manhwa, loading: false },
      marvel: { items: marvel, loading: false },
    });
  };

  useEffect(() => {
    void fetchShelves(mangaLanguage);
  }, [mangaLanguage]);

  const handleLanguageChange = (newLang: MangaLanguage) => {
    setMangaLanguage(newLang);
    persistStoredMangaLanguage(newLang);
  };

  const featuredComic = useMemo(() => {
    const pool = shelfState[activeTab]?.items || [];
    if (!pool.length) return null;
    return pool[now.getHours() % pool.length];
  }, [activeTab, shelfState, now]);

  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      <Navbar />

      <main className="relative pt-20">
        
        {/* --- DYNAMIC HERO BANNER --- */}
        <section className="relative min-h-[70vh] md:min-h-[85vh] w-full">
          <AnimatePresence mode="wait">
            {featuredComic && (
              <motion.div 
                key={featuredComic.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="relative min-h-[70vh] md:min-h-[85vh] w-full"
              >
                <Image 
                  src={featuredComic.coverUrl} 
                  alt={featuredComic.title} 
                  fill 
                  priority
                  unoptimized
                  className="object-cover opacity-40 blur-[2px]" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-[#05060a]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#05060a] via-transparent to-transparent" />
                
                <div className="container relative z-10 mx-auto flex h-full items-center px-4 md:px-8 py-20">
                  <div className="grid w-full gap-12 lg:grid-cols-[1fr_320px]">
                    
                    {/* Text Info */}
                    <div className="space-y-6">
                      <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-3"
                      >
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#ffca3a] backdrop-blur-md">
                          Trending Now
                        </span>
                        <div className="flex items-center gap-1 text-[#ffca3a]">
                           <Star size={14} fill="currentColor" />
                           <span className="text-sm font-black">{featuredComic.rating}</span>
                        </div>
                      </motion.div>

                      <motion.h1 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-display text-3xl sm:text-5xl md:text-8xl leading-[0.9]"
                      >
                        {featuredComic.title}
                      </motion.h1>

                      <motion.p 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="max-w-xl text-base md:text-lg text-white/60 line-clamp-3"
                      >
                        {featuredComic.description}
                      </motion.p>

                      <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.6 }}
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
                         transition={{ delay: 0.4 }}
                         className="perspective-container relative h-[450px] w-full"
                       >
                         <div className="perspective-card h-full w-full overflow-hidden rounded-[2rem] border border-white/20 shadow-2xl">
                            <Image 
                              src={featuredComic.coverUrl} 
                              alt="Cover" 
                              fill 
                              unoptimized
                              className="object-cover" 
                            />
                         </div>
                       </motion.div>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}
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
                 {SHELVES.map((shelf) => (
                   <button
                     key={shelf.key}
                     onClick={() => setActiveTab(shelf.key)}
                     className={`relative flex items-center gap-3 md:gap-4 rounded-full px-5 md:px-8 py-3 md:py-4 transition-all duration-500 whitespace-nowrap ${
                       activeTab === shelf.key 
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
            {Object.values(shelfState).every(s => s.items.length > 0) && 
             SHELVES.every(s => shelfState[s.key]?.items.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) && 
             searchQuery && (
              <div className="py-20 text-center">
                 <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/5 mb-6 text-white/20">
                    <Search size={40} />
                 </div>
                 <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-2">No results found</h3>
                 <p className="text-white/40">We couldn&apos;t find any comics matching &quot;{searchQuery}&quot;</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {SHELVES.filter(s => searchQuery ? true : s.key === activeTab).map((shelf) => {
                const state = shelfState[shelf.key];
                if (!state) return null;
                
                const filteredItems = state.items.filter(comic => 
                  comic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  comic.description.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (searchQuery && filteredItems.length === 0) return null;
                
                return (
                  <motion.div 
                    key={shelf.key}
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
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.05 }}
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

      </main>
      
      {/* Footer minimal */}
      <footer className="border-t border-white/10 py-12 text-center">
         <div className="container mx-auto px-4">
            <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">
               iComics // Sequential Narrative Archive 2026
            </div>
         </div>
      </footer>
    </div>
  );
}
