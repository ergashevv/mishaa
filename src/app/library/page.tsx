"use client";

import React, { Suspense, useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Search, X, ChevronLeft, ChevronRight, 
  Loader2, Maximize2, Minimize2, List, Eye, EyeOff,
  ZoomIn, ZoomOut, Columns, FileText, Sparkles, TrendingUp, Clock, Star, Shuffle, Globe, Flag
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import {
  BooruSource,
  booruDisplayLabel,
  getBooruDefaultQuery,
  mapBooruSearchResults,
} from '@/lib/booru';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';
import { 
  DEFAULT_MANGA_LANGUAGE,
  MANGA_LANGUAGE_OPTIONS,
  MangaLanguage,
  getMangaDexTranslatedLanguages,
  persistStoredMangaLanguage,
  resolveMangaDexLocalizedText,
  readStoredMangaLanguage,
} from '@/lib/manga-language';
import {
  appendMangaDexFilters,
  buildMangaDexCoverUrl,
  MANGADEX_LONG_STRIP_TAG_ID,
  pickMangaDexCoverFileName,
} from '@/lib/mangadex';
import { searchComics, getChapters, getChapterPages } from '@/actions/comic';
interface Comic {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  rating: string;
  source: 'mangadex' | 'archive' | 'nhentai' | 'marvel' | BooruSource;
  issueNumber?: string;
  seriesName?: string;
  onSaleDate?: string;
  yearPage?: number;
  detailUrl?: string;
  pageCount?: number;
  creators?: { id: number; name: string; role: string }[];
}

interface MarvelIssueSummary {
  id: number | string;
  title?: string;
  issueNumber?: string;
  seriesName?: string;
  onSaleDate?: string;
  yearPage?: number;
  detailUrl?: string;
  pageCount?: number;
  cover?: {
    path?: string;
    extension?: string;
  };
}

type Category = {
  label: string;
  query?: string;
  source: Comic['source'];
  nsfw?: boolean;
  ratings?: string[];
  originalLanguages?: string[];
  includedTagIds?: string[];
  excludedTagIds?: string[];
};

type LoadResult = {
  items: Comic[];
  hasMore: boolean;
};

const CATEGORIES: Category[] = [
  { label: 'Marvel Universe', source: 'marvel' },
  { label: 'Manga Hub', source: 'mangadex', originalLanguages: ['ja'] },
  { label: 'Webtoons', source: 'mangadex', includedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] },
  { label: 'Manhwa', source: 'mangadex', originalLanguages: ['ko'], excludedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] },
  { label: 'Doujinshi', query: 'all', nsfw: true, source: 'nhentai' },
  { label: 'New Doujinshi', query: 'language:english', nsfw: true, source: 'nhentai' },
  { label: 'Hentai', source: 'mangadex', nsfw: true, ratings: ['pornographic'] },
  { label: 'Erotica', source: 'mangadex', nsfw: true, ratings: ['erotica'] },
  { label: 'e621', source: 'e621', nsfw: true, query: getBooruDefaultQuery('e621') },
  { label: 'Danbooru', source: 'danbooru', nsfw: true, query: getBooruDefaultQuery('danbooru') },
  { label: 'Gelbooru', source: 'gelbooru', nsfw: true, query: getBooruDefaultQuery('gelbooru') },
];

const LIMIT = 36;
const MARVEL_COVER_PREFETCH_COUNT = 12;
const MARVEL_COVER_FETCH_RETRIES = 2;

const createCategoryQueryMap = () =>
  Object.fromEntries(CATEGORIES.map((category) => [category.label, category.query ?? ''])) as Record<string, string>;

const getCategoryByLabel = (label: string | null) => CATEGORIES.find((category) => category.label === label);

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeMarvelCover = (cover?: { path?: string; extension?: string }) => {
  if (!cover?.path || !cover.extension) return '';
  return `${String(cover.path).replace(/^http:\/\//, 'https://')}.${cover.extension}`;
};

const fetchMangaDexProxy = (path: string) =>
  fetch(`/api/proxy/mangadex?path=${encodeURIComponent(path)}`, {
    cache: 'no-store',
  });

const fetchArchiveProxy = (action: 'search' | 'metadata' | 'cover' | 'page', params: Record<string, string>) => {
  const searchParams = new URLSearchParams({ action, ...params });
  return fetch(`/api/proxy/archive?${searchParams.toString()}`, {
    cache: 'no-store',
  });
};

const resolveMangaDexCoverUrl = async (mangaId: string, coverFileName?: string | null) => {
  if (coverFileName) {
    return buildMangaDexCoverUrl(mangaId, coverFileName);
  }

  const res = await fetchMangaDexProxy(`manga/${mangaId}?includes[]=cover_art`);
  if (!res.ok) return '/logo.png';

  const data = await res.json();
  const cover = pickMangaDexCoverFileName(data?.data?.relationships);
  return cover
    ? buildMangaDexCoverUrl(mangaId, cover)
    : '/logo.png';
};

const fetchBooruProxy = (source: BooruSource, kind: 'search' | 'post', params: Record<string, string>) => {
  const searchParams = new URLSearchParams({ source, kind, ...params });
  return fetch(`/api/proxy/booru?${searchParams.toString()}`, {
    cache: 'no-store',
  });
};

const fetchDanbooruDirect = (kind: 'search' | 'post', params: Record<string, string>) =>
  fetchBooruProxy('danbooru', kind, params);

function ComicLibrary() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialCategory = getCategoryByLabel(searchParams.get('tab'))?.label ?? 'Marvel Universe';
  const initialCategoryQueries = createCategoryQueryMap();
  initialCategoryQueries[initialCategory] = searchParams.get('q') ?? initialCategoryQueries[initialCategory] ?? '';

  const [comics, setComics] = useState<Comic[]>([]);
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [categoryQueries, setCategoryQueries] = useState<Record<string, string>>(() => initialCategoryQueries);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reading, setReading] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'webtoon' | 'spread'>('single');
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const savedLang = readStorageItem('lang') as Lang;
    return savedLang && translations[savedLang] ? savedLang : 'en';
  });
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const t_lib = (translations[lang] as any).library;
  const requestIdRef = useRef(0);
  const skipNextOffsetFetchRef = useRef(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const searchQuery = categoryQueries[activeCategory] ?? '';

  useEffect(() => {
    const verified = readAgeVerification();
    const timer = window.setTimeout(() => {
      setIsAgeVerified(verified);
      setNsfwEnabled(verified);
    }, 0);
    if (verified) persistAgeVerification();
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      setLang(savedLang);
    }

    const handleLang = (e: Event) => {
      const nextLang = (e as CustomEvent<Lang>).detail;
      if (translations[nextLang]) {
        setLang(nextLang);
      }
    };

    window.addEventListener('langChange', handleLang as EventListener);
    return () => window.removeEventListener('langChange', handleLang as EventListener);
  }, []);

  useEffect(() => {
    persistStoredMangaLanguage(mangaLanguage);
  }, [mangaLanguage]);

  const updateLibraryUrl = useCallback((tab: string, query: string, mode: 'push' | 'replace') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (query.trim()) params.set('q', query.trim());
    else params.delete('q');

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    if (mode === 'push') {
      router.push(nextUrl, { scroll: false });
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const handleAgeVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setNsfwEnabled(true);
    setShowAgeGate(false);
  };

  const handleCategoryChange = useCallback((category: Category) => {
    if (category.nsfw && !isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    const nextQuery = categoryQueries[category.label] ?? category.query ?? '';
    requestIdRef.current += 1;
    setSelectedComic(null);
    setActiveCategory(category.label);
    setOffset(0);
    setHasMore(true);
    setComics([]);
    updateLibraryUrl(category.label, nextQuery, 'push');
  }, [categoryQueries, isAgeVerified, updateLibraryUrl]);

  const handleSearchQueryChange = useCallback((value: string) => {
    requestIdRef.current += 1;
    setOffset(0);
    setHasMore(true);
    setComics([]);
    setCategoryQueries((prev) => ({
      ...prev,
      [activeCategory]: value,
    }));
    updateLibraryUrl(activeCategory, value, 'replace');
  }, [activeCategory, updateLibraryUrl]);

  const handleNsfwToggle = useCallback(() => {
    if (!isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    requestIdRef.current += 1;
    setOffset(0);
    setHasMore(true);
    setComics([]);
    setNsfwEnabled((value) => !value);
  }, [isAgeVerified]);

  const lastComicRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setOffset(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  // Fetch from MangaDex
  const fetchMangaDex = useCallback(async (
    query: string,
    currentOffset: number,
    ratingsOverride?: string[],
    originalLanguages?: string[],
    includedTagIds?: string[],
    excludedTagIds?: string[],
    translatedLanguage?: MangaLanguage
  ): Promise<LoadResult> => {
    return searchComics({
      source: 'mangadex',
      query,
      page: currentOffset,
      mangaLanguage: translatedLanguage,
      ratings: ratingsOverride,
      originalLanguages,
      includedTagIds,
      excludedTagIds
    }) as Promise<LoadResult>;
  }, []);


  // Fetch from Archive.org
  const fetchArchive = useCallback(async (query: string, page: number): Promise<LoadResult> => {
    return searchComics({ source: 'archive', query, page }) as Promise<LoadResult>;
  }, []);


  // Fetch from nhentai
  const fetchNHentai = useCallback(async (query: string, page: number): Promise<LoadResult> => {
    try {
      const path = (query === 'all' || !query) 
        ? `galleries?page=${page + 1}` 
        : `search?query=${encodeURIComponent(query)}&page=${page + 1}`;
        
      const res = await fetch(`/api/proxy/nhentai?path=${encodeURIComponent(path)}`);
      if (!res.ok) return { items: [], hasMore: false };
      const data = await res.json();
      const results = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
      const numPages = Number(data?.num_pages ?? 0);

      return {
        items: results.map((item: any) => {
        return {
          id: item.id.toString(),
          title: item.english_title || item.title?.english || item.title?.japanese || "Untitled",
          description: `${item.num_pages} pages`,
          coverUrl: item.thumbnail?.path || item.thumbnail
            ? `/api/proxy/nhentai/image?path=${encodeURIComponent(item.thumbnail?.path || item.thumbnail)}`
            : '/logo.png',
          source: 'nhentai',
          rating: 'pornographic'
        };
        }),
        hasMore: Number.isFinite(numPages) && numPages > 0 ? page + 1 < numPages : results.length > 0,
      };
    } catch (e) {
      console.error(e);
      return { items: [], hasMore: false };
    }
  }, []);

  const fetchBooru = useCallback(async (
    source: BooruSource,
    query: string,
    page: number
  ): Promise<LoadResult> => {
    try {
      const normalizedQuery = query.trim() || getBooruDefaultQuery(source);
      const res = source === 'danbooru'
        ? await fetchDanbooruDirect('search', {
            limit: LIMIT.toString(),
            page: String(page),
            query: normalizedQuery,
          })
        : await fetchBooruProxy(source, 'search', {
            limit: LIMIT.toString(),
            page: String(page),
            query: normalizedQuery,
          });

      if (!res.ok) return { items: [], hasMore: false };

      const data = await res.json();
      const items = mapBooruSearchResults(source, data).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || item.tags.slice(0, 12).join(', ') || `${booruDisplayLabel(source)} post`,
        coverUrl: item.coverUrl,
        source,
        rating: item.rating,
      }));

      return {
        items,
        hasMore: items.length === LIMIT,
      };
    } catch (error) {
      console.error(error);
      return { items: [], hasMore: false };
    }
  }, []);

  const fetchMarvelIssues = useCallback(async (query: string, currentOffset: number): Promise<LoadResult> => {
    return searchComics({ source: 'marvel', query, page: currentOffset }) as Promise<LoadResult>;
  }, []);


  const loadData = useCallback(async (pageIndex: number = 0, append: boolean = false) => {
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const cat = CATEGORIES.find(c => c.label === activeCategory);
      const query = searchQuery.trim();
      const safeMarvelQuery = query;
      
      const canAccessAdultContent = isAgeVerified;
      const defaultRatings = canAccessAdultContent ? ['safe', 'suggestive', 'erotica', 'pornographic'] : ['safe', 'suggestive'];
      let result: LoadResult = { items: [], hasMore: false };

      if (query) {
        if (cat?.source === 'marvel') {
          result = await fetchMarvelIssues(safeMarvelQuery, pageIndex);
        } else if (cat?.source === 'e621' || cat?.source === 'danbooru' || cat?.source === 'gelbooru') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await fetchBooru(cat.source, query, pageIndex);
        } else {
          // Global search: search all sources
          const nhentaiSearch = canAccessAdultContent ? fetchNHentai(query, pageIndex) : Promise.resolve<LoadResult>({ items: [], hasMore: false });
          const booruSearches = canAccessAdultContent
            ? [
                fetchBooru('e621', query, pageIndex),
                fetchBooru('danbooru', query, pageIndex),
                fetchBooru('gelbooru', query, pageIndex),
              ]
            : [];

          const [mdResults, arcResults, nhResults, ...booruResults] = await Promise.all([
            fetchMangaDex(query, pageIndex, defaultRatings, undefined, undefined, undefined, mangaLanguage),
            fetchArchive(query, pageIndex),
            nhentaiSearch,
            ...booruSearches,
          ]);

          const combinedItems = [
            ...mdResults.items,
            ...arcResults.items,
            ...nhResults.items,
            ...booruResults.flatMap((result) => result.items),
          ].sort((a, b) => a.title.localeCompare(b.title));
          result = {
            items: combinedItems,
            hasMore: mdResults.hasMore || arcResults.hasMore || nhResults.hasMore || booruResults.some((r) => r.hasMore),
          };
        }
      } else {
        const source = cat?.source || 'mangadex';
        const catQuery = cat?.query || '';
        
        if (source === 'mangadex') {
          result = await fetchMangaDex(
            catQuery,
            pageIndex,
            cat?.ratings || defaultRatings,
            cat?.originalLanguages,
            cat?.includedTagIds,
            cat?.excludedTagIds,
            mangaLanguage
          );
        } else if (source === 'nhentai') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await fetchNHentai(catQuery, pageIndex);
        } else if (source === 'e621' || source === 'danbooru' || source === 'gelbooru') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await fetchBooru(source, catQuery, pageIndex);
        } else if (source === 'marvel') {
          result = await fetchMarvelIssues(safeMarvelQuery, pageIndex);
        } else {
          result = await fetchArchive(catQuery, pageIndex);
        }
      }

      if (requestId !== requestIdRef.current) return;

      let results = result.items;
      if (!canAccessAdultContent) {
        results = results.filter((comic) => !isAdultComic(comic));
      }

      setHasMore(result.hasMore && results.length > 0);
      setComics(prev => append ? [...prev, ...results] : results);
    } catch (e) { 
      if (requestId !== requestIdRef.current) return;
      console.error(e); 
      if (!append) setComics([]);
    } finally { 
      if (requestId === requestIdRef.current) {
        setLoading(false); 
        setLoadingMore(false);
      }
    }
  }, [activeCategory, fetchArchive, fetchBooru, fetchMangaDex, fetchMarvelIssues, fetchNHentai, isAgeVerified, mangaLanguage, searchQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadData(0, false);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [activeCategory, searchQuery, nsfwEnabled, mangaLanguage, loadData]);

  useEffect(() => {
    // Infinite scroll advances the page index and fetches the next batch.
    if (skipNextOffsetFetchRef.current) {
      skipNextOffsetFetchRef.current = false;
      return;
    }
    if (offset > 0) loadData(offset, true);
  }, [offset, loadData]);

  const fetchPages = async (comic: Comic) => {
    if (isAdultComic(comic) && !isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    setReading(true);
    setPages([]);
    try {
      // Use existing server action to get chapters first, then pages
      const chapters = await getChapters(comic.source, comic.id, mangaLanguage);
      if (!chapters || chapters.length === 0) throw new Error("No chapters found");
      
      const chapterPages = await getChapterPages(comic.source, comic.id, chapters[0].id);
      if (!chapterPages || chapterPages.length === 0) throw new Error("No pages found");
      
      setPages(chapterPages);
      setCurrentPage(0);
      setSelectedComic(comic);
    } catch (e) { 
      console.error(e);
      alert("Could not load pages. This source might be restricted or formatted differently."); 
      setSelectedComic(null); 
    } finally { 
      setReading(false); 
    }
  };


  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedComic || viewMode !== 'single') return;
      if (e.key === 'ArrowLeft') setCurrentPage(p => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setCurrentPage(p => Math.min(pages.length - 1, p + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComic, viewMode, pages.length]);

  return (
    <div className="min-h-screen bg-[#020202] text-white">
      {/* Age Gate */}
      <AnimatePresence>
        {showAgeGate && (
          <AgeGateOverlay
            title={t_lib.restricted}
            description={t_lib.ageDesc}
            confirmLabel={t_lib.verifyBtn}
            cancelLabel={t_lib.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => setShowAgeGate(false)}
            zIndex={10000}
          />
        )}
      </AnimatePresence>

      {!selectedComic && (
        <div className="px-4 py-6 md:p-16">
          <header className="max-w-7xl mx-auto mb-16">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <button
                  onClick={() => router.push('/')}
                  className="inline-flex w-full items-center justify-center gap-3 border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white/70 hover:bg-white/10 hover:text-white transition-all md:w-auto"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>

                <div className="hidden md:flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.45em] text-white/25">
                  <div className="h-[2px] w-16 bg-[#ff4d00]" />
                  <span>Library Vault</span>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                  <div className="flex items-center gap-2 px-4 py-3 border border-white/10 bg-white/5">
                    <Globe size={14} className="text-[#ff4d00]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40">Manga Language</span>
                  </div>
                  <select
                    value={mangaLanguage}
                    onChange={(e) => setMangaLanguage(e.target.value as MangaLanguage)}
                    className="w-full bg-[#0a0a0a] border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-[#ff4d00] md:min-w-[220px] md:w-auto"
                  >
                    {MANGA_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <button onClick={() => {
                  const randomOffset = Math.floor(Math.random() * 10);
                  skipNextOffsetFetchRef.current = true;
                  setOffset(randomOffset);
                  loadData(randomOffset, false);
                }} className="h-12 w-full flex items-center justify-center border border-white/10 text-white/20 hover:bg-[#ff4d00] hover:text-white transition-all md:h-16 md:w-16">
                  <Shuffle size={20} />
                </button>
                <div className="relative flex-1 md:w-96">
                  <input type="text" placeholder="SEARCH_GLOBAL_ARCHIVES..." className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 text-[11px] font-black uppercase focus:border-[#ff4d00] transition-all outline-none md:py-5 md:px-12" value={searchQuery} onChange={e => handleSearchQueryChange(e.target.value)} />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                </div>
                <button onClick={handleNsfwToggle} className={`h-12 w-full flex items-center justify-center border transition-all md:h-16 md:w-16 ${nsfwEnabled ? 'bg-red-600 border-red-600' : 'border-white/10 text-white/20'}`}>
                  {isMounted && nsfwEnabled ? <Eye /> : <EyeOff />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 pt-6 border-t border-white/5 md:flex-wrap md:overflow-visible md:gap-3 md:pb-0">
              {CATEGORIES.map(cat => (
                <button 
                  key={cat.label} 
                  onClick={() => handleCategoryChange(cat)} 
                  className={`shrink-0 whitespace-nowrap px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition-all md:px-6 md:py-3 ${activeCategory === cat.label ? 'bg-[#ff4d00] border-[#ff4d00] text-white' : 'border-white/10 text-white/30 hover:border-white/80'}`}
                >
                  {cat.source === 'archive' && <Flag size={10} className="inline mr-2" />}
                  {cat.source === 'marvel' && <BookOpen size={10} className="inline mr-2" />}
                  {(cat.source === 'e621' || cat.source === 'danbooru' || cat.source === 'gelbooru') && <Sparkles size={10} className="inline mr-2" />}
                  {cat.label}
                </button>
              ))}
            </div>
          </header>

          {loading ? (
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 md:gap-x-10 md:gap-y-20">
              {[...Array(12)].map((_, i) => <ComicSkeleton key={i} />)}
            </div>
          ) : comics.length === 0 ? (
             <div className="max-w-7xl mx-auto py-40 text-center">
                <Sparkles className="w-12 h-12 text-white/5 mx-auto mb-6" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.8em] text-white/20">Empty_Archive_Detected</h3>
             </div>
          ) : (
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 md:gap-x-10 md:gap-y-20">
              {comics.map((comic, index) => (
                <motion.div 
                  ref={comics.length === index + 1 ? lastComicRef : null}
                  key={`${comic.source}:${comic.id}`} 
                  whileHover={{ y: -20, scale: 1.05 }}
                  onClick={() => {
                    if (isAdultComic(comic) && !isAgeVerified) {
                      setShowAgeGate(true);
                      return;
                    }
                    router.push(`/library/${comic.source}/${comic.id}`);
                  }}
                  className="relative group cursor-pointer"
                >
                  <div className="aspect-[2/3] border border-white/5 bg-[#0a0a0a] overflow-hidden relative shadow-[0_40px_80px_rgba(0,0,0,0.8)]">
                    {comic.source === 'marvel' ? (
                      comic.coverUrl ? (
                        <img
                          src={comic.coverUrl}
                          className="w-full h-full object-cover opacity-100 transition-all duration-700"
                          alt={comic.title}
                        />
                      ) : (
                        <div className="w-full h-full relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,77,0,0.3),_transparent_45%),linear-gradient(180deg,#171717_0%,#060606_100%)]">
                          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                          <div className="absolute inset-0 flex flex-col justify-between p-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2 py-1 text-[7px] font-black uppercase tracking-[0.35em] bg-white text-black">MARVEL</span>
                              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/35">{comic.yearPage || '----'}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#ff4d00]">Issue {comic.issueNumber || '?'}</div>
                              <div className="text-xl font-black uppercase leading-[0.9] tracking-tighter text-white line-clamp-3">{comic.title}</div>
                              <div className="text-[8px] uppercase tracking-[0.28em] text-white/35 line-clamp-2">{comic.seriesName || comic.description}</div>
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <img src={comic.coverUrl} className="w-full h-full object-cover opacity-100 transition-all duration-700" alt={comic.title} />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent flex items-center justify-between">
                       <span className="text-[7px] font-black uppercase tracking-widest text-[#ff4d00]">{comic.source}</span>
                       {comic.source === 'marvel' ? (
                         <span className="text-[6px] font-black uppercase tracking-[0.35em] text-white/40">{comic.onSaleDate ? formatMarvelDate(comic.onSaleDate) : 'Metadata only'}</span>
                       ) : (
                         isAdultComic(comic) && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[6px] font-black uppercase">18+</span>
                       )}
                    </div>
                  </div>
                  <h3 className="mt-6 text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:text-white leading-relaxed line-clamp-2">{comic.title}</h3>
                  {comic.source === 'marvel' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 border border-white/10 text-[7px] font-black uppercase tracking-[0.25em] text-white/45">#{comic.issueNumber || '?'}</span>
                      <span className="px-2 py-1 border border-white/10 text-[7px] font-black uppercase tracking-[0.25em] text-white/45">{comic.pageCount ? `${comic.pageCount} p.` : 'No pages'}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {loadingMore && (
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 md:gap-x-10 md:gap-y-20 mt-20">
              {[...Array(6)].map((_, i) => <ComicSkeleton key={i} />)}
            </div>
          )}
        </div>
      )}

      {/* PRO READER */}
      <AnimatePresence>
        {selectedComic && (
          <motion.div ref={readerRef} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 z-[5000] bg-black flex flex-col">
             <div className="h-20 bg-black border-b border-white/10 flex items-center justify-between px-8 max-md:h-auto max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:px-3 max-md:py-3">
                <div className="flex items-center gap-4 max-md:justify-between max-md:gap-3">
                  <button onClick={() => setSelectedComic(null)} className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-red-600 max-md:w-9 max-md:h-9"><X /></button>
                  <div className="hidden md:block">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 max-w-xs truncate">{selectedComic.title}</h4>
                  </div>
                </div>

                <div className="flex w-full flex-wrap justify-center bg-white/5 p-1 border border-white/10 rounded-full max-md:justify-between max-md:rounded-2xl max-md:p-1.5">
                  <button onClick={() => setViewMode('single')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-full transition-all max-md:px-3 max-md:py-2 ${viewMode === 'single' ? 'bg-[#ff4d00]' : 'text-white/20 hover:text-white'}`}>Single</button>
                  <button onClick={() => setViewMode('spread')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-full transition-all max-md:px-3 max-md:py-2 ${viewMode === 'spread' ? 'bg-[#ff4d00]' : 'text-white/20 hover:text-white'}`}>Journal</button>
                  <button onClick={() => setViewMode('webtoon')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-full transition-all max-md:px-3 max-md:py-2 ${viewMode === 'webtoon' ? 'bg-[#ff4d00]' : 'text-white/20 hover:text-white'}`}>Vertical</button>
                </div>

                <div className="flex items-center gap-4 max-md:w-full max-md:justify-between">
                   <button 
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        readerRef.current?.requestFullscreen();
                      } else {
                        document.exitFullscreen();
                      }
                    }}
                    className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 max-md:w-9 max-md:h-9"
                   >
                     <Maximize2 size={16} />
                   </button>
                   <div className="hidden md:flex items-center gap-2 mr-4">
                      <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="w-8 h-8 hover:bg-white/5 flex items-center justify-center"><ZoomOut size={14}/></button>
                      <span className="text-[8px] font-black text-white/20 w-8 text-center">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="w-8 h-8 hover:bg-white/5 flex items-center justify-center"><ZoomIn size={14}/></button>
                   </div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-[#ff4d00]">
                      {currentPage + 1} <span className="text-white/20">/</span> {pages.length}
                   </div>
                </div>
             </div>

             <div className="flex-1 overflow-auto bg-[#050505] custom-scrollbar relative">
                {reading ? (
                  <ReaderSkeleton />
                ) : (
                  <div className={`mx-auto h-full flex items-center justify-center ${viewMode === 'webtoon' ? 'max-w-4xl py-10 px-4' : 'p-6'}`}>
                    {viewMode === 'single' ? (
                       <div className="relative h-full w-full flex items-center justify-center group">
                          {/* Navigation Zones */}
                          <div 
                            className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer flex items-center justify-start p-8 opacity-0 group-hover:opacity-100 transition-opacity max-md:hidden"
                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                          >
                             <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-full backdrop-blur-sm">
                                <ChevronLeft className={currentPage === 0 ? 'text-white/10' : 'text-white'} />
                             </div>
                          </div>
                          
                          <div 
                            className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer flex items-center justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity max-md:hidden"
                            onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
                          >
                             <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-full backdrop-blur-sm">
                                <ChevronRight className={currentPage === pages.length - 1 ? 'text-white/10' : 'text-white'} />
                             </div>
                          </div>

                          <motion.img 
                            key={currentPage}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            src={pages[currentPage]} 
                            style={{ transform: `scale(${zoom})`, maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                            className="shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5" 
                          />
                       </div>
                    ) : viewMode === 'spread' ? (
                      <div className="relative h-full w-full flex items-center justify-center group">
                          <div 
                            className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer flex items-center justify-start p-8 opacity-0 group-hover:opacity-100 transition-opacity max-md:hidden"
                            onClick={() => setCurrentPage(p => Math.max(0, p - 2))}
                          >
                             <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-full backdrop-blur-sm">
                                <ChevronLeft className={currentPage === 0 ? 'text-white/10' : 'text-white'} />
                             </div>
                          </div>
                          
                          <div 
                            className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer flex items-center justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity max-md:hidden"
                            onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 2))}
                          >
                             <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-full backdrop-blur-sm">
                                <ChevronRight className={currentPage >= pages.length - 1 ? 'text-white/10' : 'text-white'} />
                             </div>
                          </div>

                          <div className="flex items-center justify-center h-full w-full max-w-7xl mx-auto">
                             {currentPage === 0 ? (
                               <motion.img 
                                 key="cover"
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 src={pages[0]} 
                                 style={{ transform: `scale(${zoom})`, maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                                 className="shadow-2xl border border-white/5 ring-1 ring-white/10" 
                               />
                             ) : (
                               <div className="flex items-center justify-center h-full w-full gap-0 bg-[#111] shadow-2xl relative">
                                 {/* Spine shadow */}
                                 <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-r from-black/40 via-black/10 to-black/40 z-20 pointer-events-none" />
                                 
                                 <motion.img 
                                   key={currentPage}
                                   initial={{ opacity: 0, x: -10 }}
                                   animate={{ opacity: 1, x: 0 }}
                                   src={pages[currentPage]} 
                                   style={{ transform: `scale(${zoom})`, height: '100%', width: '50%', objectFit: 'contain', objectPosition: 'right' }} 
                                   className="border-r border-black/20" 
                                 />
                                 {pages[currentPage + 1] && (
                                   <motion.img 
                                     key={currentPage + 1}
                                     initial={{ opacity: 0, x: 10 }}
                                     animate={{ opacity: 1, x: 0 }}
                                     src={pages[currentPage + 1]} 
                                     style={{ transform: `scale(${zoom})`, height: '100%', width: '50%', objectFit: 'contain', objectPosition: 'left' }} 
                                   />
                                 )}
                               </div>
                             )}
                          </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 items-center">
                         {pages.map((p, i) => (
                           <motion.img 
                            key={i} 
                            src={p} 
                            className="w-full h-auto mb-4 shadow-2xl" 
                            loading="lazy"
                            onViewportEnter={() => {
                              if (viewMode === 'webtoon') setCurrentPage(i);
                            }}
                            viewport={{ amount: 0.5 }}
                           />
                         ))}
                      </div>
                    )}
                  </div>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(to right, #0a0a0a 4%, #1a1a1a 25%, #0a0a0a 36%);
          background-size: 1000px 100%;
        }
      `}</style>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <ComicLibrary />
    </Suspense>
  );
}

const ComicSkeleton = () => (
  <div className="space-y-6">
    <div className="aspect-[2/3] border border-white/5 shimmer bg-[#0a0a0a]" />
    <div className="space-y-2">
      <div className="h-2 w-full shimmer bg-[#0a0a0a]" />
      <div className="h-2 w-2/3 shimmer bg-[#0a0a0a]" />
    </div>
  </div>
);

const ReaderSkeleton = () => (
  <div className="w-full max-w-4xl mx-auto space-y-8 py-10">
     <div className="aspect-[2/3] w-full shimmer bg-[#0a0a0a]" />
     <div className="aspect-[2/3] w-full shimmer bg-[#0a0a0a]" />
  </div>
);
