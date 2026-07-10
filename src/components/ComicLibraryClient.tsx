"use client";

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Search, X, ChevronLeft, ChevronRight, ChevronDown,
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
import { getRandomMangaDexManga } from '@/actions/comic';
import Image from 'next/image';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';
import Link from 'next/link';
import { readBookmarks, readReadingHistory, BOOKMARKS_UPDATED_EVENT, LIBRARY_ACTIVITY_EVENT, type StoredBookmark } from '@/lib/library-storage';

import type { LibrarySource } from '@/lib/comic-sources';

type Category = {
  label: string;
  query?: string;
  /** `all` runs parallel catalog search (`loadData` global branch). */
  source: LibrarySource | 'all';
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
  { label: 'All sources', source: 'all' },
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

/**
 * Every tab starts with an empty visible search input. Internal category API
 * queries (e.g. booru `rating:explicit`) flow to `loadData` via `cat.query`
 * and must never leak into the input. Keep an entry per label ('' not
 * undefined) so `handleCategoryChange` doesn't fall back to `category.query`.
 */
const createCategoryQueryMap = () =>
  Object.fromEntries(CATEGORIES.map((category) => [category.label, ''])) as Record<string, string>;

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
    if (requestedCategory?.nsfw && !initialAgeVerified) return 'All sources';
    return requestedCategory?.label ?? 'All sources';
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
  const [randomMangaBusy, setRandomMangaBusy] = useState(false);

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
    // No client-side text re-filter: `loadData` already refetches server-filtered
    // results per query, and substring-matching them again hid booru/nhentai items
    // whose truncated tag titles never contain the query text.
    return comics
      .filter((comic) => {
        const matchesSource = sourceFilter === 'all' || comic.source === sourceFilter;
        const matchesSaved = !savedOnly || bookmarkedKeys.has(`${comic.source}:${comic.id}`);
        return matchesSource && matchesSaved;
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
  }, [bookmarkedKeys, comics, recentActivity, savedOnly, sourceFilter, sortOrder]);

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

  const librarySearchParamsKey = searchParams.toString();
  const updateLibraryUrl = useCallback((tab: string, query: string, mode: 'push' | 'replace') => {
    const params = new URLSearchParams(librarySearchParamsKey);
    params.set('tab', tab);
    if (query.trim()) params.set('q', query.trim());
    else params.delete('q');

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    if (mode === 'push') {
      router.push(nextUrl, { scroll: false });
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, router, librarySearchParamsKey]);

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
    // Open results as the user types — the old focus-only trigger meant typing into a
    // freshly-focused input never showed the autocomplete dropdown.
    setShowDropdown(value.trim().length >= 3);
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
        setActiveCategory('All sources');
        updateLibraryUrl('All sources', categoryQueries['All sources'] || '', 'replace');
      }
      if (!nextValue) setSourceFilter('all');
      return nextValue;
    });
  }, [activeCategory, categoryQueries, isAgeVerified, updateLibraryUrl]);

  const lastComicRef = useCallback((node: HTMLElement | null) => {
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

      const runGlobalSearch = async (): Promise<LoadResult> => {
        const nhentaiSearch = canAccessAdultContent
          ? searchComics({ source: 'nhentai', query, page: pageIndex })
          : Promise.resolve<LoadResult>({ items: [], hasMore: false });
        const rule34Search = canAccessAdultContent
          ? fetchBooru('rule34', query, pageIndex)
          : Promise.resolve<LoadResult>({ items: [], hasMore: false });
        const booruSearches = canAccessAdultContent
          ? [
              fetchBooru('e621', query, pageIndex),
              fetchBooru('danbooru', query, pageIndex),
              fetchBooru('gelbooru', query, pageIndex),
            ]
          : [];

        const [mdResults, arcResults, nhResults, marvelResults, heroResults, rule34Results, ...booruResults] =
          await Promise.all([
            fetchMangaDex(query, pageIndex, defaultRatings, undefined, undefined, undefined, mangaLanguage),
            fetchArchive(query, pageIndex),
            nhentaiSearch,
            fetchMarvelIssues(query, pageIndex),
            fetchSuperheroes(query, pageIndex),
            rule34Search,
            ...booruSearches,
          ]);

        const combinedItems = [
          ...mdResults.items,
          ...arcResults.items,
          ...nhResults.items,
          ...marvelResults.items,
          ...heroResults.items,
          ...rule34Results.items,
          ...booruResults.flatMap((r) => r.items),
        ].sort((a, b) => a.title.localeCompare(b.title));

        return {
          items: combinedItems,
          hasMore:
            mdResults.hasMore ||
            arcResults.hasMore ||
            nhResults.hasMore ||
            marvelResults.hasMore ||
            heroResults.hasMore ||
            rule34Results.hasMore ||
            booruResults.some((r) => r.hasMore),
        };
      };

      if (query) {
        if (!cat || cat.source === 'all') {
          result = await runGlobalSearch();
        } else if (cat.source === 'marvel') {
          result = await fetchMarvelIssues(safeMarvelQuery, pageIndex);
        } else if (cat.source === 'superhero') {
          result = await fetchSuperheroes(query, pageIndex);
        } else if (cat.source === 'mangadex') {
          result = await fetchMangaDex(query, pageIndex, cat.ratings || defaultRatings, cat.originalLanguages, cat.includedTagIds, cat.excludedTagIds, mangaLanguage);
        } else if (cat.source === 'nhentai') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await searchComics({ source: 'nhentai', query, page: pageIndex });
        } else if (cat.source === 'e621' || cat.source === 'danbooru' || cat.source === 'gelbooru') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await fetchBooru(cat.source, query, pageIndex);
        } else if (cat.source === 'rule34') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await fetchBooru('rule34', query, pageIndex);
        } else {
          result = await runGlobalSearch();
        }
      } else {
        const source = cat?.source ?? 'all';
        const catQuery = cat?.query || '';

        if (source === 'all') {
          result = await runGlobalSearch();
        } else if (source === 'mangadex') {
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
        } else if (source === 'rule34') {
          if (!canAccessAdultContent) {
            setShowAgeGate(true);
            if (requestId === requestIdRef.current) {
              setLoading(false);
              setLoadingMore(false);
            }
            return;
          }
          result = await fetchBooru('rule34', catQuery, pageIndex);
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
      const params = new URLSearchParams(librarySearchParamsKey);
      const tabInUrl = params.get('tab');
      const qInUrl = (params.get('q') ?? '').trim();
      const qWant = fetchSearchQueryTrimmed.trim();
      if (tabInUrl === activeCategory && qInUrl === qWant) return;
      updateLibraryUrl(activeCategory, fetchSearchQueryTrimmed, 'replace');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCategory, fetchSearchQueryTrimmed, librarySearchParamsKey, updateLibraryUrl]);

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

  /**
   * Shared cover-card renderer for both the "Popular now" spotlight row and the
   * regular grid, so the two densities never drift apart. `globalIndex` is the
   * position within the full `visibleComics` list (not just the section it's
   * rendered in) so the infinite-scroll IntersectionObserver ref still lands on
   * the actual last card. `rank` draws the serif numeral overlay (Trending-style)
   * for the featured trio only.
   */
  const renderComicCard = (comic: ComicListItem, globalIndex: number, rank?: number) => {
    const adultContent = isAdultComic(comic);
    const shouldBlur = adultContent && !isAgeVerified;
    const coverClassName = 'object-cover';
    // The rank numeral is designed to sit over photographic cover art with a scrim behind
    // it (Trending-style). The Marvel no-cover fallback is a dense text plate instead, so
    // overlaying a big numeral there just collides with "Issue N" — skip it for that case.
    const hasImageBackdrop = !(comic.source === 'marvel' && !comic.coverUrl);

    return (
      // Real crawlable anchor (was an onClick-only <div>, invisible to Googlebot
      // so the ~2k catalog detail pages were orphaned). prefetch={false} avoids
      // mass-prefetching an infinite grid. Age gate still intercepts via preventDefault.
      <Link
        ref={visibleComics.length === globalIndex + 1 ? lastComicRef : null}
        key={`${comic.source}:${comic.id}`}
        href={`/library/${comic.source}/${comic.id}`}
        prefetch={false}
        onClick={(event) => {
          if (adultContent && !isAgeVerified) {
            event.preventDefault();
            setShowAgeGate(true);
          }
        }}
        className={`ic-cover group${shouldBlur ? ' ic-cover--adult' : ''}`}
      >
        <div className="ic-cover__poster">
          {comic.source === 'marvel' ? (
            comic.coverUrl ? (
              <div className="relative h-full w-full">
                <Image
                  src={comic.coverUrl}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                  quality={72}
                  unoptimized={imageUnoptimizedForSrc(comic.coverUrl)}
                  className={coverClassName}
                  alt={`${comic.title} — cover`}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col justify-between bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="ic-badge ic-badge--neutral">Marvel</span>
                  <span className="ic-eyebrow">{comic.yearPage || '----'}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="ic-eyebrow">Issue {comic.issueNumber || '?'}</div>
                  <div className="ic-display line-clamp-3 text-lg text-fg">{comic.title}</div>
                  <div className="line-clamp-2 text-[11px] text-fg-muted">{comic.seriesName || comic.description}</div>
                </div>
              </div>
            )
          ) : comic.source === 'superhero' ? (
            <div className="relative h-full w-full">
              <Image
                src={comic.coverUrl || '/logo.png'}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                quality={72}
                unoptimized={imageUnoptimizedForSrc(comic.coverUrl || '/logo.png')}
                className={coverClassName}
                alt={`${comic.title} — cover`}
              />
            </div>
          ) : (
            <div className="relative h-full w-full">
              <Image
                src={comic.coverUrl || '/logo.png'}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                quality={72}
                unoptimized={imageUnoptimizedForSrc(comic.coverUrl || '/logo.png')}
                className={coverClassName}
                alt={`${comic.title} — cover`}
              />
            </div>
          )}
          {shouldBlur && (
            <div className="ic-cover__lock">
              <span>18+ · tap to reveal</span>
            </div>
          )}
          {rank != null && hasImageBackdrop && (
            <span className="ic-cover__rank" aria-hidden>{rank}</span>
          )}
        </div>
        <h3 className="ic-cover__title">
          {comic.title}
        </h3>
        <div className="ic-cover__meta">
          <span className="ic-eyebrow">{comic.source}</span>
          {comic.source === 'marvel' ? (
            <span className="ic-eyebrow">{comic.onSaleDate ? formatMarvelDate(comic.onSaleDate) : 'Metadata only'}</span>
          ) : (
            isAdultComic(comic) && <span className="ic-badge ic-badge--danger">18+</span>
          )}
        </div>
        {comic.source === 'marvel' && (
          <div className="flex flex-wrap gap-1.5">
            <span className="ic-badge ic-badge--neutral">#{comic.issueNumber || '?'}</span>
            {comic.pageCount ? <span className="ic-badge ic-badge--neutral">{`${comic.pageCount} p.`}</span> : null}
          </div>
        )}
      </Link>
    );
  };

  /** Featured trio gets `.spotlight-grid` bento weight, but only while the shelf reflects
   * the plain default browse (no active search/filter/sort) — otherwise a "Popular now"
   * label over deliberately-filtered results would be misleading. */
  const showSpotlight =
    !loading &&
    visibleComics.length > 0 &&
    searchQuery.trim().length === 0 &&
    sourceFilter === 'all' &&
    !savedOnly &&
    sortOrder === 'featured';
  // "All sources" merges MangaDex/Marvel with archive.org (uncurated batch scans, often with
  // broken or placeholder cover art) and adult booru/nhentai sources — none of those belong in
  // the "Popular now" spotlight, which should read as a genuine editorial pick, not whichever
  // title happened to sort first alphabetically. Restrict the featured trio to sources with
  // real, curated metadata; every other source still appears in the plain grid below.
  const SPOTLIGHT_ELIGIBLE_SOURCES: ReadonlySet<string> = new Set(['mangadex', 'marvel', 'superhero']);
  const spotlightItems = showSpotlight
    ? visibleComics.filter((c) => SPOTLIGHT_ELIGIBLE_SOURCES.has(c.source)).slice(0, 3)
    : [];
  const restItems = showSpotlight
    ? visibleComics.filter((c) => !spotlightItems.includes(c))
    : visibleComics;

  return (
    <LazyMotion features={domAnimation} strict>
    <>
    <Navbar />
    <div className="min-h-dvh bg-app pt-nav-catalog text-fg">
      {/* Unrestricted Access */}

      {!selectedComic && (
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 md:py-12">
          <header className="mb-10 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="ic-btn ic-btn--secondary ic-btn--sm"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>
                <span className="ic-eyebrow hidden sm:inline-flex">Library</span>
              </div>

              <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="ic-eyebrow">Learn</span>
                <Link
                  href="/guides"
                  className="font-medium text-fg-secondary underline-offset-4 transition-colors hover:text-accent-text hover:underline"
                >
                  Guides
                </Link>
                <Link
                  href="/reading"
                  className="font-medium text-fg-secondary underline-offset-4 transition-colors hover:text-accent-text hover:underline"
                >
                  Reading hub
                </Link>
                <Link
                  href="/faq"
                  className="font-medium text-fg-secondary underline-offset-4 transition-colors hover:text-accent-text hover:underline"
                >
                  FAQ
                </Link>
              </nav>
            </div>

            {/* Considered toolbar: search, quick actions, filters and category tabs share
                one bordered control surface instead of five stacked, disconnected rows. */}
            <div className="searchband space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div ref={searchBoxRef} className="relative flex-1">
                  <div className="ic-input-wrap has-icon">
                    <Search size={16} aria-hidden />
                    <input
                      type="text"
                      placeholder="Search comics, manga, manhwa…"
                      className="ic-input"
                      value={searchQuery}
                      onChange={e => handleSearchQueryChange(e.target.value)}
                      onFocus={() => searchQuery.length >= 3 && setShowDropdown(true)}
                    />
                  </div>

                  {/* Search dropdown */}
                  <AnimatePresence>
                    {showDropdown && (
                      <m.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
                        className="qresults"
                        style={{ zIndex: 6000 }}
                      >
                        <div className="flex items-center justify-between border-b border-line-subtle p-2">
                          <span className="ic-eyebrow px-2">Results</span>
                          <button
                            type="button"
                            className="ic-iconbtn ic-iconbtn--sm"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              closeSearchDropdown();
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                          {loading && fetchSearchQueryTrimmed.length >= 3 ? (
                            <div className="p-8 text-center">
                              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-accent" />
                              <span className="ic-eyebrow">{t_hero.quickSearchSearching}</span>
                            </div>
                          ) : autoCompletePreview.length === 0 ? (
                            <div className="ic-eyebrow p-8 text-center">{t_hero.quickSearchNone}</div>
                          ) : (
                            autoCompletePreview.map(comic => (
                              <Link
                                key={`${comic.source}:${comic.id}`}
                                href={`/library/${comic.source}/${comic.id}`}
                                prefetch={false}
                                onClick={() => closeSearchDropdown()}
                                className="qresult group w-full border-b border-line-subtle text-left"
                              >
                                <div className="qresult__thumb">
                                  <Image src={comic.coverUrl || '/logo.png'} fill sizes="40px" quality={65} unoptimized={imageUnoptimizedForSrc(comic.coverUrl || '/logo.png')} className="object-cover" alt={`${comic.title} — cover`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="qresult__t truncate">{comic.title}</div>
                                  <div className="qresult__m mt-0.5 flex items-center gap-2">
                                    <span>{comic.source}</span>
                                    <span>· {comic.rating}</span>
                                  </div>
                                </div>
                                <ChevronRight size={14} className="shrink-0 text-fg-muted transition-colors group-hover:text-accent-text" />
                              </Link>
                            ))
                          )}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    title="Shuffle this shelf offset"
                    onClick={() => {
                      const randomOffset = Math.floor(Math.random() * 10);
                      skipNextOffsetFetchRef.current = true;
                      setOffset(randomOffset);
                      loadData(randomOffset, false);
                    }}
                    className="ic-iconbtn ic-iconbtn--solid h-11 w-11 shrink-0"
                  >
                    <Shuffle size={18} />
                  </button>
                  <button
                    type="button"
                    title="Random manga from MangaDex (API)"
                    aria-busy={randomMangaBusy}
                    disabled={randomMangaBusy}
                    onClick={async () => {
                      setRandomMangaBusy(true);
                      try {
                        const picked = await getRandomMangaDexManga();
                        if (picked?.id) router.push(`/library/mangadex/${picked.id}`);
                      } finally {
                        setRandomMangaBusy(false);
                      }
                    }}
                    className="ic-btn ic-btn--secondary ic-btn--md shrink-0 whitespace-nowrap"
                  >
                    {randomMangaBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>Random manga</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNsfwToggle}
                    aria-pressed={nsfwEnabled}
                    aria-label={nsfwEnabled ? t_cat.nsfwToggleOn : t_cat.nsfwToggleOff}
                    className="ic-iconbtn ic-iconbtn--solid h-11 w-11 shrink-0"
                  >
                    {isMounted && nsfwEnabled ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_1fr_auto]">
                <div className="ic-field">
                  <span className="ic-field__label">
                    <Globe size={12} className="mr-1 inline-block align-[-1px] text-fg-muted" aria-hidden />
                    Manga language
                  </span>
                  <div className="ic-select-wrap">
                    <select
                      value={mangaLanguage}
                      onChange={(e) => setMangaLanguage(e.target.value as MangaLanguage)}
                      className="ic-select"
                    >
                      {MANGA_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden />
                  </div>
                </div>

                <div className="ic-field">
                  <span className="ic-field__label">{t_cat.filterLabel}</span>
                  <div className="ic-select-wrap">
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
                      className="ic-select"
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
                    <ChevronDown size={16} aria-hidden />
                  </div>
                </div>

                <div className="ic-field">
                  <span className="ic-field__label">{t_cat.sortLabel}</span>
                  <div className="ic-select-wrap">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                      className="ic-select"
                    >
                      <option value="featured">{t_cat.sortFeatured}</option>
                      <option value="recent">{t_cat.recentlyRead}</option>
                      <option value="saved">{t_cat.savedFirst}</option>
                      <option value="title-asc">{t_cat.titleAsc}</option>
                      <option value="title-desc">{t_cat.titleDesc}</option>
                    </select>
                    <ChevronDown size={16} aria-hidden />
                  </div>
                </div>

                <button
                  onClick={() => setSavedOnly((current) => !current)}
                  aria-pressed={savedOnly}
                  className={`ic-btn ic-btn--md self-end ${savedOnly ? 'ic-btn--primary' : 'ic-btn--secondary'}`}
                >
                  {t_cat.savedOnly}
                </button>
              </div>

              <div className="border-t border-line pt-5">
                <div className="ic-tabs">
                  {visibleCategories.map(cat => (
                    <button
                      key={cat.label}
                      onClick={() => handleCategoryChange(cat)}
                      className={`ic-tab${activeCategory === cat.label ? ' is-active' : ''}`}
                    >
                      {cat.source === 'all' && <Globe size={12} className="mr-1.5 inline-block align-[-1px]" />}
                      {cat.source === 'archive' && <Flag size={12} className="mr-1.5 inline-block align-[-1px]" />}
                      {(cat.source === 'marvel' || cat.source === 'superhero') && <BookOpen size={12} className="mr-1.5 inline-block align-[-1px]" />}
                      {(cat.source === 'e621' || cat.source === 'danbooru' || cat.source === 'gelbooru' || cat.source === 'rule34') && (
                        <Sparkles size={12} className="mr-1.5 inline-block align-[-1px]" />
                      )}
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="mtgrid">
              {[...Array(12)].map((_, i) => <ComicSkeleton key={i} />)}
            </div>
          ) : visibleComics.length === 0 ? (
             <div className="state-block mx-auto max-w-3xl">
                <Sparkles className="h-7 w-7 text-fg-muted" />
                <h4>No results found</h4>
                <p>
                  {savedOnly
                    ? 'You are filtering to saved items only. Try turning off saved only or clear the source filter.'
                    : searchQuery
                      ? `Nothing matches "${searchQuery}". Try a broader title or switch the source filter.`
                      : 'This shelf is currently empty. Pick a different category or come back after the next sync.'}
                </p>
                {searchQuery.trim().length >= 2 && !(isAgeVerified && nsfwEnabled) ? (
                  <p className="text-xs leading-relaxed text-fg-muted">
                    MangaDex titles marked <span className="font-semibold text-fg">erotica</span> or{' '}
                    <span className="font-semibold text-fg">pornographic</span> are excluded from search
                    until age verification is on and adult shelves are enabled (library NSFW toggle).
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSavedOnly(false);
                      setSourceFilter('all');
                      setSortOrder('featured');
                    }}
                    className="ic-btn ic-btn--secondary ic-btn--md"
                  >
                    Reset filters
                  </button>
                  <button
                    onClick={() => router.push('/support')}
                    className="ic-btn ic-btn--primary ic-btn--md"
                  >
                    Report issue
                  </button>
                </div>
             </div>
          ) : showSpotlight ? (
            <>
              <div className="mb-5">
                <span className="ic-eyebrow">{t_cat.popularNow}</span>
              </div>
              <div className="spotlight-grid mb-10">
                {spotlightItems.map((comic, i) => renderComicCard(comic, i, i + 1))}
              </div>
              {restItems.length > 0 && (
                <>
                  <div className="mb-5 border-t border-line pt-8">
                    <span className="ic-eyebrow">{t_cat.moreTitles}</span>
                  </div>
                  <div className="mtgrid">
                    {restItems.map((comic, i) => renderComicCard(comic, i + spotlightItems.length))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="mtgrid">
              {visibleComics.map((comic, index) => renderComicCard(comic, index))}
            </div>
          )}

          {loadingMore && (
            <div className="mtgrid mt-8">
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
                  <button onClick={() => setSelectedComic(null)} className="w-10 h-10 rounded-btn border border-white/10 flex items-center justify-center transition-colors hover:bg-white/10 max-md:w-9 max-md:h-9"><X /></button>
                  <div className="hidden md:block">
                     <h4 className="max-w-xs truncate text-xs font-medium text-white/60">{selectedComic.title}</h4>
                  </div>
                </div>

                <div className="flex w-full flex-wrap justify-center bg-white/5 p-1 border border-white/10 rounded-full max-md:justify-between max-md:rounded-2xl max-md:p-1.5">
                  <button onClick={() => setViewMode('single')} className={`px-4 py-2 text-xs font-medium rounded-full transition-all max-md:px-3 max-md:py-2 ${viewMode === 'single' ? 'bg-accent text-on-accent' : 'text-white/50 hover:text-white'}`}>Single</button>
                  <button onClick={() => setViewMode('spread')} className={`px-4 py-2 text-xs font-medium rounded-full transition-all max-md:px-3 max-md:py-2 ${viewMode === 'spread' ? 'bg-accent text-on-accent' : 'text-white/50 hover:text-white'}`}>Journal</button>
                  <button onClick={() => setViewMode('webtoon')} className={`px-4 py-2 text-xs font-medium rounded-full transition-all max-md:px-3 max-md:py-2 ${viewMode === 'webtoon' ? 'bg-accent text-on-accent' : 'text-white/50 hover:text-white'}`}>Vertical</button>
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
                      <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="w-8 h-8 rounded-btn hover:bg-white/5 flex items-center justify-center"><ZoomOut size={14}/></button>
                      <span className="w-8 text-center font-mono text-[11px] text-white/50">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="w-8 h-8 rounded-btn hover:bg-white/5 flex items-center justify-center"><ZoomIn size={14}/></button>
                   </div>
                   <div className="font-mono text-xs text-accent">
                      {currentPage + 1} <span className="text-white/40">/</span> {pages.length}
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>
    </div>
    </>
    </LazyMotion>
  );
}

const ComicSkeleton = () => (
  <div>
    <div className="sk sk-cover" />
    <div className="sk sk-line w-[85%]" />
    <div className="sk sk-line w-[55%]" />
  </div>
);

const ReaderSkeleton = () => (
  <div className="w-full max-w-4xl mx-auto space-y-8 py-10">
     <div className="sk sk-cover w-full" />
     <div className="sk sk-cover w-full" />
  </div>
);
