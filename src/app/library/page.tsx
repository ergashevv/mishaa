"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Search, X, ChevronLeft, ChevronRight, 
  Loader2, Maximize2, Minimize2, List, Eye, EyeOff,
  ZoomIn, ZoomOut, Columns, FileText, Sparkles, TrendingUp, Clock, Star, Shuffle, Globe, Flag
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { translations, Lang } from '@/lib/translations';
import { 
  DEFAULT_MANGA_LANGUAGE,
  MANGA_LANGUAGE_OPTIONS,
  MangaLanguage,
  getMangaDexTranslatedLanguages,
  persistStoredMangaLanguage,
  resolveMangaDexLocalizedText,
  readStoredMangaLanguage,
} from '@/lib/manga-language';

interface Comic {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  rating: string;
  source: 'mangadex' | 'archive' | 'nhentai' | 'marvel';
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
};

type LoadResult = {
  items: Comic[];
  hasMore: boolean;
};

const CATEGORIES: Category[] = [
  { label: 'Marvel Universe', source: 'marvel' },
  { label: 'Manga Hub', source: 'mangadex' },
  { label: 'Webtoons', query: 'webtoon', source: 'mangadex' },
  { label: 'Manhwa', source: 'mangadex', originalLanguages: ['ko'] },
  { label: 'Doujinshi', query: 'all', nsfw: true, source: 'nhentai' },
  { label: 'New Doujinshi', query: 'language:english', nsfw: true, source: 'nhentai' },
  { label: 'Hentai', source: 'mangadex', nsfw: true, ratings: ['pornographic'] },
  { label: 'Erotica', source: 'mangadex', nsfw: true, ratings: ['erotica'] },
];

const LIMIT = 36;
const MARVEL_COVER_PREFETCH_COUNT = 12;
const MARVEL_COVER_FETCH_RETRIES = 2;

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

export default function ComicLibrary() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reading, setReading] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'webtoon' | 'spread'>('single');
  const [isAgeVerified, setIsAgeVerified] = useState(() => readAgeVerification());
  const [nsfwEnabled, setNsfwEnabled] = useState(() => readAgeVerification());
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Marvel Universe');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [lang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const savedLang = localStorage.getItem('lang') as Lang;
    return savedLang && translations[savedLang] ? savedLang : 'en';
  });
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t_lib = (translations[lang] as any).library;
  const requestIdRef = useRef(0);
  const skipNextOffsetFetchRef = useRef(false);
  
  const router = useRouter();
  const readerRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (isAgeVerified) {
      persistAgeVerification();
    }
  }, [isAgeVerified]);

  useEffect(() => {
    persistStoredMangaLanguage(mangaLanguage);
  }, [mangaLanguage]);

  const handleAgeVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setNsfwEnabled(true);
    setShowAgeGate(false);
  };

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
    translatedLanguage?: MangaLanguage
  ): Promise<LoadResult> => {
    try {
      const ratings = ratingsOverride || ['safe', 'suggestive'];
      const params = new URLSearchParams();
      params.set('limit', LIMIT.toString());
      params.set('offset', String(currentOffset * LIMIT));
      params.append('includes[]', 'cover_art');
      const translatedLanguages = getMangaDexTranslatedLanguages(translatedLanguage || DEFAULT_MANGA_LANGUAGE);
      translatedLanguages?.forEach((language) => params.append('availableTranslatedLanguage[]', language));
      ratings.forEach((rating) => params.append('contentRating[]', rating));
      originalLanguages?.forEach((language) => params.append('originalLanguage[]', language));
      // Added order by relevance if query exists, else followedCount
      if (query.trim().length >= 2) {
        params.set('title', query.trim());
        params.set('order[relevance]', 'desc');
      } else {
        params.set('order[followedCount]', 'desc');
      }

      const url = `https://api.mangadex.org/manga?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return { items: [], hasMore: false };
      const data = await res.json();
      const items = Array.isArray(data?.data) ? data.data : [];
      const total = Number(data?.total ?? 0);
      const hasMore = Number.isFinite(total)
        ? (currentOffset + 1) * LIMIT < total
        : items.length === LIMIT;

      return {
        items: items.map((item: any) => {
          const coverFileName = item.relationships?.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
          const title = resolveMangaDexLocalizedText(item.attributes.title, translatedLanguage || DEFAULT_MANGA_LANGUAGE);
          const description = resolveMangaDexLocalizedText(item.attributes.description, translatedLanguage || DEFAULT_MANGA_LANGUAGE);
          return {
            id: item.id,
            title: title || Object.values(item.attributes.title || {})[0] || 'Untitled',
            description: description || 'No description available.',
            coverUrl: coverFileName ? `https://uploads.mangadex.org/covers/${item.id}/${coverFileName}.512.jpg` : '/logo.png',
            source: 'mangadex',
            rating: item.attributes.contentRating
          };
        }),
        hasMore,
      };
    } catch (e) { return { items: [], hasMore: false }; }
  }, []);

  // Fetch from Archive.org
  const fetchArchive = useCallback(async (query: string, page: number): Promise<LoadResult> => {
    try {
      let searchFilter = `(${query})`;
      if (!query.includes('collection:') && !query.includes('subject:')) {
        searchFilter = `(${query}) AND (collection:comic_books_archive OR subject:"Comic Books") AND -subject:magazine AND -subject:fanzine`;
      }
      
      const url = `https://archive.org/advancedsearch.php?q=${searchFilter}+AND+mediatype:texts&fl[]=identifier,title,description,downloads,avg_rating&sort[]=downloads+desc&rows=${LIMIT}&page=${page + 1}&output=json`;
      const res = await fetch(url);
      if (!res.ok) return { items: [], hasMore: false };
      const data = await res.json();
      
      if (!data.response || !data.response.docs) return { items: [], hasMore: false };
      const docs = Array.isArray(data.response.docs) ? data.response.docs : [];
      const total = Number(data.response.numFound ?? 0);

      return {
        items: docs.map((item: any) => ({
          id: item.identifier,
          title: item.title,
          coverUrl: `https://archive.org/services/img/${item.identifier}`,
          source: 'archive'
        })),
        hasMore: Number.isFinite(total)
          ? (page + 1) * LIMIT < total
          : docs.length === LIMIT,
      };
    } catch (e) { return { items: [], hasMore: false }; }
  }, []);

  // Fetch from nhentai
  const fetchNHentai = useCallback(async (query: string, page: number): Promise<LoadResult> => {
    try {
      let path = (query === 'all' || !query) 
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
          coverUrl: `https://t3.nhentai.net/${item.thumbnail?.path || item.thumbnail}`,
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

  const fetchMarvelIssues = useCallback(async (query: string, currentOffset: number): Promise<LoadResult> => {
    try {
      const normalizedQuery = query.trim();
      const params = new URLSearchParams();
      if (normalizedQuery.length >= 2) {
        params.set('q', normalizedQuery);
      } else {
        params.set('limit', LIMIT.toString());
        params.set('offset', String(currentOffset * LIMIT));
      }

      const res = await fetch(`/api/marvel/issues?${params.toString()}`);
      if (!res.ok) return { items: [], hasMore: false };

      const data = await res.json();
      const items: MarvelIssueSummary[] = Array.isArray(data?.items) ? data.items : [];
      const total = Number(data?.total ?? 0);
      const hasNext = data?.has_next;

      const mappedItems: Comic[] = items.map((item) => ({
          id: String(item.id),
          title: item.title || `Issue ${item.issueNumber || item.id}`,
          description: item.seriesName || 'Marvel Comics metadata',
          coverUrl: normalizeMarvelCover(item.cover),
          rating: item.pageCount ? `${item.pageCount} pages` : item.yearPage ? String(item.yearPage) : 'Marvel',
          source: 'marvel' as const,
          issueNumber: item.issueNumber,
          seriesName: item.seriesName,
          onSaleDate: item.onSaleDate,
          yearPage: item.yearPage,
          detailUrl: item.detailUrl,
          pageCount: item.pageCount,
        }));

      const preferredMarvelItems = await Promise.all(
        mappedItems.map(async (comic, index) => {
          if (index >= MARVEL_COVER_PREFETCH_COUNT || comic.coverUrl) return comic;

          for (let attempt = 0; attempt <= MARVEL_COVER_FETCH_RETRIES; attempt += 1) {
            try {
              const detailRes = await fetch(`/api/marvel/issues/${comic.id}`);
              if (!detailRes.ok) {
                if (attempt < MARVEL_COVER_FETCH_RETRIES) {
                  await wait(400 * (attempt + 1));
                  continue;
                }
                return comic;
              }

              const detail = await detailRes.json();
              const coverUrl = normalizeMarvelCover(detail?.cover);
              if (coverUrl) {
                return { ...comic, coverUrl };
              }

              return comic;
            } catch {
              if (attempt < MARVEL_COVER_FETCH_RETRIES) {
                await wait(400 * (attempt + 1));
                continue;
              }
              return comic;
            }
          }

          return comic;
        })
      );

      return {
        items: preferredMarvelItems,
        hasMore: typeof hasNext === 'boolean'
          ? hasNext
          : Number.isFinite(total)
            ? (currentOffset + 1) * LIMIT < total
            : items.length === LIMIT,
      };
    } catch (error) {
      console.error(error);
      return { items: [], hasMore: false };
    }
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
        } else {
          // Global search: search all sources
          const nhentaiSearch = canAccessAdultContent ? fetchNHentai(query, pageIndex) : Promise.resolve<LoadResult>({ items: [], hasMore: false });
          const [mdResults, arcResults, nhResults] = await Promise.all([
            fetchMangaDex(query, pageIndex, defaultRatings, undefined, mangaLanguage),
            fetchArchive(query, pageIndex),
            nhentaiSearch
          ]);

          const combinedItems = [...mdResults.items, ...arcResults.items, ...nhResults.items].sort((a, b) => a.title.localeCompare(b.title));
          result = {
            items: combinedItems,
            hasMore: mdResults.hasMore || arcResults.hasMore || nhResults.hasMore,
          };
        }
      } else {
        const source = cat?.source || 'mangadex';
        const catQuery = cat?.query || '';
        
        if (source === 'mangadex') {
          result = await fetchMangaDex(catQuery, pageIndex, cat?.ratings || defaultRatings, cat?.originalLanguages, mangaLanguage);
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
  }, [activeCategory, fetchArchive, fetchMangaDex, fetchMarvelIssues, fetchNHentai, isAgeVerified, mangaLanguage, nsfwEnabled, searchQuery]);

  useEffect(() => {
    // Filters intentionally refetch the library; this is the synchronization point.
    /* eslint-disable react-hooks/set-state-in-effect */
    requestIdRef.current += 1;
    setOffset(0);
    setHasMore(true);
    setComics([]);
    loadData(0, false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeCategory, searchQuery, nsfwEnabled, loadData]);

  useEffect(() => {
    // Infinite scroll advances the page index and fetches the next batch.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (skipNextOffsetFetchRef.current) {
      skipNextOffsetFetchRef.current = false;
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    if (offset > 0) loadData(offset, true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [offset, loadData]);

  const fetchPages = async (comic: Comic) => {
    // Check for adult content age gate
    if (isAdultComic(comic) && !isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    setReading(true);
    setPages([]);
    try {
      if (comic.source === 'mangadex') {
        // Try English first
        const translatedLanguages = getMangaDexTranslatedLanguages(mangaLanguage);
        const feedParams = new URLSearchParams();
        feedParams.set('limit', '5');
        feedParams.set('order[chapter]', 'asc');
        translatedLanguages?.forEach((language) => feedParams.append('translatedLanguage[]', language));
        let feedRes = await fetch(`https://api.mangadex.org/manga/${comic.id}/feed?${feedParams.toString()}`);
        let feedData = await feedRes.json();
        
        // Fallback to any language only for the default English browse mode.
        if ((!feedData.data || feedData.data.length === 0) && mangaLanguage === DEFAULT_MANGA_LANGUAGE) {
          feedRes = await fetch(`https://api.mangadex.org/manga/${comic.id}/feed?limit=5&order[chapter]=asc`);
          feedData = await feedRes.json();
        }

        if (!feedData.data || feedData.data.length === 0) throw new Error("No readable chapters found on MangaDex");
        
        const chId = feedData.data[0].id;
        const srvRes = await fetch(`https://api.mangadex.org/at-home/server/${chId}`);
        const srvData = await srvRes.json();
        
        if (!srvData.chapter || !srvData.chapter.data) throw new Error("Chapter data is unavailable");
        
        setPages(srvData.chapter.data.map((n: string) => `${srvData.baseUrl}/data/${srvData.chapter.hash}/${n}`));
      } 
      else if (comic.source === 'archive') {
        const url = `https://archive.org/metadata/${comic.id}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.files) throw new Error("No files found");

        const imageFiles = data.files.filter((f: any) => {
          const name = f.name.toLowerCase();
          return (
            name.endsWith('.jpg') || 
            name.endsWith('.png') || 
            name.endsWith('.jpeg') ||
            (f.format && (f.format.includes('Image') || f.format.includes('JPEG') || f.format.includes('PNG')))
          ) && !name.includes('thumb') && !name.includes('cover');
        });

        const pdfFile = data.files.find((f: any) => f.name.toLowerCase().endsWith('.pdf'));
        const jp2Zip = data.files.find((f: any) => f.name.toLowerCase().endsWith('_jp2.zip'));
        const comicFile = data.files.find((f: any) => f.name.toLowerCase().endsWith('.cbr') || f.name.toLowerCase().endsWith('.cbz'));

        let archivePages = [];
        if (imageFiles.length > 5) { // If there are many direct images, use them
          imageFiles.sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
          archivePages = imageFiles.map((f: any) => `https://archive.org/download/${comic.id}/${f.name}`);
        } else {
          // Use the more stable Archive.org Image Service
          let pageCount = parseInt(data.metadata?.page_count || "0");
          if (!pageCount && jp2Zip) pageCount = parseInt(jp2Zip.filecount || "0");
          if (!pageCount && comicFile) pageCount = parseInt(comicFile.filecount || "0");
          if (!pageCount && pdfFile) pageCount = 60; // Better default

          if (pageCount > 0) {
            for(let i=0; i<pageCount; i++) {
               // Official Archive.org Page Image Service (very stable)
               archivePages.push(`https://archive.org/services/img/${comic.id}/${i}?scale=8&fullsize=1`);
            }
          }
        }

        if (archivePages.length === 0) throw new Error("No readable pages found");
        setPages(archivePages);
      } 
      else if (comic.source === 'nhentai') {
        const res = await fetch(`/api/proxy/nhentai?path=${encodeURIComponent(`galleries/${comic.id}`)}`);
        if (!res.ok) throw new Error("Failed to fetch nhentai gallery");
        const data = await res.json();
        
        // nhentai v2 provides direct paths
        const nhPages = data.pages.map((p: any) => {
           return `https://i.nhentai.net/${p.path}`;
        });
        setPages(nhPages);
      }
      
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
        <div className="p-8 md:p-16">
          <header className="max-w-7xl mx-auto mb-16">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="inline-flex items-center gap-3 border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>

                <div className="hidden md:flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.45em] text-white/25">
                  <div className="h-[2px] w-16 bg-[#ff4d00]" />
                  <span>Archive Index</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-3 border border-white/10 bg-white/5">
                    <Globe size={14} className="text-[#ff4d00]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40">Manga Language</span>
                  </div>
                  <select
                    value={mangaLanguage}
                    onChange={(e) => setMangaLanguage(e.target.value as MangaLanguage)}
                    className="min-w-[220px] bg-[#0a0a0a] border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-[#ff4d00]"
                  >
                    {MANGA_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => {
                  const randomOffset = Math.floor(Math.random() * 10);
                  skipNextOffsetFetchRef.current = true;
                  setOffset(randomOffset);
                  loadData(randomOffset, false);
                }} className="w-16 h-16 flex items-center justify-center border border-white/10 text-white/20 hover:bg-[#ff4d00] hover:text-white transition-all">
                  <Shuffle size={20} />
                </button>
                <div className="relative flex-1 md:w-96">
                  <input type="text" placeholder="SEARCH_GLOBAL_ARCHIVES..." className="w-full bg-white/5 border border-white/10 py-5 px-12 text-[11px] font-black uppercase focus:border-[#ff4d00] transition-all outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                </div>
                <button onClick={() => { if (!isAgeVerified) { setShowAgeGate(true); } else { setNsfwEnabled(!nsfwEnabled); } }} className={`w-16 h-16 flex items-center justify-center border transition-all ${nsfwEnabled ? 'bg-red-600 border-red-600' : 'border-white/10 text-white/20'}`}>
                  {nsfwEnabled ? <Eye /> : <EyeOff />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-white/5">
              {CATEGORIES.map(cat => (
                <button 
                  key={cat.label} 
                  onClick={() => { if (cat.nsfw && !isAgeVerified) { setShowAgeGate(true); return; } setActiveCategory(cat.label); setSearchQuery(''); }} 
                  className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest border transition-all ${activeCategory === cat.label ? 'bg-[#ff4d00] border-[#ff4d00] text-white' : 'border-white/10 text-white/30 hover:border-white/80'}`}
                >
                  {cat.source === 'archive' && <Flag size={10} className="inline mr-2" />}
                  {cat.source === 'marvel' && <BookOpen size={10} className="inline mr-2" />}
                  {cat.label}
                </button>
              ))}
            </div>
          </header>

          {loading ? (
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-10 gap-y-20">
              {[...Array(12)].map((_, i) => <ComicSkeleton key={i} />)}
            </div>
          ) : comics.length === 0 ? (
             <div className="max-w-7xl mx-auto py-40 text-center">
                <Sparkles className="w-12 h-12 text-white/5 mx-auto mb-6" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.8em] text-white/20">Empty_Archive_Detected</h3>
             </div>
          ) : (
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-10 gap-y-20">
              {comics.map((comic, index) => (
                <motion.div 
                  ref={comics.length === index + 1 ? lastComicRef : null}
                  key={comic.id + index} 
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
                         (comic.rating === 'erotica' || comic.rating === 'pornographic') && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[6px] font-black uppercase">18+</span>
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
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-10 gap-y-20 mt-20">
              {[...Array(6)].map((_, i) => <ComicSkeleton key={i} />)}
            </div>
          )}
        </div>
      )}

      {/* PRO READER */}
      <AnimatePresence>
        {selectedComic && (
          <motion.div ref={readerRef} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="fixed inset-0 z-[5000] bg-black flex flex-col">
             <div className="h-20 bg-black border-b border-white/10 flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedComic(null)} className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-red-600"><X /></button>
                  <div className="hidden md:block">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 max-w-xs truncate">{selectedComic.title}</h4>
                  </div>
                </div>

                <div className="flex bg-white/5 p-1 border border-white/10 rounded-full">
                  <button onClick={() => setViewMode('single')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-full transition-all ${viewMode === 'single' ? 'bg-[#ff4d00]' : 'text-white/20 hover:text-white'}`}>Single</button>
                  <button onClick={() => setViewMode('spread')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-full transition-all ${viewMode === 'spread' ? 'bg-[#ff4d00]' : 'text-white/20 hover:text-white'}`}>Journal</button>
                  <button onClick={() => setViewMode('webtoon')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-full transition-all ${viewMode === 'webtoon' ? 'bg-[#ff4d00]' : 'text-white/20 hover:text-white'}`}>Vertical</button>
                </div>

                <div className="flex items-center gap-4">
                   <button 
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        readerRef.current?.requestFullscreen();
                      } else {
                        document.exitFullscreen();
                      }
                    }}
                    className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5"
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
                            className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer flex items-center justify-start p-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                          >
                             <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-full backdrop-blur-sm">
                                <ChevronLeft className={currentPage === 0 ? 'text-white/10' : 'text-white'} />
                             </div>
                          </div>
                          
                          <div 
                            className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer flex items-center justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity" 
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
                            className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer flex items-center justify-start p-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={() => setCurrentPage(p => Math.max(0, p - 2))}
                          >
                             <div className="w-12 h-12 bg-black/50 border border-white/10 flex items-center justify-center rounded-full backdrop-blur-sm">
                                <ChevronLeft className={currentPage === 0 ? 'text-white/10' : 'text-white'} />
                             </div>
                          </div>
                          
                          <div 
                            className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer flex items-center justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity" 
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
