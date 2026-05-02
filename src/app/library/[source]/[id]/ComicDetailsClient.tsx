"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Play, Star, Clock, 
  Globe, BookOpen, Share2, 
  Bookmark, X, Settings,
  ZoomIn, ZoomOut, Maximize2,
  ChevronRight, Loader2, Sparkles,
  Smartphone, Monitor,
  ChevronDown, ChevronUp,
  Columns, List, ExternalLink
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import RichTextContent from '@/components/RichTextContent';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import {
  BooruSource,
} from '@/lib/booru';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { getChapterFromCache, saveChapterToCache } from '@/lib/comic-cache';
import {
  readStoredMangaLanguage,
  MangaLanguage,
} from '@/lib/manga-language';
import { getChapterPages, getChapters, getComicDetails } from '@/actions/comic';
import Image from 'next/image';

interface Chapter {
  id: string;
  title: string;
  chapterNum: string;
  volume?: string;
  externalUrl?: string;
}

interface ComicDetails {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  bannerUrl?: string;
  rating: string;
  genres: string[];
  status: string;
  year?: string;
  author?: string;
  source: 'mangadex' | 'archive' | 'nhentai' | 'marvel' | BooruSource;
  aniListId?: string;
}

interface MarvelCreator {
  id: number;
  name: string;
  role: string;
}

interface MarvelIssue {
  id: number;
  digitalId?: number;
  title: string;
  issueNumber: string;
  description?: string;
  modified?: string;
  pageCount?: number;
  detailUrl: string;
  seriesId: number;
  seriesName: string;
  onSaleDate?: string;
  unlimitedDate?: string;
  yearPage?: number;
  creators?: MarvelCreator[];
  cover?: {
    path: string;
    extension: string;
  };
}

interface MarvelSeriesIssue {
  id: number;
  title: string;
  issueNumber: string;
  detailUrl: string;
  seriesId: number;
  seriesName: string;
  onSaleDate?: string;
  unlimitedDate?: string;
  yearPage?: number;
}

interface MarvelSeries {
  id: number;
  title?: string;
  description?: string;
  startYear?: number;
  endYear?: number;
  modified?: string;
  thumbnail?: {
    path?: string;
    extension?: string;
  };
}

interface MarvelCharacter {
  id: number;
  name?: string;
  description?: string;
  thumbnail?: {
    path?: string;
    extension?: string;
  };
}

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

const normalizeMarvelImage = (image?: { path?: string; extension?: string }) => {
  if (!image?.path || !image.extension) return '';
  const path = image.path.replace('http://', 'https://');
  // Add a size variant if it looks like a base path
  const finalPath = path.includes('portrait_') ? path : `${path}/portrait_incredible`;
  return `${finalPath}.${image.extension}`;
};

const trimText = (value?: string, max = 140) => {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}...` : cleaned;
};


interface ComicDetailsClientProps {
  initialComic: (ComicDetails & { 
    marvelIssue?: MarvelIssue; 
    marvelSeries?: MarvelSeries; 
    marvelSeriesIssues?: MarvelSeriesIssue[]; 
    marvelCharacters?: MarvelCharacter[];
  }) | null;
  initialChapters?: Chapter[];
  source: string;
  id: string;
}

export default function ComicDetailsClient({ initialComic, initialChapters, source, id }: ComicDetailsClientProps) {
  const router = useRouter();
  
  const [comic, setComic] = useState<ComicDetails | null>(initialComic);
  const [marvelIssue, setMarvelIssue] = useState<MarvelIssue | null>(initialComic?.marvelIssue || null);
  const [marvelSeries, setMarvelSeries] = useState<MarvelSeries | null>(initialComic?.marvelSeries || null);
  const [marvelSeriesIssues, setMarvelSeriesIssues] = useState<MarvelSeriesIssue[]>(initialComic?.marvelSeriesIssues || []);
  const [marvelCharacters, setMarvelCharacters] = useState<MarvelCharacter[]>(initialComic?.marvelCharacters || []);
  const [loading, setLoading] = useState(!initialComic);

  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t = translations[lang].library;

  const [reading, setReading] = useState(false);
  
  // Reader State
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters || []);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'classic' | 'flow' | 'journal'>('classic');
  const [readerLoading, setReaderLoading] = useState(false);
  const [uiVisible, setUiVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isSpreadCover, setIsSpreadCover] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  
  const readerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const chapterPageCacheRef = useRef<Map<string, string[]>>(new Map());
  const chapterPageRequestRef = useRef<Map<string, Promise<string[]>>>(new Map());
  const touchStartRef = useRef({ x: 0, y: 0 });
  const clickStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const initialMobile = window.innerWidth < 768;
    setIsMobile(initialMobile);
    if (initialMobile) {
      setViewMode('flow');
    }
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);

    const verified = readAgeVerification();
    const t = setTimeout(() => setIsAgeVerified(prev => (verified !== prev ? verified : prev)), 0);
    if (verified) persistAgeVerification();

    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const handleFs = () => {}; // Dummy to keep structure if needed, or just remove
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
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
    const handleMangaLang = (e: Event) => {
      setMangaLanguage((e as CustomEvent<MangaLanguage>).detail);
    };
    window.addEventListener('langChange', handleMangaLang as EventListener);
    return () => window.removeEventListener('langChange', handleMangaLang as EventListener);
  }, []);

  // UI Auto-hide logic

  // Handle Scroll for progress and indicators
  useEffect(() => {
    const handleScroll = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      if (canvas.scrollTop > 100) setScrolled(true);
      else setScrolled(false);

      // Intelligent UI Hiding on Scroll
      const currentScrollY = canvas.scrollTop;
      if (currentScrollY > lastScrollY.current + 5) {
        if (uiVisible) setUiVisible(false);
      }
      lastScrollY.current = currentScrollY;

      const total = canvas.scrollHeight - canvas.clientHeight;
      if (total > 200) {
        setScrollProgress((canvas.scrollTop / total) * 100);
      } else {
        setScrollProgress(0);
        setScrolled(true);
      }
    };
    const canvas = canvasRef.current;
    if (canvas) canvas.addEventListener('scroll', handleScroll);
    return () => canvas?.removeEventListener('scroll', handleScroll);
  }, [reading, viewMode, uiVisible]);

  const getChapterCacheKey = useCallback((chapterId: string) => {
    return `${String(source)}:${String(id)}:${chapterId}`;
  }, [id, source]);

  const buildChapterPages = useCallback(async (chapter: Chapter) => {
    return getChapterPages(source as string, id as string, chapter.id);
  }, [id, source]);


  const ensureChapterPages = useCallback(async (chapter: Chapter) => {
    const cacheKey = getChapterCacheKey(chapter.id);
    
    // 1. Try In-Memory Cache
    const inMem = chapterPageCacheRef.current.get(cacheKey);
    if (inMem) return inMem;

    // 2. Try IndexedDB Persistent Cache
    const persistent = await getChapterFromCache(cacheKey);
    if (persistent) {
      chapterPageCacheRef.current.set(cacheKey, persistent);
      return persistent;
    }

    // 3. Dedup pending requests
    const pending = chapterPageRequestRef.current.get(cacheKey);
    if (pending) return pending;

    const request = buildChapterPages(chapter)
      .then((pages) => {
        chapterPageCacheRef.current.set(cacheKey, pages);
        if (pages && pages.length > 0) {
          void saveChapterToCache(cacheKey, pages);
        }
        return pages;
      })
      .finally(() => {
        chapterPageRequestRef.current.delete(cacheKey);
      });

    chapterPageRequestRef.current.set(cacheKey, request);
    return request;
  }, [buildChapterPages, getChapterCacheKey]);

  const preloadNeighborChapters = useCallback((idx: number) => {
    [idx - 1, idx + 1].forEach((neighborIdx) => {
      const chapter = chapters[neighborIdx];
      if (!chapter) return;
      void ensureChapterPages(chapter).catch(() => {});
    });
  }, [chapters, ensureChapterPages]);

  const loadChapterPages = useCallback(async (idx: number) => {
    const chapter = chapters[idx];
    if (!chapter) return;

    setCurrentPage(0);
    setScrolled(false);
    setScrollProgress(0);

    setReaderLoading(true);
    
    // Artificial minimum delay to give visual feedback of transition
    const minDelay = new Promise(resolve => setTimeout(resolve, 600));

    try {
      const cacheKey = getChapterCacheKey(chapter.id);
      
      // We still try the cache here for the minimum delay logic
      const chapterPages = await ensureChapterPages(chapter);
      
      await minDelay; // Ensure the user sees the loader
      setPages(chapterPages);
      preloadNeighborChapters(idx);
    } catch (e) {
      console.error(e);
      alert("Error loading chapter.");
    } finally {
      setReaderLoading(false);
      canvasRef.current?.scrollTo(0, 0);
    }
  }, [chapters, ensureChapterPages, getChapterCacheKey, preloadNeighborChapters]);

  const fetchComicDetails = useCallback(async () => {
    const chaptersCacheKey = `chapters_${source}_${id}_${mangaLanguage}`;
    const comicCacheKey = `comic_${source}_${id}_${mangaLanguage}`;

    // 1. Try local cache first for instant UI
    const cachedChapters = readStorageItem(chaptersCacheKey);
    const cachedComic = readStorageItem(comicCacheKey);
    if (cachedChapters) setChapters(JSON.parse(cachedChapters));
    if (cachedComic) setComic(JSON.parse(cachedComic));

    setLoading(!cachedComic);
    try {
      const [comicData, chapterData] = await Promise.all([
        getComicDetails(source as string, id as string, mangaLanguage),
        getChapters(source as string, id as string, mangaLanguage)
      ]);
      
      if (comicData) {
        setComic(comicData);
        writeStorageItem(comicCacheKey, JSON.stringify(comicData));
        if (comicData.marvelIssue) setMarvelIssue(comicData.marvelIssue);
        if (comicData.marvelSeries) setMarvelSeries(comicData.marvelSeries as MarvelSeries);
        if (comicData.marvelSeriesIssues) setMarvelSeriesIssues(comicData.marvelSeriesIssues as MarvelSeriesIssue[]);
        if (comicData.marvelCharacters) setMarvelCharacters(comicData.marvelCharacters as MarvelCharacter[]);
      }
      if (chapterData) {
        setChapters(chapterData as Chapter[]);
        writeStorageItem(chaptersCacheKey, JSON.stringify(chapterData));
        // Reset reader if language changed while reading
        if (reading) {
          setCurrentChapterIdx(0);
          void loadChapterPages(0);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, source, mangaLanguage, reading, loadChapterPages]);


  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchComicDetails();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, source, mangaLanguage]);

  useEffect(() => {
    if (comic && isAdultComic(comic) && !isAgeVerified && !showAgeGate) {
      const timer = setTimeout(() => setShowAgeGate(true), 0);
      return () => clearTimeout(timer);
    }
  }, [comic, isAgeVerified, showAgeGate]);

  const handleAgeVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };

  useEffect(() => {
    if (reading) {
      document.body.style.backgroundColor = '#000000';
    } else {
      document.body.style.backgroundColor = '';
    }
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [reading]);

  useEffect(() => {
    if (!comic || chapters.length === 0) return;
    void ensureChapterPages(chapters[0]).catch(() => {});
  }, [comic, chapters, ensureChapterPages]);

  const startReading = () => {
    setReading(true);
    setViewMode(isMobile ? 'flow' : 'classic');
    void loadChapterPages(0);
  };

  const nextChapter = useCallback(() => {
    if (currentChapterIdx < chapters.length - 1) {
      const next = currentChapterIdx + 1;
      setCurrentChapterIdx(next);
      void loadChapterPages(next);
    }
  }, [currentChapterIdx, chapters.length, loadChapterPages]);

  const prevChapter = useCallback(() => {
    if (currentChapterIdx > 0) {
      const prev = currentChapterIdx - 1;
      setCurrentChapterIdx(prev);
      void loadChapterPages(prev);
    }
  }, [currentChapterIdx, loadChapterPages]);

  const handleNextPage = useCallback(() => {
    const step = (viewMode === 'journal' && !(isSpreadCover && currentPage === 0)) ? 2 : 1;
    if (currentPage < pages.length - step) {
      setCurrentPage(p => p + step);
      canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      nextChapter();
    }
  }, [viewMode, isSpreadCover, currentPage, pages.length, nextChapter]);

  const handlePrevPage = useCallback(() => {
    const step = (viewMode === 'journal' && !(isSpreadCover && currentPage <= 1)) ? 2 : 1;
    if (currentPage > 0) {
      setCurrentPage(p => Math.max(0, p - step));
      canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      prevChapter();
    }
  }, [viewMode, isSpreadCover, currentPage, prevChapter]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!reading) return;
      
      if (e.key === 'ArrowLeft') handlePrevPage();
      if (e.key === 'ArrowRight' || e.key === ' ') {
         handleNextPage();
         if (e.key === ' ') e.preventDefault();
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        canvasRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        if (e.key === 'PageDown') e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        canvasRef.current?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
        if (e.key === 'PageUp') e.preventDefault();
      }
      if (e.key === 'Home') {
        setCurrentPage(0);
        canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (e.key === 'End') {
        setCurrentPage(pages.length - 1);
        canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (e.key === 'Escape') setReading(false);
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) readerRef.current?.requestFullscreen();
        else document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reading, currentPage, pages.length, viewMode, currentChapterIdx, isSpreadCover, handleNextPage, handlePrevPage]);

  if (loading) return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="w-12 h-12 text-[#ff4d00] animate-spin" />
        <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Syncing_Neural_Matrix...</div>
      </div>
    </div>
  );

  if (!comic && showAgeGate) {
    return (
      <div className="min-h-screen bg-[#020202] text-white overflow-x-hidden selection:bg-[#ff4d00] selection:text-white">
        <AnimatePresence>
          {showAgeGate && (
            <AgeGateOverlay
              title={t.restricted}
              description={t.ageDesc}
              confirmLabel={t.verifyBtn}
              cancelLabel={t.cancelBtn}
              confirmAction={handleAgeVerify}
              cancelAction={() => router.push('/library')}
              zIndex={10000}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (!comic) return null;

  if (comic.source === 'marvel' && !marvelIssue) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="w-12 h-12 text-[#ff4d00] animate-spin" />
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Loading_Marvel_Metadata...</div>
        </div>
      </div>
    );
  }

  if (comic.source === 'marvel' && marvelIssue) {
    return (
      <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-[#ff4d00] selection:text-white">
        <div className="fixed inset-0 z-0 h-[45vh] md:h-[65vh]">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/85 to-[#050505] z-10" />
          <Image
            src={comic.bannerUrl || comic.coverUrl}
            fill
            className="object-cover opacity-20 grayscale blur-3xl scale-110"
            alt=""
            priority
            unoptimized
          />
        </div>

        <main className="relative z-10 pt-24 md:pt-28 pb-24 px-4 md:px-20 max-w-7xl mx-auto">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.back()}
            className="mb-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-[#ff4d00] transition-all group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back_To_Marvel
          </motion.button>

          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-12 lg:gap-20 items-start">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 lg:sticky lg:top-28"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden border border-white/10 bg-[#0a0a0a]">
                <Image
                  src={comic.coverUrl}
                  fill
                  className="object-cover"
                  alt={comic.title}
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute top-4 left-4 px-3 py-1 bg-[#ff4d00] text-white text-[9px] font-black uppercase tracking-[0.35em]">
                  Marvel
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ff4d00]">
                    Issue {marvelIssue.issueNumber || '?'}
                  </div>
                  <div className="mt-2 text-2xl font-black uppercase tracking-tighter leading-[0.9]">
                    {comic.title}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={marvelIssue.detailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-4 px-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.25em] hover:bg-[#ff4d00] hover:text-white transition-all text-center"
                >
                  Open_Official
                </a>
                <button
                  onClick={() => router.push('/library')}
                  className="py-4 px-4 bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-[0.25em] hover:bg-white/10 hover:text-white transition-all"
                >
                  Back_To_Library
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 p-5 space-y-3">
                <div className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Issue_Metadata</div>
                <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.2em] text-white/55">
                  <div>
                    <div className="text-white/25">Series</div>
                    <div className="mt-1 font-black text-white">{marvelIssue.seriesName}</div>
                  </div>
                  <div>
                    <div className="text-white/25">Year</div>
                    <div className="mt-1 font-black text-white">{marvelIssue.yearPage || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-white/25">On Sale</div>
                    <div className="mt-1 font-black text-white">{formatMarvelDate(marvelIssue.onSaleDate)}</div>
                  </div>
                  <div>
                    <div className="text-white/25">Unlimited</div>
                    <div className="mt-1 font-black text-white">{formatMarvelDate(marvelIssue.unlimitedDate)}</div>
                  </div>
                  <div>
                    <div className="text-white/25">Pages</div>
                    <div className="mt-1 font-black text-white">{marvelIssue.pageCount ?? 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-white/25">Modified</div>
                    <div className="mt-1 font-black text-white">{formatMarvelDate(marvelIssue.modified)}</div>
                  </div>
                </div>
              </div>

              {marvelCharacters.length > 0 && (
                <div className="bg-white/5 border border-white/10 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Character_Registry</div>
                    <Sparkles className="text-[#ff4d00]" size={16} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {marvelCharacters.slice(0, 10).map((character) => (
                      <button
                        key={character.id}
                        onClick={() => router.push(`/library?tab=Marvel%20Universe&q=${encodeURIComponent(character.name || '')}`)}
                        className="group px-3 py-2 bg-black/40 border border-white/10 hover:border-[#ff4d00]/50 hover:bg-[#ff4d00]/10 transition-all text-left"
                      >
                        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-white group-hover:text-[#ff4d00]">
                          {character.name}
                        </div>
                        {character.description && (
                          <div className="mt-1 max-w-[150px] text-[8px] uppercase tracking-[0.18em] text-white/25 group-hover:text-white/45 line-clamp-2">
                            {trimText(character.description, 90)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-10"
            >
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-2 bg-[#ff4d00] text-white text-[10px] font-black uppercase tracking-[0.3em]">
                    Marvel_Metadata
                  </span>
                  <span className="px-4 py-2 bg-white/5 border border-white/10 text-white/45 text-[10px] font-black uppercase tracking-[0.3em]">
                    Issue #{marvelIssue.issueNumber || '?'}
                  </span>
                  <span className="px-4 py-2 bg-white/5 border border-white/10 text-white/45 text-[10px] font-black uppercase tracking-[0.3em]">
                    {comic.rating}
                  </span>
                </div>

                <h1 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter leading-[0.88]">
                  {comic.title}
                </h1>
                <p className="max-w-3xl text-white/55 text-base md:text-lg leading-relaxed">
                  {comic.description}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Series</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-tight">{marvelIssue.seriesName}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Issue</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-tight">#{marvelIssue.issueNumber || '?'}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Year</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-tight">{marvelIssue.yearPage || 'Unknown'}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Pages</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-tight">{marvelIssue.pageCount ?? 'Unknown'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8">
                <div className="bg-[#0a0a0a] border border-white/10 p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Creators</div>
                      <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Credits</h2>
                    </div>
                    <BookOpen className="text-[#ff4d00]" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(marvelIssue.creators || []).map((creator) => (
                      <div key={`${creator.id}-${creator.role}`} className="p-4 bg-white/5 border border-white/10">
                        <div className="text-[8px] uppercase tracking-[0.35em] text-white/25">{creator.role}</div>
                        <div className="mt-2 text-sm font-black uppercase leading-tight">{creator.name}</div>
                      </div>
                    ))}
                    {(marvelIssue.creators || []).length === 0 && (
                      <div className="sm:col-span-2 p-6 text-center text-white/30 text-[10px] font-black uppercase tracking-[0.35em] border border-dashed border-white/10">
                        No creator metadata available.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#0a0a0a] border border-white/10 p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Series Order</div>
                      <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Issues</h2>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/35">
                      {marvelSeriesIssues.length} total
                    </span>
                  </div>

                  <div className="max-h-[640px] overflow-auto pr-2 space-y-3">
                    {marvelSeriesIssues.slice(0, 18).map((issue) => (
                      <button
                        key={issue.id}
                        onClick={() => router.push(`/library/marvel/${issue.id}`)}
                        className="w-full text-left p-4 bg-white/5 border border-white/10 hover:border-[#ff4d00]/60 hover:bg-[#ff4d00]/10 transition-all flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-[8px] uppercase tracking-[0.35em] text-white/25">
                            #{issue.issueNumber || issue.id}
                          </div>
                          <div className="mt-2 text-sm font-black uppercase leading-tight truncate">
                            {issue.title}
                          </div>
                          <div className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/30 truncate">
                            {formatMarvelDate(issue.onSaleDate)}
                          </div>
                        </div>
                        <div className="text-[#ff4d00] text-[9px] font-black uppercase tracking-[0.3em]">
                          Open
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {marvelSeries && (
                <div className="bg-[#0a0a0a] border border-white/10 p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Series Endpoint</div>
                      <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Series Intel</h2>
                    </div>
                    <Globe className="text-[#ff4d00]" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
                    <div className="aspect-[2/3] bg-black border border-white/10 overflow-hidden relative">
                      <Image
                        src={normalizeMarvelImage(marvelSeries.thumbnail) || comic.coverUrl}
                        alt={marvelSeries.title || marvelIssue.seriesName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ff4d00]">
                          {marvelSeries.title || marvelIssue.seriesName}
                        </div>
                        <p className="mt-3 max-w-3xl text-white/55 text-base leading-relaxed">
                          {trimText(marvelSeries.description, 300) || 'Series metadata fetched directly from the Marvel series endpoint.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/5 border border-white/10 p-4">
                          <div className="text-[8px] uppercase tracking-[0.35em] text-white/25">Series ID</div>
                          <div className="mt-2 text-sm font-black uppercase tracking-tight">{marvelSeries.id}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4">
                          <div className="text-[8px] uppercase tracking-[0.35em] text-white/25">Start Year</div>
                          <div className="mt-2 text-sm font-black uppercase tracking-tight">{marvelSeries.startYear || 'Unknown'}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4">
                          <div className="text-[8px] uppercase tracking-[0.35em] text-white/25">End Year</div>
                          <div className="mt-2 text-sm font-black uppercase tracking-tight">{marvelSeries.endYear || 'Ongoing'}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4">
                          <div className="text-[8px] uppercase tracking-[0.35em] text-white/25">Updated</div>
                          <div className="mt-2 text-sm font-black uppercase tracking-tight">{formatMarvelDate(marvelSeries.modified)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  const titleLength = comic.title.trim().length;
  const titleSizeClass = titleLength > 80
    ? 'text-[clamp(2rem,3.8vw,4.4rem)]'
    : titleLength > 55
      ? 'text-[clamp(2.3rem,4.2vw,5rem)]'
      : titleLength > 35
        ? 'text-[clamp(2.7rem,5vw,6rem)]'
        : 'text-[clamp(3rem,5.4vw,6.8rem)]';
  const titleWidthClass = titleLength > 55
    ? 'max-w-[12ch] 2xl:max-w-[14ch]'
    : 'max-w-[14ch] 2xl:max-w-[16ch]';
  const pageBackdropStyle = {
    backgroundImage: `
      radial-gradient(circle at 18% 18%, rgba(255, 77, 0, 0.14), transparent 26%),
      radial-gradient(circle at 82% 12%, rgba(255, 255, 255, 0.05), transparent 22%),
      radial-gradient(circle at 50% 100%, rgba(255, 77, 0, 0.07), transparent 30%),
      linear-gradient(180deg, #090909 0%, #050505 45%, #020202 100%)
    `
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white overflow-x-hidden selection:bg-[#ff4d00] selection:text-white">
      {/* Age Gate Overlay */}
      <AnimatePresence>
        {showAgeGate && (
          <AgeGateOverlay
            title={t.restricted}
            description={t.ageDesc}
            confirmLabel={t.verifyBtn}
            cancelLabel={t.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => router.push('/library')}
            zIndex={20000}
          />
        )}
      </AnimatePresence>

      {/* Clean Backdrop */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#020202]" style={pageBackdropStyle}>
        <div className="absolute inset-0 opacity-[0.08] mix-blend-soft-light" style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '72px 72px'
        }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_58%,rgba(0,0,0,0.6)_100%)]" />
      </div>

      <main className="relative z-10 pt-24 pb-24 px-4 sm:px-6 md:px-20 max-w-7xl mx-auto">
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => router.back()} className="mb-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-[#ff4d00] transition-all group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Neural_Backtrack
        </motion.button>

        <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] backdrop-blur-xl shadow-[0_40px_140px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-10 lg:gap-24 items-start p-4 sm:p-6 md:p-10 lg:p-12">
          {/* Side Info */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="space-y-10 lg:sticky lg:top-32">
            <div className="group relative aspect-[2/3] w-full bg-[#0a0a0a] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
               <Image 
                 src={comic.coverUrl} 
                 fill
                 className="object-cover group-hover:scale-105 transition-transform duration-700" 
                 alt={comic.title} 
                 unoptimized
               />
               <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-[#ff4d00] text-white text-[9px] font-black uppercase italic shadow-lg">HQ_Asset</div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
               {comic.source !== 'superhero' && (
                 <motion.button 
                   onClick={startReading} 
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                   className="group relative py-6 bg-white text-black flex items-center justify-center gap-3 font-black uppercase tracking-[0.5em] text-[12px] overflow-hidden transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
                 >
                   <motion.div 
                     animate={{ 
                       opacity: [0, 0.2, 0],
                       scale: [1, 1.5, 1]
                     }}
                     transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                     className="absolute inset-0 bg-[#ff4d00] blur-3xl z-0"
                   />
                   <span className="relative z-10 flex items-center gap-3"><Play fill="currentColor" size={16} /> {t.read}</span>
                 </motion.button>
               )}
               {comic.source === 'superhero' && (
                 <button onClick={() => router.push('/studio')} className="group relative py-6 bg-[#ff4d00] text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] overflow-hidden transition-all hover:bg-white hover:text-black">
                   <div className="absolute left-0 top-0 bottom-0 w-0 bg-black group-hover:w-full transition-all duration-500 z-0 opacity-10" />
                   <span className="relative z-10 flex items-center gap-3"><Sparkles fill="currentColor" size={16} /> Forge_Character</span>
                 </button>
               )}
               <div className="grid grid-cols-2 gap-4">
                  <button className="py-4 border border-white/10 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"><Bookmark size={14} /> Bookmark</button>
                  <button className="py-4 border border-white/10 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"><Share2 size={14} /> Share</button>
               </div>
            </div>
          </motion.div>

          {/* Main Info */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-16">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-4">
                 <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                    <Star size={12} className="text-[#ff4d00]" fill="#ff4d00" /><span className="text-[12px] font-black tracking-tighter">{comic.rating}</span>
                 </div>
                 <div className="px-4 py-2 bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
                    {comic.source}
                 </div>
                 <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-[0.3em]"><Clock size={12} /> {comic.year || 'N/A'}</div>
                 <div className="px-4 py-2 bg-[#ff4d00]/10 border border-[#ff4d00]/30 text-[#ff4d00] text-[10px] font-black uppercase tracking-widest">{comic.status}</div>
              </div>
              
                <h1 className={`${titleSizeClass} ${titleWidthClass} font-black italic uppercase tracking-tighter leading-[0.92] text-balance break-words`}>
                  {comic.title}
                </h1>

              <div className="flex flex-wrap gap-2 pt-4">
                {comic.genres.map(genre => (
                  <span key={genre} className="px-4 py-2 bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.15em] text-white/50 hover:text-white hover:border-white/30 transition-all cursor-default">
                    {genre}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-8">
               <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">Story_Archive_Log</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
               </div>
               <div className="max-w-4xl rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 text-base md:text-lg text-white/65 italic leading-relaxed description-content max-h-[44vh] overflow-y-auto pr-3">
                 <RichTextContent
                   content={String(comic.description || "")
                     .replace(/\[b\]/g, '')
                     .replace(/\[\/b\]/g, '')
                     .replace(/\[i\]/g, '')
                     .replace(/\[\/i\]/g, '')}
                 />
               </div>
            </div>

            {/* Conditional Content based on source */}
            {comic.source === 'superhero' && (comic as any).superheroData ? (
               <div className="space-y-10">
                  <div className="space-y-6">
                     <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">Power_Metrics</h3>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries((comic as any).superheroData.powerstats || {}).map(([stat, val]) => (
                           <div key={stat} className="bg-white/5 border border-white/10 p-5 flex flex-col items-center justify-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">{stat}</span>
                              <span className="text-2xl font-black italic text-white">{val === 'null' ? '?' : String(val)}</span>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 border-b border-white/10 pb-2">Appearance</div>
                        <div className="space-y-2 text-xs font-bold text-white/70 uppercase tracking-widest leading-relaxed">
                           <p><span className="text-[#ff4d00]">Gender:</span> {(comic as any).superheroData.appearance?.gender}</p>
                           <p><span className="text-[#ff4d00]">Race:</span> {(comic as any).superheroData.appearance?.race}</p>
                           <p><span className="text-[#ff4d00]">Height:</span> {(comic as any).superheroData.appearance?.height?.join(' / ')}</p>
                           <p><span className="text-[#ff4d00]">Weight:</span> {(comic as any).superheroData.appearance?.weight?.join(' / ')}</p>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 border-b border-white/10 pb-2">Work_&_Base</div>
                        <div className="space-y-2 text-xs font-bold text-white/70 uppercase tracking-widest leading-relaxed">
                           <p><span className="text-[#ff4d00]">Occupation:</span> {(comic as any).superheroData.work?.occupation}</p>
                           <p><span className="text-[#ff4d00]">Base:</span> {(comic as any).superheroData.work?.base}</p>
                        </div>
                     </div>
                  </div>
                  
                  <div className="space-y-4">
                     <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 border-b border-white/10 pb-2">Connections</div>
                     <div className="bg-white/[0.02] border border-white/5 p-6 space-y-4 text-xs font-bold text-white/70 leading-loose">
                        <p><span className="text-[#ff4d00] uppercase tracking-widest mr-2">Affiliation:</span> {(comic as any).superheroData.connections?.['group-affiliation']}</p>
                        <p><span className="text-[#ff4d00] uppercase tracking-widest mr-2">Relatives:</span> {(comic as any).superheroData.connections?.relatives}</p>
                     </div>
                  </div>
               </div>
            ) : (
              <div className="space-y-8">
                 <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-white/40">Synchronized_Chapters</h3>
                    <span className="text-[10px] font-black text-[#ff4d00] uppercase tracking-widest">{chapters.length} FOUND</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-4">
                    {chapters.map((ch, i) => (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setCurrentChapterIdx(i);
                          setReading(true);
                          void loadChapterPages(i);
                        }}
                        className={`group flex items-center justify-between p-5 transition-all text-left border ${
                          i === currentChapterIdx
                            ? 'bg-[#ff4d00]/10 border-[#ff4d00]/50 shadow-[0_0_0_1px_rgba(255,77,0,0.18)]'
                            : 'bg-white/5 border-white/5 hover:border-[#ff4d00]/50'
                        }`}
                      >
                         <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#ff4d00]">Vol.{ch.volume || '0'} Ch.{ch.chapterNum}</div>
                            <div className="text-[13px] font-black uppercase tracking-tight group-hover:text-[#ff4d00] transition-colors break-words line-clamp-2">
                              {ch.title}
                            </div>
                            {i === currentChapterIdx && (
                              <div className="text-[8px] font-black uppercase tracking-[0.35em] text-[#ff4d00]">
                                Active_Chapter
                              </div>
                            )}
                         </div>
                         <ChevronRight size={20} className="text-white/20 group-hover:text-[#ff4d00] group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                 </div>
              </div>
            )}
          </motion.div>
        </div>
        </div>
      </main>

      {/* IDEAL PRO READER */}
      <AnimatePresence>
        {reading && (
          <motion.div 
            ref={readerRef} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[10000] bg-[#050505] flex flex-col overflow-hidden select-none [-webkit-tap-highlight-color:transparent]"
          >
            
                         {/* Unique Cyberpunk Loading Overlay */}
             <AnimatePresence mode="wait">
               {readerLoading && (
                 <motion.div 
                   key="loader"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="fixed inset-0 z-[10050] bg-[#020202] flex flex-col items-center justify-center overflow-hidden"
                 >
                    {/* Background Digital Rain Effect */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none overflow-hidden">
                       <div className="flex justify-between w-full h-full px-4 text-[8px] font-mono leading-none break-all animate-scroll-v">
                          {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className="w-[1px] h-full overflow-hidden opacity-50">
                               {Array.from({ length: 100 }).map((_, j) => (
                                 <div key={j} className="mb-2">{(Math.random() > 0.5 ? 1 : 0)}</div>
                               ))}
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Scanning Line Effect */}
                    <motion.div 
                      initial={{ top: "-10%" }}
                      animate={{ top: "110%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#ff4d00] to-transparent shadow-[0_0_20px_#ff4d00] z-20"
                    />

                    {/* Central Geometric Core */}
                    <div className="relative w-40 h-40 flex items-center justify-center mb-12">
                       <motion.div 
                         animate={{ rotate: 360 }}
                         transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                         className="absolute inset-0 border-[1px] border-[#ff4d00]/20 rounded-xl"
                       />
                       <motion.div 
                         animate={{ rotate: -360 }}
                         transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                         className="absolute inset-4 border-[1px] border-[#ff4d00]/10 rounded-full"
                       />
                       <motion.div 
                         animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                         transition={{ duration: 2, repeat: Infinity }}
                         className="w-16 h-16 bg-gradient-to-br from-[#ff4d00] to-[#ff9000] rounded-sm rotate-45 shadow-[0_0_40px_rgba(255,77,0,0.4)]"
                       />
                       <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-white/5 overflow-hidden">
                          <motion.div 
                            animate={{ left: ["-100%", "100%"] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 bg-[#ff4d00] w-1/2"
                          />
                       </div>
                    </div>

                    <div className="text-center relative z-10 space-y-2">
                      <motion.div 
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 0.1, repeat: Infinity, repeatDelay: Math.random() * 2 }}
                        className="text-[12px] font-black uppercase tracking-[1.2em] text-white pl-[1.2em]"
                      >
                         Syncing_Matrix
                      </motion.div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.6em] text-[#ff4d00]/50">
                         Unit_{chapters[currentChapterIdx]?.chapterNum || '00'}
                      </div>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* Chapter Loaded Toast */}
             <AnimatePresence>
               {!readerLoading && pages.length > 0 && scrolled && (
                 <motion.div 
                   key="toast"
                   initial={{ y: -100, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   exit={{ y: -100, opacity: 0 }}
                   className="fixed top-8 left-1/2 -translate-x-1/2 z-[10045] bg-white/5 backdrop-blur-xl border border-white/10 px-8 py-3 rounded-2xl flex items-center justify-center shadow-2xl pointer-events-none"
                 >
                    <div className="text-[11px] font-black uppercase tracking-widest text-white/80">
                       Chapter {chapters[currentChapterIdx]?.chapterNum}
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* Action Modal (Bottom Sheet) */}
            <AnimatePresence>
              {uiVisible && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setUiVisible(false)}
                    className="fixed inset-0 z-[10020] bg-black/70 backdrop-blur-sm ui-element"
                  />
                  <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="ui-element fixed bottom-0 left-0 right-0 z-[10030] bg-[#0a0a0a] border-t border-white/10 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.8)] pb-[max(env(safe-area-inset-bottom),2rem)] pt-6 px-6 md:px-12 flex flex-col gap-8 max-h-[85vh] overflow-y-auto custom-scrollbar"
                  >
                    <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2" />
                    
                    {/* Header: Title & Close Reader */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Active_Matrix</div>
                        <div className="text-[14px] md:text-[18px] font-black uppercase tracking-tight truncate text-white">{comic.title}</div>
                      </div>
                      <button 
                        onClick={() => setReading(false)} 
                        className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95"
                      >
                        <X size={24}/>
                      </button>
                    </div>

                    {/* Controls Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Col: Navigation & View Mode */}
                      <div className="space-y-8">
                         {/* View Mode */}
                         <div className="space-y-4">
                           <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Reading Mode</div>
                           <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl">
                              <button onClick={() => { setViewMode('classic'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'classic' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <Monitor size={16} className="max-md:hidden"/>
                                <Smartphone size={16} className="md:hidden"/>
                                Classic
                              </button>
                              <button onClick={() => { setViewMode('journal'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'journal' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <Columns size={16} className="max-md:hidden"/>
                                <Smartphone size={16} className="md:hidden rotate-90"/>
                                Journal
                              </button>
                              <button onClick={() => { setViewMode('flow'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'flow' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <Smartphone size={16}/> Flow
                              </button>
                           </div>
                         </div>

                         {/* Chapter Navigation */}
                         <div className="space-y-4">
                           <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center justify-between">
                              <span>Chapter {chapters[currentChapterIdx]?.chapterNum || '0'}</span>
                              <span className="text-[#ff4d00]">{chapters.length} Total</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <button 
                                onClick={() => { prevChapter(); setUiVisible(false); }} 
                                disabled={currentChapterIdx === 0}
                                className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-20 transition-all active:scale-95 flex items-center justify-center gap-2"
                              >
                                <ChevronLeft size={18} /> Prev
                              </button>
                              <button 
                                onClick={() => { nextChapter(); setUiVisible(false); }} 
                                disabled={currentChapterIdx === chapters.length - 1}
                                className="flex-1 h-14 bg-[#ff4d00] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-20 transition-all shadow-[0_4px_20px_rgba(255,77,0,0.3)] active:scale-95 flex items-center justify-center gap-2"
                              >
                                Next <ChevronRight size={18} />
                              </button>
                           </div>
                         </div>
                      </div>

                      {/* Right Col: Progress & Tools */}
                      <div className="space-y-8">
                         {/* Progress Scrubber */}
                         <div className="space-y-4">
                           <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.2em]">
                             <span className="text-white/40">Progress</span>
                             <span className="text-[#ff4d00]">
                               {viewMode === 'flow' ? `${Math.round(scrollProgress)}%` : `Page ${currentPage + 1} of ${pages.length}`}
                             </span>
                           </div>
                           <div className="py-2">
                             <input 
                               type="range" 
                               min="0" 
                               max={pages.length - 1} 
                               value={viewMode === 'flow' ? Math.floor((scrollProgress / 100) * (pages.length - 1)) : currentPage} 
                               onChange={(e) => {
                                 const val = parseInt(e.target.value);
                                 setCurrentPage(val);
                                 if (viewMode === 'flow') {
                                   document.getElementById(`page-${val}`)?.scrollIntoView({ behavior: 'smooth' });
                                 } else {
                                   canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                                 }
                               }}
                               className="w-full h-2 bg-white/10 appearance-none cursor-pointer accent-[#ff4d00] rounded-full transition-all"
                             />
                           </div>
                         </div>

                         {/* Extra Tools */}
                         <div className="space-y-4">
                           <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Tools</div>
                           <div className="flex items-center gap-3">
                              <button onClick={() => setShowGrid(true)} className="flex-1 h-14 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded-xl text-[11px] font-black uppercase tracking-widest">
                                 <List size={18}/> Overview
                              </button>
                              {viewMode === 'journal' && (
                                <button 
                                  onClick={() => setIsSpreadCover(!isSpreadCover)} 
                                  className={`flex-1 h-14 flex items-center justify-center gap-2 border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isSpreadCover ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:text-white'}`}
                                >
                                  <Columns size={18}/> Offset
                                </button>
                              )}
                              {viewMode === 'flow' && (
                                <button 
                                  onClick={() => {
                                    setUiVisible(false);
                                    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                  }} 
                                  className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-90"
                                >
                                  <ChevronUp size={18}/> Jump_To_Top
                                </button>
                              )}
                           </div>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* UI Toggle FAB */}
            <div className={`fixed bottom-8 right-8 z-[10040] transition-all duration-300 ${uiVisible ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}>
               <button 
                 onClick={() => setUiVisible(true)}
                 className="w-16 h-16 bg-[#ff4d00] text-white rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(255,77,0,0.5)] border border-[#ff4d00]/50 active:scale-90 hover:scale-105 transition-all"
               >
                 <Settings size={28} />
               </button>
            </div>
            
            {/* Minimal Exit Button (Always visible but subtle) */}
            <div className={`fixed top-8 left-8 z-[10040] transition-all duration-300 ${uiVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
               <button 
                 onClick={() => setReading(false)}
                 className="w-12 h-12 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-[#ff4d00] hover:border-[#ff4d00] transition-all active:scale-90"
               >
                 <X size={20} />
               </button>
            </div>

            {/* Reader Canvas */}
            <div 
               ref={canvasRef} 
               className="flex-1 w-full bg-[#050505] overflow-y-auto custom-scrollbar relative scroll-smooth touch-pan-y" 
               id="reader-canvas"
               onClick={() => {}}
               onTouchStart={(e) => {
                 if (viewMode === 'flow') return;
                 touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
               }}
               onTouchEnd={(e) => {
                if (viewMode === 'flow') return;
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const diffX = touchStartRef.current.x - endX;
                const diffY = touchStartRef.current.y - endY;
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
                  if (diffX > 0) handleNextPage();
                  else handlePrevPage();
                }
              }}
            >
               {/* Scroll Hint Removed */}

               {/* Carousel-Style Nav Buttons (Interactive Areas) */}
               {viewMode !== 'flow' && (
                 <>
                   {/* Left Hover Area */}
                   <div 
                   className="fixed inset-y-0 left-0 w-[25%] md:w-[20%] z-[10015] group/nav cursor-pointer"
                     onClick={(e) => { e.stopPropagation(); handlePrevPage(); }}
                   >
                      <div className="absolute top-1/2 left-8 -translate-y-1/2 opacity-0 group-hover/nav:opacity-100 transition-all duration-300 transform -translate-x-4 group-hover/nav:translate-x-0 hidden md:block">
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-[#ff4d00] hover:scale-110 transition-all shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                           <ChevronLeft size={32} className="text-white" />
                        </div>
                      </div>
                      <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/40 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity pointer-events-none" />
                   </div>

                   {/* Right Hover Area */}
                   <div 
                   className="fixed inset-y-0 right-0 w-[25%] md:w-[20%] z-[10015] group/nav cursor-pointer"
                     onClick={(e) => { e.stopPropagation(); handleNextPage(); }}
                   >
                      <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-0 group-hover/nav:opacity-100 transition-all duration-300 transform translate-x-4 group-hover/nav:translate-x-0 text-right hidden md:block">
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-[#ff4d00] hover:scale-110 transition-all shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                           <ChevronRight size={32} className="text-white" />
                        </div>
                      </div>
                      <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-black/40 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity pointer-events-none" />
                   </div>

                    {/* Center Tap Area (UI Toggle) */}
                    <div 
                      className="fixed inset-y-0 left-[25%] right-[25%] md:left-[20%] md:right-[20%] z-[10015] cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setUiVisible(prev => !prev); }}
                    />
                 </>
               )}

               {readerLoading ? (
                 <div className="h-full flex flex-col items-center justify-center gap-8">
                    <Loader2 className="w-16 h-16 text-[#ff4d00] animate-spin" />
                    <div className="text-[12px] font-black uppercase tracking-[0.8em] text-white/20 animate-pulse">Syncing_Assets...</div>
                 </div>
               ) : pages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center gap-8 p-10 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#ff4d00]/20 blur-[60px] rounded-full" />
                      <Sparkles className="w-20 h-20 text-white/20 relative z-10" />
                    </div>
                    <div className="space-y-4 max-w-md relative z-10">
                      <div className="text-[14px] font-black uppercase tracking-[0.4em] text-white/40">Empty_Chapter_Buffer</div>
                      <p className="text-white/30 text-[13px] leading-relaxed font-bold uppercase tracking-tight">
                        This chapter contains no direct image assets. It may be an external link or currently unavailable in the local matrix.
                      </p>
                      {chapters[currentChapterIdx]?.externalUrl && (
                        <a 
                          href={chapters[currentChapterIdx].externalUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-3 px-8 py-4 bg-[#ff4d00] text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition-all shadow-[0_10px_40px_rgba(255,77,0,0.3)] active:scale-95 mt-6"
                        >
                          <ExternalLink size={18} /> Open_External_Source
                        </a>
                      )}
                    </div>
                 </div>
               ) : (
                  <div className={`mx-auto flex flex-col items-center transition-all duration-500 ${
                    viewMode === 'flow' 
                      ? 'w-full pt-0 pb-20' 
                      : 'min-h-[calc(100vh-40px)] justify-center py-10 md:py-20'
                  }`}>
                    
                    {viewMode === 'classic' ? (
                       <div className="relative flex items-center justify-center w-full min-h-[80vh]">
                         <motion.img 
                          key={currentPage} 
                          initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }} 
                          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} 
                          exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                          src={pages[currentPage]} 
                          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', maxWidth: isMobile ? '100%' : '80vw', maxHeight: '90vh', width: 'auto', height: 'auto' }} 
                          className="shadow-[0_0_150px_rgba(0,0,0,0.9)] border border-white/10 rounded-sm object-contain" alt="" 
                          onClick={() => {}}
                         />
                       </div>
                    ) : viewMode === 'journal' ? (
                       <div className="flex items-center justify-center w-full max-w-[98vw] gap-0 transition-all duration-500 min-h-[85vh]" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                          {/* Left Page */}
                          <AnimatePresence mode="wait">
                            {(currentPage === 0 && isSpreadCover) ? (
                              <motion.div 
                                key="cover" 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                className="flex justify-center w-full"
                              >
                                <div className="relative max-h-[90vh] w-full aspect-[2/3] flex justify-center">
                                  <Image 
                                    src={pages[0]} 
                                    fill
                                    className="object-contain shadow-2xl border border-white/10 rounded-sm" 
                                    alt="cover" 
                                    unoptimized
                                    onClick={() => {}}
                                  />
                                </div>
                              </motion.div>
                            ) : (
                              <div className="flex items-center justify-center w-full gap-0">
                                <motion.div
                                  key={currentPage}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="relative flex-1 aspect-[2/3] max-h-[90vh]"
                                >
                                  <div className="absolute inset-0 bg-[#050505] overflow-hidden z-0 flex items-center justify-center">
                                    <motion.div 
                                      animate={{ opacity: [0.03, 0.08, 0.03] }}
                                      transition={{ duration: 2, repeat: Infinity }}
                                      className="absolute inset-0 bg-[#ff4d00]"
                                    />
                                    <Loader2 className="w-6 h-6 text-[#ff4d00]/20 animate-spin" />
                                  </div>
                                  <Image
                                    src={pages[currentPage]}
                                    fill
                                    className={`object-contain shadow-2xl relative z-10 transition-opacity duration-700 ease-in-out opacity-0 ${pages[currentPage + 1] ? 'border-r border-white/5 rounded-l-sm' : 'border border-white/10 rounded-sm'}`}
                                    onLoadingComplete={(img) => img.classList.remove('opacity-0')}
                                    alt={`Page ${currentPage + 1}`}
                                    unoptimized
                                    onClick={() => {}}
                                  />
                                </motion.div>
                                {pages[currentPage + 1] && (
                                  <motion.div
                                    key={currentPage + 1}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="relative flex-1 aspect-[2/3] max-h-[90vh]"
                                  >
                                    <div className="absolute inset-0 bg-[#050505] overflow-hidden z-0 flex items-center justify-center">
                                      <motion.div 
                                        animate={{ opacity: [0.03, 0.08, 0.03] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute inset-0 bg-[#ff4d00]"
                                      />
                                      <Loader2 className="w-6 h-6 text-[#ff4d00]/20 animate-spin" />
                                    </div>
                                    <Image
                                      src={pages[currentPage + 1]}
                                      fill
                                      className="object-contain shadow-2xl border-l border-white/5 rounded-r-sm relative z-10 transition-opacity duration-700 ease-in-out opacity-0"
                                      onLoadingComplete={(img) => img.classList.remove('opacity-0')}
                                      alt={`Page ${currentPage + 2}`}
                                      unoptimized
                                      onClick={() => {}}
                                    />
                                  </motion.div>
                                )}
                              </div>
                            )}
                          </AnimatePresence>
                       </div>
                     ) : (
                      <div 
                         className="flex flex-col items-center gap-0 w-full transition-all duration-500" 
                         style={{ 
                           maxWidth: isMobile ? '100%' : `${zoom * 800}px`,
                           width: '100%'
                         }}
                       >
                          {pages.map((p, i) => (
                            <div key={i} className="relative w-full aspect-[2/3] bg-[#050505] overflow-hidden border-b border-white/5">
                              {/* Deep Orange Pulse Skeleton */}
                              <div className="absolute inset-0 z-0 flex items-center justify-center">
                                 <motion.div 
                                   animate={{ opacity: [0.03, 0.08, 0.03] }}
                                   transition={{ duration: 2, repeat: Infinity }}
                                   className="absolute inset-0 bg-[#ff4d00]"
                                 />
                                 <div className="absolute flex flex-col items-center gap-4">
                                    <Loader2 className="w-8 h-8 text-[#ff4d00]/20 animate-spin" />
                                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff4d00]/20">Syncing_Page_{i+1}</div>
                                 </div>
                              </div>
                              
                              <Image 
                                id={`page-${i}`}
                                src={p + (source === 'archive' ? '?scale=2' : '')} 
                                alt={`Page ${i + 1}`}
                                fill
                                className="w-full h-auto object-contain relative z-10 transition-opacity duration-700 ease-in-out opacity-0" 
                                onLoadingComplete={(img) => img.classList.remove('opacity-0')}
                                loading="lazy" 
                                unoptimized
                                onClick={() => {}}
                              />
                            </div>
                          ))}
                          {currentChapterIdx < chapters.length - 1 && (
                            <button onClick={nextChapter} className="w-full py-40 mt-20 border-2 border-dashed border-white/5 hover:border-[#ff4d00]/50 hover:bg-[#ff4d00]/5 transition-all group flex flex-col items-center gap-4">
                               <div className="text-[12px] font-black uppercase tracking-[0.5em] text-white/20 group-hover:text-white">Next_Chapter_Ready</div>
                               <ChevronDown size={32} className="text-white/10 group-hover:text-[#ff4d00] animate-bounce" />
                            </button>
                          )}
                       </div>
                    )}
                 </div>
               )}
            </div>

            {/* Bottom Status Bar Removed (Replaced by Action Modal) */}
 
             {/* Page Grid Overview Overlay */}
             <AnimatePresence>
               {showGrid && (
                 <motion.div 
                   initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                   animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
                   exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                   className="fixed inset-0 z-[10050] bg-black/90 overflow-y-auto custom-scrollbar p-4 md:p-16"
                 >
                    {/* Grid Header */}
                    <div className="fixed top-0 left-0 right-0 h-24 bg-black/90 backdrop-blur-xl z-[10060] px-6 flex items-center justify-between border-b border-white/10 pt-[env(safe-area-inset-top)]">
                       <button onClick={() => setShowGrid(false)} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all active:scale-95">
                          <ChevronLeft size={20} /> <span className="max-md:hidden">BACK_TO_READER</span>
                       </button>
                       <div className="text-[11px] font-black uppercase tracking-[0.4em] text-white/60 text-center flex-1 truncate px-4">
                          {comic.title} <span className="text-[#ff4d00] max-md:hidden">/ OVERVIEW</span>
                       </div>
                       <button onClick={() => setShowGrid(false)} className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-red-600 transition-all active:scale-95"><X size={24}/></button>
                    </div>

                    <div className="mt-24 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8 max-w-7xl mx-auto">
                       {pages.map((p, i) => (
                         <motion.button
                           key={i}
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: i * 0.01 }}
                           onClick={() => {
                             setCurrentPage(i);
                             setShowGrid(false);
                             if (viewMode === 'flow') {
                               document.getElementById(`page-${i}`)?.scrollIntoView({ behavior: 'instant' });
                             } else {
                               canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                             }
                           }}
                           className={`group relative aspect-[2/3] bg-[#0a0a0a] border ${currentPage === i ? 'border-[#ff4d00] ring-4 ring-[#ff4d00]/20 scale-105 z-10' : 'border-white/10 hover:border-white/30'} transition-all overflow-hidden`}
                         >
                            <div className="relative w-full h-full">
                              <Image
                                src={p}
                                fill
                                className="object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                                alt={`Page ${i + 1}`}
                                unoptimized
                              />
                            </div>
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                               <div className="px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 text-[14px] font-black text-white group-hover:bg-[#ff4d00] group-hover:border-[#ff4d00] transition-all">
                                  {String(i + 1).padStart(2, '0')}
                                </div>
                            </div>
                         </motion.button>
                       ))}
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 77, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 77, 0, 0.5); }
        .description-content strong { color: white; }
        .description-content em { color: rgba(255,255,255,0.7); font-style: italic; }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ff4d00;
          cursor: pointer;
          box-shadow: 0 0 15px rgba(255, 77, 0, 0.6);
          border: 2px solid white;
          transition: transform 0.2s;
        }
        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.3);
        }
        input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ff4d00;
          cursor: pointer;
          box-shadow: 0 0 15px rgba(255, 77, 0, 0.6);
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
}
