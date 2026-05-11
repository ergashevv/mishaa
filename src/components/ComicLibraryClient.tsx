"use client";

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LazyMotion, domMax, m, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Search, X, ChevronLeft, ChevronRight, 
  Eye, EyeOff,
  ZoomIn, ZoomOut, Sparkles, Shuffle, Globe, Flag,
  Maximize2, Loader2
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import Navbar from '@/components/Navbar';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import {
  BooruSource,
  booruDisplayLabel,
  getBooruDefaultQuery,
  mapBooruSearchResults,
} from '@/lib/booru';
import { translations, Lang } from '@/lib/translations';
import { useLibraryAgeDescription } from '@/hooks/useLibraryAgeDescription';
import { readStorageItem } from '@/lib/browser-storage';
import { 
  MANGA_LANGUAGE_OPTIONS,
  MangaLanguage,
  persistStoredMangaLanguage,
  readStoredMangaLanguage,
} from '@/lib/manga-language';
import {
  MANGADEX_GIRLS_LOVE_TAG_ID,
  MANGADEX_LONG_STRIP_TAG_ID,
} from '@/lib/mangadex';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchComicsWithClientCache as searchComics } from '@/lib/comic-search-client-cache';
import type { ComicListItem } from '@/lib/comic-types';
import Image from 'next/image';
import Link from 'next/link';
import { readBookmarks, readReadingHistory, BOOKMARKS_UPDATED_EVENT, LIBRARY_ACTIVITY_EVENT, type StoredBookmark } from '@/lib/library-storage';

import type { LibrarySource } from '@/lib/comic-sources';

type Category = {
  label: string;
  query?: string;
  source: LibrarySource;
  nsfw?: boolean;
  ratings?: string[];
  originalLanguages?: string[];
  includedTagIds?: string[];
  excludedTagIds?: string[];
};

type LoadResult = {
  items: ComicListItem[];
  hasMore: boolean;
};

const CATEGORIES: Category[] = [
  { label: 'Romance', source: 'mangadex', includedTagIds: ['423e2eae-a7a2-4a8b-ac03-a8351462d71d'] },
  { label: 'Fantasy', source: 'mangadex', includedTagIds: ['cdc58593-87dd-415e-bbc0-2ec27bf404cc'] },
  { label: 'Manga Hub', source: 'mangadex', originalLanguages: ['ja'] },
  { label: 'Webtoons', source: 'mangadex', includedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] },
  { label: 'Manhwa', source: 'mangadex', originalLanguages: ['ko'], excludedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] },
  { label: 'Trending 18+', query: '', nsfw: true, source: 'nhentai' },
  { label: 'Doujinshi', query: '', nsfw: true, source: 'nhentai' },
  { label: 'New 18+', query: 'english', nsfw: true, source: 'nhentai' },
  { label: 'Adult Manga', source: 'mangadex', nsfw: true, ratings: ['pornographic'] },
  { label: 'Erotica', source: 'mangadex', nsfw: true, ratings: ['erotica'] },
  { label: 'Mature Romance', query: 'mature', nsfw: true, source: 'nhentai' },
  { label: 'Yaoi / BL', query: 'yaoi', nsfw: true, source: 'nhentai' },
  { label: 'Yuri / GL', query: '', nsfw: true, source: 'mangadex', includedTagIds: [MANGADEX_GIRLS_LOVE_TAG_ID] },
  { label: 'Parody Comics', query: 'parody', nsfw: true, source: 'nhentai' },
  { label: 'Cosplay', query: 'cosplay', nsfw: true, source: 'nhentai' },
  { label: 'Rule34', source: 'rule34', nsfw: true, query: getBooruDefaultQuery('rule34') },
  { label: 'e621', source: 'e621', nsfw: true, query: getBooruDefaultQuery('e621') },
  { label: 'Danbooru', source: 'danbooru', nsfw: true, query: getBooruDefaultQuery('danbooru') },
  { label: 'Gelbooru', source: 'gelbooru', nsfw: true, query: getBooruDefaultQuery('gelbooru') },
  { label: 'Superheroes', source: 'superhero' },
];

const LIMIT = 36;

/** Separator for debouncing `activeCategory + search` as one string (rare in titles). */
const LIB_TAB_SEARCH_PAIR_SEP = '\u241e';

const createCategoryQueryMap = () =>
  Object.fromEntries(CATEGORIES.map((category) => [category.label, category.query ?? ''])) as Record<string, string>;

const getCategoryByLabel = (label: string | null) => CATEGORIES.find((category) => category.label === label);

const formatMarvelDate = (value?: string) => {
  if (!value) return 'Metadata only';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.getFullYear().toString();
};






const fetchBooruProxy = (source: BooruSource, kind: 'search' | 'post', params: Record<string, string>) => {
  const searchParams = new URLSearchParams({ source, kind, ...params });
  return fetch(`/api/proxy/booru?${searchParams.toString()}`);
};

const fetchDanbooruDirect = (kind: 'search' | 'post', params: Record<string, string>) =>
  fetchBooruProxy('danbooru', kind, params);

type ComicLibraryClientProps = {
  initialAgeVerified?: boolean;
};

export default function ComicLibraryClient({ initialAgeVerified = false }: ComicLibraryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialCategory = (() => {
    const requestedCategory = getCategoryByLabel(searchParams.get('tab'));
    if (requestedCategory?.nsfw && !initialAgeVerified) return 'Manga Hub';
    return requestedCategory?.label ?? 'Manga Hub';
  })();
  const initialCategoryQueries = createCategoryQueryMap();
  initialCategoryQueries[initialCategory] = searchParams.get('q') ?? initialCategoryQueries[initialCategory] ?? '';

  const [comics, setComics] = useState<ComicListItem[]>([]);
  const [selectedComic, setSelectedComic] = useState<ComicListItem | null>(null);
  const [pages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [categoryQueries, setCategoryQueries] = useState<Record<string, string>>(() => initialCategoryQueries);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reading] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'webtoon' | 'spread'>('single');
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [nsfwEnabled, setNsfwEnabled] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [lang, setLang] = useState<Lang>('en');
  const [zoom, setZoom] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [bookmarks, setBookmarks] = useState<StoredBookmark[]>([]);
  const [recentActivity, setRecentActivity] = useState<Record<string, number>>({});
  const [sourceFilter, setSourceFilter] = useState<'all' | LibrarySource>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'featured' | 'recent' | 'saved' | 'title-asc' | 'title-desc'>('featured');
  
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const t_lib = translations[lang].library;
  const t_cat = translations[lang].catalog;
  const t_hero = translations[lang].hero;
  const libraryAgeDescription = useLibraryAgeDescription(t_lib.ageDesc, {
    ageDescEastAsia: t_lib.ageDescEastAsia,
    ageDescEurope: t_lib.ageDescEurope,
  });
  const visibleCategories = isAgeVerified && nsfwEnabled
    ? CATEGORIES
    : CATEGORIES.filter((category) => !category.nsfw);
  const requestIdRef = useRef(0);
  const skipNextOffsetFetchRef = useRef(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchQuery = categoryQueries[activeCategory] ?? '';
  /** Debounce `{tab}|{typed query}` so tab switches bypass the delay from the prior tab. */
  const composedDebouncedPair = useDebouncedValue(
    `${activeCategory}${LIB_TAB_SEARCH_PAIR_SEP}${searchQuery}`,
    430,
  );
  const [debouncedCat, debouncedQueryRaw] = useMemo(() => {
    const sepIndex = composedDebouncedPair.indexOf(LIB_TAB_SEARCH_PAIR_SEP);
    if (sepIndex === -1) return [activeCategory, searchQuery] as const;
    return [
      composedDebouncedPair.slice(0, sepIndex),
      composedDebouncedPair.slice(sepIndex + LIB_TAB_SEARCH_PAIR_SEP.length),
    ] as const;
  }, [composedDebouncedPair, activeCategory, searchQuery]);
  const fetchSearchQueryTrimmed =
    debouncedCat === activeCategory ? debouncedQueryRaw.trim() : searchQuery.trim();

  const autoCompletePreview = useMemo(() => {
    const q = fetchSearchQueryTrimmed;
    if (q.length < 3) return [];
    /** Avoid flashing rows from the previous query while `loadData` is replacing comics. */
    if (loading) return [];
    return comics.slice(0, 8);
  }, [comics, fetchSearchQueryTrimmed, loading]);

  const bookmarkedKeys = useMemo(() => new Set(bookmarks.map((bookmark) => `${bookmark.source}:${bookmark.id}`)), [bookmarks]);
  const visibleComics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return comics
      .filter((comic) => {
        const matchesQuery =
          !query ||
          comic.title.toLowerCase().includes(query) ||
          comic.description.toLowerCase().includes(query) ||
          comic.rating.toLowerCase().includes(query);
        const matchesSource = sourceFilter === 'all' || comic.source === sourceFilter;
        const matchesSaved = !savedOnly || bookmarkedKeys.has(`${comic.source}:${comic.id}`);
        return matchesQuery && matchesSource && matchesSaved;
      })
      .sort((left, right) => {
        const leftKey = `${left.source}:${left.id}`;
        const rightKey = `${right.source}:${right.id}`;
        if (sortOrder === 'saved') {
          return Number(bookmarkedKeys.has(rightKey)) - Number(bookmarkedKeys.has(leftKey));
        }
        if (sortOrder === 'recent') {
          return (recentActivity[rightKey] || 0) - (recentActivity[leftKey] || 0);
        }
        if (sortOrder === 'title-asc') return left.title.localeCompare(right.title);
        if (sortOrder === 'title-desc') return right.title.localeCompare(left.title);
        return 0;
      });
  }, [bookmarkedKeys, comics, recentActivity, savedOnly, searchQuery, sourceFilter, sortOrder]);

  useEffect(() => {
    const verified = initialAgeVerified || readAgeVerification();
    const timer = window.setTimeout(() => {
      setIsAgeVerified(verified);
      setNsfwEnabled(verified);
    }, 0);
    if (verified) persistAgeVerification();
    return () => window.clearTimeout(timer);
  }, [initialAgeVerified]);

  useEffect(() => {
    persistStoredMangaLanguage(mangaLanguage);
  }, [mangaLanguage]);

  useEffect(() => {
    const syncBookmarks = () => {
      setBookmarks(readBookmarks());
      const history = readReadingHistory();
      setRecentActivity(Object.fromEntries(
        Object.entries(history).map(([key, entry]) => [key, Number(entry.lastReadAt || entry.timestamp || 0)])
      ));
    };
    const timer = window.setTimeout(syncBookmarks, 0);
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, syncBookmarks);
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, syncBookmarks);
    window.addEventListener('storage', syncBookmarks);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, syncBookmarks);
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, syncBookmarks);
      window.removeEventListener('storage', syncBookmarks);
    };
  }, []);

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
    setCategoryQueries((prev) => ({
      ...prev,
      [activeCategory]: value,
    }));
  }, [activeCategory]);

  const closeSearchDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  const handleNsfwToggle = useCallback(() => {
    if (!isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    requestIdRef.current += 1;
    setOffset(0);
    setHasMore(true);
    setComics([]);
    setNsfwEnabled((value) => {
      const nextValue = !value;
      if (!nextValue && getCategoryByLabel(activeCategory)?.nsfw) {
        setActiveCategory('Manga Hub');
        updateLibraryUrl('Manga Hub', categoryQueries['Manga Hub'] || '', 'replace');
      }
      if (!nextValue) setSourceFilter('all');
      return nextValue;
    });
  }, [activeCategory, categoryQueries, isAgeVerified, updateLibraryUrl]);

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

  const fetchSuperheroes = useCallback(async (query: string, currentOffset: number): Promise<LoadResult> => {
    return searchComics({ source: 'superhero', query, page: currentOffset }) as Promise<LoadResult>;
  }, []);


  const loadData = useCallback(async (pageIndex: number = 0, append: boolean = false) => {
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const cat = CATEGORIES.find(c => c.label === activeCategory);
      const query = fetchSearchQueryTrimmed;
      const safeMarvelQuery = query;
      
      const canAccessAdultContent = isAgeVerified && nsfwEnabled;
      const defaultRatings = canAccessAdultContent ? ['safe', 'suggestive', 'erotica', 'pornographic'] : ['safe', 'suggestive'];
      let result: LoadResult = { items: [], hasMore: false };

      if (query) {
        if (cat?.source === 'marvel') {
          result = await fetchMarvelIssues(safeMarvelQuery, pageIndex);
        } else if (cat?.source === 'superhero') {
          result = await fetchSuperheroes(query, pageIndex);
        } else if (cat?.source === 'mangadex') {
          result = await fetchMangaDex(query, pageIndex, cat.ratings || defaultRatings, cat.originalLanguages, cat.includedTagIds, cat.excludedTagIds, mangaLanguage);
        } else if (cat?.source === 'nhentai') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await searchComics({ source: 'nhentai', query, page: pageIndex });
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
          const nhentaiSearch = canAccessAdultContent ? searchComics({ source: 'nhentai', query, page: pageIndex }) : Promise.resolve<LoadResult>({ items: [], hasMore: false });
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
          result = await searchComics({ source: 'nhentai', query: catQuery, page: pageIndex });
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
        } else if (source === 'superhero') {
          result = await fetchSuperheroes(catQuery, pageIndex);
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
      setComics(prev => {
        const nextItems = append ? [...prev, ...results] : results;
        return Array.from(new Map(nextItems.map((comic) => [`${comic.source}:${comic.id}`, comic])).values());
      });
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
  }, [activeCategory, fetchArchive, fetchBooru, fetchMangaDex, fetchMarvelIssues, fetchSuperheroes, fetchSearchQueryTrimmed, isAgeVerified, mangaLanguage, nsfwEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData(0, false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCategory, fetchSearchQueryTrimmed, nsfwEnabled, mangaLanguage, loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateLibraryUrl(activeCategory, fetchSearchQueryTrimmed, 'replace');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCategory, fetchSearchQueryTrimmed, updateLibraryUrl]);

  useEffect(() => {
    if (searchQuery.length >= 3) return;
    const t = window.setTimeout(() => setShowDropdown(false), 0);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    // Infinite scroll advances the page index and fetches the next batch.
    if (skipNextOffsetFetchRef.current) {
      skipNextOffsetFetchRef.current = false;
      return;
    }
    if (offset > 0) {
      const timer = setTimeout(() => {
        void loadData(offset, true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [offset, loadData]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSearchDropdown();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!showDropdown) return;
      if (!searchBoxRef.current) return;
      if (searchBoxRef.current.contains(event.target as Node)) return;
      closeSearchDropdown();
    };

    window.addEventListener('keydown', handleEscape);
    window.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [closeSearchDropdown, showDropdown]);



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
    <LazyMotion features={domMax} strict>
    <>
    <Navbar />
    <div className="min-h-screen bg-zinc-50 pt-nav-catalog text-neutral-900 dark:bg-[#020202] dark:text-white">
      {/* Unrestricted Access */}

      {!selectedComic && (
        <div className="px-4 py-6 md:p-16">
          <header className="max-w-7xl mx-auto mb-16">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <button
                  onClick={() => router.push('/')}
                  className="inline-flex w-full items-center justify-center gap-3 border border-neutral-200 bg-neutral-100/80 px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 transition-all hover:bg-neutral-200/90 hover:text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white md:w-auto"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>

                <div className="hidden md:flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.45em] text-neutral-400 dark:text-white/25">
                  <div className="h-[2px] w-16 bg-[#ff4d00]" />
                  <span>Library</span>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                  <div className="flex items-center gap-2 border border-neutral-200 bg-neutral-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <Globe size={14} className="text-[#ff4d00]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/40">Manga Language</span>
                  </div>
                  <select
                    value={mangaLanguage}
                    onChange={(e) => setMangaLanguage(e.target.value as MangaLanguage)}
                    className="w-full bg-neutral-100 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-900 outline-none dark:text-white focus:border-[#ff4d00] md:min-w-[220px] md:w-auto"
                  >
                    {MANGA_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-neutral-200 py-4 dark:border-white/10">
                <span className="text-[8px] font-black uppercase tracking-[0.4em] text-neutral-400 dark:text-white/25">
                  Learn
                </span>
                <Link
                  href="/guides"
                  className="text-[9px] font-black uppercase tracking-[0.35em] text-neutral-600 underline-offset-4 hover:text-[#ff4d00] hover:underline dark:text-white/50 dark:hover:text-[#ff5a1f]"
                >
                  Guides
                </Link>
                <Link
                  href="/reading"
                  className="text-[9px] font-black uppercase tracking-[0.35em] text-neutral-600 underline-offset-4 hover:text-[#ff4d00] hover:underline dark:text-white/50 dark:hover:text-[#ff5a1f]"
                >
                  Reading hub
                </Link>
                <Link
                  href="/faq"
                  className="text-[9px] font-black uppercase tracking-[0.35em] text-neutral-600 underline-offset-4 hover:text-[#ff4d00] hover:underline dark:text-white/50 dark:hover:text-[#ff5a1f]"
                >
                  FAQ
                </Link>
              </nav>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <button onClick={() => {
                  const randomOffset = Math.floor(Math.random() * 10);
                  skipNextOffsetFetchRef.current = true;
                  setOffset(randomOffset);
                  loadData(randomOffset, false);
                }} className="h-12 w-full flex items-center justify-center border border-neutral-200 dark:border-white/10 text-neutral-400 transition-all hover:bg-[#ff4d00] hover:text-white dark:text-white/20 md:h-16 md:w-16">
                  <Shuffle size={20} />
                </button>
                <div ref={searchBoxRef} className="relative flex-1 md:w-96">
                  <input 
                    type="text" 
                    placeholder="Search comics, manga, manhwa..."
                    className="w-full border border-neutral-200 bg-white py-4 pl-12 pr-4 text-[11px] font-black uppercase text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-[#ff4d00] dark:border-white/10 dark:bg-black/[0.04] dark:text-white dark:placeholder:text-white/25 md:py-5 md:px-12"
                    value={searchQuery} 
                    onChange={e => handleSearchQueryChange(e.target.value)}
                    onFocus={() => searchQuery.length >= 3 && setShowDropdown(true)}
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-white/20" />
                  
                  {/* Professional Search Dropdown */}
                  <AnimatePresence>
                    {showDropdown && (
                      <m.div 
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        className="absolute top-full left-0 right-0 mt-2 z-[6000] bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden"
                      >
                        <div className="p-2 border-b border-neutral-100 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase tracking-[0.4em] text-neutral-400 dark:text-white/20 px-2">Results</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              closeSearchDropdown();
                            }}
                          >
                            <X size={12} className="text-neutral-400 dark:text-white/20 hover:text-neutral-900 dark:hover:text-white" />
                          </button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                          {loading && fetchSearchQueryTrimmed.length >= 3 ? (
                            <div className="p-8 text-center">
                              <Loader2 className="w-5 h-5 text-[#ff4d00] animate-spin mx-auto mb-3" />
                              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-neutral-400 dark:text-white/10">{t_hero.quickSearchSearching}</span>
                            </div>
                          ) : autoCompletePreview.length === 0 ? (
                            <div className="p-8 text-center text-[9px] font-black uppercase tracking-[0.5em] text-neutral-400 dark:text-white/10">{t_hero.quickSearchNone}</div>
                          ) : (
                            autoCompletePreview.map(comic => (
                              <button 
                                key={`${comic.source}:${comic.id}`}
                                onClick={() => {
                                  closeSearchDropdown();
                                  router.push(`/library/${comic.source}/${comic.id}`);
                                }}
                                className="w-full p-3 flex items-center gap-4 hover:bg-black/[0.05] dark:hover:bg-black/[0.04] dark:bg-white/5 border-b border-neutral-100 dark:border-white/5 transition-all text-left group"
                              >
                                <div className="relative w-10 aspect-[2/3] bg-black border border-neutral-200 dark:border-white/10 shrink-0">
                                  <Image src={comic.coverUrl || '/logo.png'} fill sizes="40px" quality={65} className="object-cover" alt={`${comic.title} — cover`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-800 dark:text-white/80 group-hover:text-[#ff4d00] transition-colors truncate">{comic.title}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-1 py-0.5 text-[6px] font-black uppercase tracking-tighter ${
                                      comic.source === 'mangadex' ? 'bg-orange-500/20 text-orange-400' :
                                      comic.source === 'marvel' ? 'bg-red-600/20 text-red-500' :
                                      comic.source === 'archive' ? 'bg-blue-500/20 text-blue-400' :
                                      'bg-black/[0.06] dark:bg-white/10 text-neutral-500 dark:text-white/40'
                                    }`}>
                                      {comic.source}
                                    </span>
                                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-400 dark:text-white/10">{comic.rating}</span>
                                  </div>
                                </div>
                                <ChevronRight size={14} className="text-neutral-400 dark:text-white/10 group-hover:text-[#ff4d00] transition-all" />
                              </button>
                            ))
                          )}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={handleNsfwToggle}
                  aria-pressed={nsfwEnabled}
                  aria-label={nsfwEnabled ? t_cat.nsfwToggleOn : t_cat.nsfwToggleOff}
                  className={`h-12 w-full flex items-center justify-center border transition-all md:h-16 md:w-16 ${nsfwEnabled ? 'bg-red-600 border-red-600' : 'border-neutral-200 dark:border-white/10 text-neutral-400 dark:text-white/20'}`}
                >
                  {isMounted && nsfwEnabled ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
                <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[8px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/30">{t_cat.filterLabel}</span>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
                    className="flex-1 bg-transparent text-[10px] font-black uppercase tracking-[0.25em] text-neutral-900 outline-none dark:text-white"
                  >
                    <option value="all">{t_cat.allSources}</option>
                    <option value="mangadex">MangaDex</option>
                    <option value="marvel">Marvel</option>
                    <option value="archive">Archive</option>
                    <option value="superhero">Superheroes</option>
                    {isAgeVerified && nsfwEnabled && (
                      <>
                        <option value="nhentai">nhentai</option>
                        <option value="e621">e621</option>
                        <option value="danbooru">danbooru</option>
                        <option value="gelbooru">gelbooru</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[8px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/30">{t_cat.sortLabel}</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                    className="flex-1 bg-transparent text-[10px] font-black uppercase tracking-[0.25em] text-neutral-900 outline-none dark:text-white"
                  >
                    <option value="featured">{t_cat.sortFeatured}</option>
                    <option value="recent">{t_cat.recentlyRead}</option>
                    <option value="saved">{t_cat.savedFirst}</option>
                    <option value="title-asc">{t_cat.titleAsc}</option>
                    <option value="title-desc">{t_cat.titleDesc}</option>
                  </select>
                </div>

                <button
                  onClick={() => setSavedOnly((current) => !current)}
                  className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] transition-all ${
                    savedOnly
                      ? 'border-[#ff4d00] bg-[#ff4d00] text-white'
                      : 'border-neutral-200 bg-black/[0.04] text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:border-white/30 dark:hover:text-white'
                  }`}
                >
                  {t_cat.savedOnly}
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 pt-6 border-t border-neutral-100 dark:border-white/5 md:flex-wrap md:overflow-visible md:gap-3 md:pb-0">
              {visibleCategories.map(cat => (
                <button 
                  key={cat.label} 
                  onClick={() => handleCategoryChange(cat)} 
                  className={`shrink-0 whitespace-nowrap px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition-all md:px-6 md:py-3 ${activeCategory === cat.label ? 'bg-[#ff4d00] border-[#ff4d00] text-white' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400 dark:border-white/10 dark:text-white/30 dark:hover:border-white/80'}`}
                >
                  {cat.source === 'archive' && <Flag size={10} className="inline mr-2" />}
                  {(cat.source === 'marvel' || cat.source === 'superhero') && <BookOpen size={10} className="inline mr-2" />}
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
          ) : visibleComics.length === 0 ? (
             <div className="max-w-3xl mx-auto py-28 text-center">
                <Sparkles className="mx-auto mb-6 w-12 h-12 text-neutral-200 dark:text-white/5" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.8em] text-neutral-400 dark:text-white/20">No results found</h3>
                <p className="mt-4 text-sm text-neutral-500 dark:text-white/35 leading-relaxed">
                  {savedOnly
                    ? 'You are filtering to saved items only. Try turning off Saved Only or clear the source filter.'
                    : searchQuery
                      ? `Nothing matches "${searchQuery}". Try a broader title or switch the source filter.`
                      : 'This section is currently empty. Pick a different category or come back after the next sync.'}
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSavedOnly(false);
                      setSourceFilter('all');
                      setSortOrder('featured');
                    }}
                    className="rounded-2xl border border-neutral-200 bg-neutral-100/90 px-5 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600 transition-all hover:border-neutral-300 hover:text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:border-white/25 dark:hover:text-white"
                  >
                    Reset Filters
                  </button>
                  <button
                    onClick={() => router.push('/support')}
                    className="rounded-2xl bg-[#ff4d00] px-5 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white transition-all hover:bg-white hover:text-black"
                  >
                    Report Issue
                  </button>
                </div>
             </div>
          ) : (
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 md:gap-x-10 md:gap-y-20">
              {visibleComics.map((comic, index) => {
                const adultContent = isAdultComic(comic);
                const shouldBlur = adultContent && !isAgeVerified;
                const coverClassName = `object-cover opacity-100 transition-transform duration-700 ${
                  shouldBlur ? 'scale-105' : 'scale-100'
                } group-hover:scale-110`;
                const coverStyle = shouldBlur
                  ? { filter: 'blur(6px)' }
                  : { filter: 'none' };

                return (
                  <m.div 
                    ref={visibleComics.length === index + 1 ? lastComicRef : null}
                    key={`${comic.source}:${comic.id}`} 
                    whileHover={{ 
                      y: -15, 
                      scale: 1.04,
                      rotateX: -5,
                      rotateY: 5,
                      transition: { type: "spring", stiffness: 400, damping: 25 }
                    }}
                    onClick={(event) => {
                      if (adultContent && !isAgeVerified) {
                        event.preventDefault();
                        setShowAgeGate(true);
                        return;
                      }

                      router.push(`/library/${comic.source}/${comic.id}`);
                    }}
                    className="relative group cursor-pointer perspective-container"
                  >
                    <div className="aspect-[2/3] overflow-hidden relative border border-neutral-200 bg-neutral-100 shadow-lg transition-shadow duration-500 dark:border-white/5 dark:bg-[#0a0a0a] dark:shadow-[0_40px_80px_rgba(0,0,0,0.8)] group-hover:shadow-[0_0_50px_rgba(255,90,31,0.2)]">
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#ff4d00]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
                      {comic.source === 'marvel' ? (
                        comic.coverUrl ? (
                          <div className="relative w-full h-full">
                            <Image
                              src={comic.coverUrl}
                              fill
                              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                              quality={72}
                              className={coverClassName}
                              style={coverStyle}
                              alt={`${comic.title} — cover`}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,77,0,0.3),_transparent_45%),linear-gradient(180deg,#171717_0%,#060606_100%)]">
                            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                            <div className="absolute inset-0 flex flex-col justify-between p-4">
                              <div className="flex items-center justify-between gap-2">
                                <span className="bg-neutral-900 px-2 py-1 text-[7px] font-black uppercase tracking-[0.35em] text-white">MARVEL</span>
                                <span className="text-[8px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/35">{comic.yearPage || '----'}</span>
                              </div>
                              <div className="space-y-2">
                                <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#ff4d00]">Issue {comic.issueNumber || '?'}</div>
                                <div className="line-clamp-3 text-xl font-black uppercase leading-[0.9] tracking-tighter text-neutral-900 dark:text-white">{comic.title}</div>
                                <div className="text-[8px] uppercase tracking-[0.28em] text-neutral-500 dark:text-white/35 line-clamp-2">{comic.seriesName || comic.description}</div>
                              </div>
                            </div>
                          </div>
                        )
                      ) : comic.source === 'superhero' ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={comic.coverUrl || '/logo.png'}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                            quality={72}
                            className={coverClassName}
                            style={coverStyle}
                            alt={`${comic.title} — cover`}
                          />
                        </div>
                      ) : (
                        <div className="relative w-full h-full">
                          <Image
                            src={comic.coverUrl || '/logo.png'}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                            quality={72}
                            className={coverClassName}
                            style={coverStyle}
                            alt={`${comic.title} — cover`}
                          />
                        </div>
                      )}
                      {shouldBlur && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[2px] opacity-100">
                          <div className="rounded-full border border-neutral-300 dark:border-white/15 bg-black/60 px-3 py-1 text-[8px] font-black uppercase tracking-[0.4em] text-white">
                            Tap to reveal
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent flex items-center justify-between">
                         <span className="text-[7px] font-black uppercase tracking-widest text-[#ff4d00]">{comic.source}</span>
                         {comic.source === 'marvel' ? (
                           <span className="text-[6px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/40">{comic.onSaleDate ? formatMarvelDate(comic.onSaleDate) : 'Metadata only'}</span>
                         ) : (
                           isAdultComic(comic) && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[6px] font-black uppercase">18+</span>
                         )}
                      </div>
                    </div>
                    <h3 className="mt-6 text-[10px] font-black uppercase tracking-widest text-neutral-400 leading-relaxed line-clamp-2 group-hover:text-neutral-900 dark:text-white/20 dark:group-hover:text-white">
                      {comic.title}
                    </h3>
                    {comic.source === 'marvel' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="px-2 py-1 border border-neutral-200 dark:border-white/10 text-[7px] font-black uppercase tracking-[0.25em] text-neutral-600 dark:text-white/45">#{comic.issueNumber || '?'}</span>
                        <span className="px-2 py-1 border border-neutral-200 dark:border-white/10 text-[7px] font-black uppercase tracking-[0.25em] text-neutral-600 dark:text-white/45">{comic.pageCount ? `${comic.pageCount} p.` : 'No pages'}</span>
                      </div>
                    )}
                  </m.div>
                );
              })}
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
          <m.div ref={readerRef} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 z-[5000] bg-black flex flex-col">
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

                          <m.img 
                            key={currentPage}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            src={pages[currentPage]} 
                            alt={`${selectedComic.title} — page ${currentPage + 1}`}
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
                               <m.img 
                                 key="cover"
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 src={pages[0]} 
                                 alt={`${selectedComic.title} — cover`}
                                 style={{ transform: `scale(${zoom})`, maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                                 className="shadow-2xl border border-white/5 ring-1 ring-white/10" 
                               />
                             ) : (
                               <div className="flex items-center justify-center h-full w-full gap-0 bg-[#111] shadow-2xl relative">
                                 {/* Spine shadow */}
                                 <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-r from-black/40 via-black/10 to-black/40 z-20 pointer-events-none" />
                                 
                                 <m.img 
                                   key={currentPage}
                                   initial={{ opacity: 0, x: -10 }}
                                   animate={{ opacity: 1, x: 0 }}
                                   src={pages[currentPage]} 
                                   alt={`${selectedComic.title} — page ${currentPage + 1} (left)`}
                                   style={{ transform: `scale(${zoom})`, height: '100%', width: '50%', objectFit: 'contain', objectPosition: 'right' }} 
                                   className="border-r border-black/20" 
                                 />
                                 {pages[currentPage + 1] && (
                                   <m.img 
                                     key={currentPage + 1}
                                     initial={{ opacity: 0, x: 10 }}
                                     animate={{ opacity: 1, x: 0 }}
                                     src={pages[currentPage + 1]} 
                                     alt={`${selectedComic.title} — page ${currentPage + 2} (right)`}
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
                           <m.img 
                            key={i} 
                            src={p} 
                            alt={`${selectedComic.title} — page ${i + 1}`}
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
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAgeGate && (
          <AgeGateOverlay
            title={t_lib.restricted}
            description={libraryAgeDescription}
            confirmLabel={t_lib.verifyBtn}
            cancelLabel={t_lib.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => setShowAgeGate(false)}
            zIndex={15000}
          />
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
    </>
    </LazyMotion>
  );
}

const ComicSkeleton = () => (
  <div className="space-y-6">
    <div className="aspect-[2/3] border border-neutral-200 bg-neutral-200/80 shimmer dark:border-white/5 dark:bg-[#0a0a0a]" />
    <div className="space-y-2">
      <div className="h-2 w-full shimmer bg-neutral-200 dark:bg-[#0a0a0a]" />
      <div className="h-2 w-2/3 shimmer bg-neutral-100 dark:bg-[#0a0a0a]" />
    </div>
  </div>
);

const ReaderSkeleton = () => (
  <div className="w-full max-w-4xl mx-auto space-y-8 py-10">
     <div className="aspect-[2/3] w-full shimmer bg-[#0a0a0a]" />
     <div className="aspect-[2/3] w-full shimmer bg-[#0a0a0a]" />
  </div>
);
