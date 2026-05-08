"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, X, Settings,
  ChevronRight, Loader2, Sparkles,
  Smartphone, Monitor,
  ChevronUp,
  Columns, List, ExternalLink,
  Maximize2, Minimize2,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { readReadingHistory, upsertReadingHistory } from '@/lib/library-storage';
import { trackEvent } from '@/lib/analytics';
import { getChapterFromCache, saveChapterToCache } from '@/lib/comic-cache';
import {
  readStoredMangaLanguage,
  MangaLanguage,
} from '@/lib/manga-language';
import { calculateReadingProgressPercent, deriveReadingProgressStatus } from '@/lib/reading-progress';
import { getChapterPages, getComicDetails, getChapters } from '@/actions/comic';
import { isRestrictedLibrarySource } from '@/lib/comic-sources';
import type { ComicChapter, ComicDetail } from '@/lib/comic-types';
import Image from 'next/image';

interface ComicReaderClientProps {
  initialComic: ComicDetail | null;
  initialChapters?: ComicChapter[];
  source: string;
  id: string;
  chapterId: string;
  initialAgeVerified?: boolean;
}

type ReaderTheme = 'dark' | 'light' | 'sepia';

const READER_THEMES: Record<ReaderTheme, {
  shellBg: string;
  canvasBg: string;
  panelBg: string;
  panelAltBg: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
}> = {
  dark: {
    shellBg: '#050505',
    canvasBg: '#000000',
    panelBg: '#0a0a0a',
    panelAltBg: '#111111',
    border: 'rgba(255,255,255,0.10)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.40)',
    accent: '#ff4d00',
    accentSoft: 'rgba(255,77,0,0.10)',
  },
  light: {
    shellBg: '#f7f4ee',
    canvasBg: '#ffffff',
    panelBg: '#ffffff',
    panelAltBg: '#f3eee3',
    border: 'rgba(20,20,20,0.10)',
    text: '#121212',
    muted: 'rgba(0,0,0,0.45)',
    accent: '#ff5a1f',
    accentSoft: 'rgba(255,90,31,0.12)',
  },
  sepia: {
    shellBg: '#f4ecd8',
    canvasBg: '#f7f0df',
    panelBg: '#fffaf0',
    panelAltBg: '#efe3c8',
    border: 'rgba(67,52,34,0.16)',
    text: '#433422',
    muted: 'rgba(67,52,34,0.50)',
    accent: '#c46b2c',
    accentSoft: 'rgba(196,107,44,0.12)',
  },
};

const preloadImageUrl = (src: string) =>
  new Promise<void>((resolve) => {
    if (!src) {
      resolve();
      return;
    }
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });

/** Indices that must be decoded before we hide the page spinner. */
const getReaderVisibleIndices = (
  viewMode: 'classic' | 'flow' | 'journal',
  isSpreadCover: boolean,
  currentPage: number,
  total: number,
): number[] => {
  if (total <= 0 || viewMode === 'flow') return [];
  if (viewMode === 'classic') {
    return currentPage >= 0 && currentPage < total ? [currentPage] : [];
  }
  if (currentPage === 0 && isSpreadCover) {
    return [0].filter((i) => i < total);
  }
  return [currentPage, currentPage + 1].filter((i) => i >= 0 && i < total);
};

/**
 * Next pages to warm the HTTP cache while the user reads the current spread.
 * Classic: following single pages + one back step for prev navigation.
 * Journal: next double-page spreads (step 2) after the current pair.
 */
const getReaderLookaheadIndices = (
  viewMode: 'classic' | 'flow' | 'journal',
  isSpreadCover: boolean,
  currentPage: number,
  total: number,
  visible: number[],
): number[] => {
  if (total <= 0 || viewMode === 'flow') return [];

  const visibleSet = new Set(visible);
  const pushRange = (indices: number[]) =>
    indices.filter((i) => i >= 0 && i < total && !visibleSet.has(i));

  if (viewMode === 'classic') {
    return [...new Set(pushRange([currentPage + 1, currentPage + 2, currentPage + 3, currentPage - 1]))];
  }

  if (currentPage === 0 && isSpreadCover) {
    return [...new Set(pushRange([1, 2, 3, 4, 5, 6]))];
  }

  const step = 2;
  const nextStart = currentPage + step;
  return [
    ...new Set(
      pushRange([
        nextStart,
        nextStart + 1,
        nextStart + step,
        nextStart + step + 1,
        nextStart + step * 2,
        nextStart + step * 2 + 1,
      ]),
    ),
  ];
};

export default function ComicReaderClient({ initialComic, initialChapters, source, id, chapterId, initialAgeVerified = false }: ComicReaderClientProps) {
  const router = useRouter();
  
  const [comic, setComic] = useState<ComicDetail | null>(initialComic);
  const [chapters, setChapters] = useState<ComicChapter[]>(initialChapters || []);
  const [metadataLoading, setMetadataLoading] = useState(() => !initialComic || (initialChapters?.length || 0) === 0);
  
  const initialChapterIdx = chapters.findIndex(c => c.id === chapterId);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(initialChapterIdx >= 0 ? initialChapterIdx : 0);

  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t = translations[lang].library;

  // Reader State
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageReady, setPageReady] = useState(false);
  const [viewMode, setViewMode] = useState<'classic' | 'flow' | 'journal'>('classic');
  const [readerLoading, setReaderLoading] = useState(false);
  const [uiVisible, setUiVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [zoom] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isSpreadCover, setIsSpreadCover] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('dark');
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedPageIndex, setSavedPageIndex] = useState<number | null>(null);
  
  const readerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const chapterPageCacheRef = useRef<Map<string, string[]>>(new Map());
  const chapterPageRequestRef = useRef<Map<string, Promise<string[]>>>(new Map());
  const touchStartRef = useRef({ x: 0, y: 0 });
  const progressSaveAbortRef = useRef<AbortController | null>(null);

  const restrictedSource = isRestrictedLibrarySource(source);

  useEffect(() => {
    const initialMobile = window.innerWidth < 768;
    setIsMobile(initialMobile);
    if (initialMobile) {
      setViewMode('flow');
    }
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);

    const verified = initialAgeVerified || readAgeVerification();
    const t = setTimeout(() => setIsAgeVerified(prev => (verified !== prev ? verified : prev)), 0);
    if (verified) persistAgeVerification();

    const savedTheme = localStorage.getItem('reader_theme') as ReaderTheme | null;
    if (savedTheme && READER_THEMES[savedTheme]) setReaderTheme(savedTheme);
    const savedDir = localStorage.getItem('reading_direction') as any;
    if (savedDir) setReadingDirection(savedDir);
    const savedFullscreen = readStorageItem('reader_fullscreen') === 'true';
    setIsFullscreen(savedFullscreen);

    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(t);
    };
  }, [initialAgeVerified]);

  useEffect(() => {
    let cancelled = false;

    const loadSessionAndProgress = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        const hasSession = Boolean(data?.user);
        setIsLoggedIn(hasSession);

        const localHistory = readReadingHistory();
        const localEntry = localHistory[`${source}:${id}`];

        if (!hasSession) {
          if (localEntry?.chapterId === chapterId) {
            setSavedPageIndex(Number(localEntry.currentPage || 0));
          }
          return;
        }

        const progressRes = await fetch(`/api/reading-progress?source=${encodeURIComponent(source)}&comicId=${encodeURIComponent(id)}`);
        const progressData = await progressRes.json().catch(() => null);
        if (cancelled) return;

        const progress = progressData?.progress;
        if (progress?.chapterId === chapterId) {
          setSavedPageIndex(Number(progress.currentPage || 0));
        } else if (localEntry?.chapterId === chapterId) {
          setSavedPageIndex(Number(localEntry.currentPage || 0));
        }
      } catch (error) {
        console.error('Failed to load reader progress:', error);
        if (!cancelled) setIsLoggedIn(false);
      }
    };

    void loadSessionAndProgress();

    return () => {
      cancelled = true;
    };
  }, [chapterId, id, source]);

  useEffect(() => {
    if (restrictedSource && !isAgeVerified) return;

    let cancelled = false;

    const loadMetadata = async () => {
      if (comic && chapters.length > 0) {
        setMetadataLoading(false);
        return;
      }

      setMetadataLoading(true);
      try {
        const [comicData, chapterData] = await Promise.all([
          getComicDetails(source, id, mangaLanguage),
          getChapters(source, id, mangaLanguage),
        ]);

        if (cancelled) return;
        if (comicData) {
          setComic(comicData);
        }
        if (chapterData) {
          const nextChapters = chapterData;
          setChapters(nextChapters);
          const matchedIdx = nextChapters.findIndex((chapter) => chapter.id === chapterId);
          setCurrentChapterIdx(matchedIdx >= 0 ? matchedIdx : 0);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setMetadataLoading(false);
      }
    };

    void loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [chapters.length, comic, id, mangaLanguage, restrictedSource, source, isAgeVerified]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    let t_lang: NodeJS.Timeout;
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      t_lang = setTimeout(() => setLang(prev => (savedLang !== prev ? savedLang : prev)), 0);
    }

    const handleLang = (e: Event) => {
      const nextLang = (e as CustomEvent<Lang>).detail;
      setLang(prev => (translations[nextLang] && nextLang !== prev ? nextLang : prev));
    };

    window.addEventListener('langChange', handleLang as EventListener);
    return () => {
      window.removeEventListener('langChange', handleLang as EventListener);
      clearTimeout(t_lang);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      if (canvas.scrollTop > 100) setScrolled(true);
      else setScrolled(false);

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
  }, [viewMode, uiVisible]);

  const getChapterCacheKey = useCallback((chapId: string) => {
    return `${String(source)}:${String(id)}:${chapId}`;
  }, [id, source]);

  const buildChapterPages = useCallback(async (chapter: ComicChapter) => {
    return getChapterPages(source as string, id as string, chapter.id);
  }, [id, source]);

  const ensureChapterPages = useCallback(async (chapter: ComicChapter) => {
    const cacheKey = getChapterCacheKey(chapter.id);
    const inMem = chapterPageCacheRef.current.get(cacheKey);
    if (inMem) return inMem;

    const persistent = await getChapterFromCache(cacheKey);
    if (persistent) {
      chapterPageCacheRef.current.set(cacheKey, persistent);
      return persistent;
    }

    const pending = chapterPageRequestRef.current.get(cacheKey);
    if (pending) return pending;

    const request = buildChapterPages(chapter)
      .then((pgs) => {
        chapterPageCacheRef.current.set(cacheKey, pgs);
        if (pgs && pgs.length > 0) {
          void saveChapterToCache(cacheKey, pgs);
        }
        return pgs;
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

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        writeStorageItem('reader_fullscreen', 'false');
        return;
      }

      await readerRef.current?.requestFullscreen();
      setIsFullscreen(true);
      writeStorageItem('reader_fullscreen', 'true');
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  }, []);

  const loadChapterPages = useCallback(async (idx: number) => {
    const chapter = chapters[idx];
    if (!chapter) return;

    setCurrentPage(0);
    setPageReady(false);
    setScrolled(false);
    setScrollProgress(0);
    setReaderLoading(true);

    try {
      const chapterPages = await ensureChapterPages(chapter);
      setPages(chapterPages);
      setPageReady(false);
      preloadNeighborChapters(idx);

      // Update URL when changing chapter
      if (chapter.id !== chapterId) {
        window.history.replaceState(null, '', `/library/${source}/${id}/read/${chapter.id}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error loading chapter.");
    } finally {
      setReaderLoading(false);
      canvasRef.current?.scrollTo(0, 0);
    }
  }, [chapters, ensureChapterPages, preloadNeighborChapters, chapterId, id, source]);

  useEffect(() => {
    if (viewMode === 'flow' || pages.length === 0) {
      setPageReady(true);
      return;
    }

    const visible = getReaderVisibleIndices(viewMode, isSpreadCover, currentPage, pages.length);

    let cancelled = false;
    setPageReady(false);

    void (async () => {
      await Promise.all(visible.map((idx) => preloadImageUrl(pages[idx])));
      if (!cancelled) {
        setPageReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pages, currentPage, viewMode, isSpreadCover]);

  useEffect(() => {
    if (viewMode === 'flow' || pages.length === 0) return;

    const visible = getReaderVisibleIndices(viewMode, isSpreadCover, currentPage, pages.length);
    const lookahead = getReaderLookaheadIndices(viewMode, isSpreadCover, currentPage, pages.length, visible);
    if (lookahead.length === 0) return;

    void Promise.all(lookahead.map((idx) => preloadImageUrl(pages[idx])));
  }, [pages, currentPage, viewMode, isSpreadCover]);

  /** Vertical scroll mode: warm the first strip of pages so early scroll is instant. */
  useEffect(() => {
    if (viewMode !== 'flow' || pages.length === 0) return;
    const head = pages.slice(0, Math.min(16, pages.length));
    void Promise.all(head.map((url) => preloadImageUrl(url)));
  }, [viewMode, pages]);

  useEffect(() => {
    if (savedPageIndex === null || pages.length === 0) return;
    if (chapters[currentChapterIdx]?.id !== chapterId) return;

    const nextPage = Math.max(0, Math.min(savedPageIndex, pages.length - 1));
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    }
  }, [chapterId, chapters, currentChapterIdx, currentPage, pages.length, savedPageIndex]);

  useEffect(() => {
    if (chapters.length > 0) {
      void loadChapterPages(currentChapterIdx);
    }
  }, [currentChapterIdx, chapters, loadChapterPages]);

  useEffect(() => {
    if ((restrictedSource || (comic && isAdultComic(comic))) && !isAgeVerified && !showAgeGate) {
      setShowAgeGate(true);
    }
  }, [comic, isAgeVerified, showAgeGate, restrictedSource]);

  const handleAgeVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };

  useEffect(() => {
    const theme = READER_THEMES[readerTheme];
    document.body.style.backgroundColor = theme.shellBg;
    document.body.style.color = theme.text;
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    };
  }, [readerTheme]);

  const nextChapter = useCallback(() => {
    if (currentChapterIdx < chapters.length - 1) {
      setCurrentChapterIdx(prev => prev + 1);
    }
  }, [currentChapterIdx, chapters.length]);

  const prevChapter = useCallback(() => {
    if (currentChapterIdx > 0) {
      setCurrentChapterIdx(prev => prev - 1);
    }
  }, [currentChapterIdx]);

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

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (viewMode === 'flow') return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;

    const currentChapterId = chapters[currentChapterIdx]?.id || chapterId;
    if (dx < 0) {
      trackEvent('reader_swipe_next', { source, comicId: id, chapterId: currentChapterId });
      readingDirection === 'ltr' ? handleNextPage() : handlePrevPage();
      return;
    }

    trackEvent('reader_swipe_prev', { source, comicId: id, chapterId: currentChapterId });
    readingDirection === 'ltr' ? handlePrevPage() : handleNextPage();
  }, [chapterId, chapters, currentChapterIdx, handleNextPage, handlePrevPage, id, readingDirection, source, viewMode]);

  const currentProgressPercent = calculateReadingProgressPercent({
    source,
    comicId: id,
    comicTitle: comic?.title,
    comicCoverUrl: comic?.coverUrl,
    chapterId: chapters[currentChapterIdx]?.id || chapterId,
    chapterTitle: chapters[currentChapterIdx]?.title,
    chapterIndex: currentChapterIdx,
    chapterCount: chapters.length,
    currentPage,
    totalPages: pages.length,
    scrollProgress,
    viewMode,
  });

  const persistReadingProgress = useCallback(async () => {
    if (!comic || chapters.length === 0) return;

    const activeChapter = chapters[currentChapterIdx];
    if (!activeChapter) return;

    const timestamp = Date.now();
    const progressStatus = deriveReadingProgressStatus(currentProgressPercent);
    const payload = {
      source,
      comicId: id,
      comicTitle: comic.title,
      comicCoverUrl: comic.coverUrl,
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title || `Chapter ${activeChapter.chapterNum}`,
      chapterIndex: currentChapterIdx,
      chapterCount: chapters.length,
      currentPage,
      totalPages: pages.length,
      scrollProgress,
      viewMode,
      timestamp,
    };

    upsertReadingHistory({
      id,
      comicTitle: comic.title,
      comicCoverUrl: comic.coverUrl,
      comicSource: source,
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title || `Chapter ${activeChapter.chapterNum}`,
      chapterIndex: currentChapterIdx,
      chapterCount: chapters.length,
      currentPage,
      totalPages: pages.length,
      progressPercent: currentProgressPercent,
      progressStatus,
      aniListId: comic.aniListId,
      malId: comic.malId,
      timestamp,
      lastReadAt: timestamp,
    });

    if (!isLoggedIn) return;

    progressSaveAbortRef.current?.abort();
    const controller = new AbortController();
    progressSaveAbortRef.current = controller;

    try {
      await fetch('/api/reading-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'AbortError') {
        console.error('Failed to sync reading progress:', error);
      }
    }
  }, [
    chapters,
    comic,
    currentChapterIdx,
    currentPage,
    currentProgressPercent,
    id,
    isLoggedIn,
    pages.length,
    scrollProgress,
    source,
    viewMode,
  ]);

  useEffect(() => {
    if (readerLoading || pages.length === 0 || !comic || chapters.length === 0) return;

    const timer = window.setTimeout(() => {
      void persistReadingProgress();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    chapters.length,
    comic,
    currentChapterIdx,
    currentPage,
    pages.length,
    persistReadingProgress,
    readerLoading,
    scrollProgress,
    viewMode,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      const flow = viewMode === 'flow';

      const mediaNext =
        e.code === 'MediaTrackNext' || e.key === 'MediaTrackNext';
      const mediaPrev =
        e.code === 'MediaTrackPrevious' || e.key === 'MediaTrackPrevious';

      // Laptop hardware / OS media keys (often not ArrowLeft/ArrowRight)
      if (mediaNext) {
        e.preventDefault();
        if (flow) {
          canvasRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        } else {
          handleNextPage();
        }
        return;
      }
      if (mediaPrev) {
        e.preventDefault();
        if (flow) {
          canvasRef.current?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
        } else {
          handlePrevPage();
        }
        return;
      }

      // Match left/right tap zones: LTR vs RTL
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        readingDirection === 'ltr' ? handlePrevPage() : handleNextPage();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        readingDirection === 'ltr' ? handleNextPage() : handlePrevPage();
        return;
      }

      if (!flow) {
        // Classic / journal: vertical keys & page keys change the page (canvas often has nothing to scroll)
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          handleNextPage();
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          handlePrevPage();
          return;
        }
      } else {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          canvasRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
          if (e.key === 'PageDown') e.preventDefault();
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          canvasRef.current?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
          if (e.key === 'PageUp') e.preventDefault();
          return;
        }
      }

      if (e.key === 'Home') {
        setCurrentPage(0);
        canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (e.key === 'End') {
        setCurrentPage(pages.length - 1);
        canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (e.key === 'Escape') router.push(`/library/${source}/${id}`);
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) readerRef.current?.requestFullscreen();
        else document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    pages.length,
    viewMode,
    readingDirection,
    handleNextPage,
    handlePrevPage,
    router,
    source,
    id,
  ]);

  if (restrictedSource && !isAgeVerified) {
    return (
      <div className="min-h-screen overflow-hidden selection:text-white" style={{ backgroundColor: READER_THEMES[readerTheme].shellBg, color: READER_THEMES[readerTheme].text }}>
        <AnimatePresence>
          <AgeGateOverlay
            title={t.restricted}
            description={t.ageDesc}
            confirmLabel={t.verifyBtn}
            cancelLabel={t.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => router.push('/library')}
            zIndex={10000}
          />
        </AnimatePresence>
      </div>
    );
  }

  if (metadataLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#020202] flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute left-1/2 top-1/3 h-[min(100vmin,28rem)] w-[min(100vmin,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff4d00]/15 blur-[120px]"
            animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.12, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-8 px-6">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-2xl border border-[#ff4d00]/20"
            />
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.85, 0.35] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="absolute inset-4 rounded-xl bg-[#ff4d00]/10 blur-xl"
            />
            <BookOpen className="relative z-10 h-12 w-12 text-[#ff4d00]" strokeWidth={1.25} />
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-5 w-5 text-[#ff4d00]/60 animate-spin" aria-hidden />
            <p className="text-[11px] font-black uppercase tracking-[0.55em] text-white/90">Preparing library</p>
            <motion.div
              className="h-0.5 w-28 rounded-full bg-gradient-to-r from-transparent via-[#ff4d00] to-transparent"
              animate={{ opacity: [0.35, 1, 0.35], scaleX: [0.75, 1, 0.75] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <p className="text-[9px] font-bold uppercase tracking-[0.45em] text-white/30">Catalog & chapters</p>
          </div>
        </div>
      </div>
    );
  }

  if (!comic) return null;

  return (
    <div
      className="min-h-screen overflow-hidden selection:text-white"
      style={{
        backgroundColor: READER_THEMES[readerTheme].shellBg,
        color: READER_THEMES[readerTheme].text,
      }}
    >
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

      <motion.div 
        ref={readerRef} 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="fixed inset-0 z-[10000] flex flex-col overflow-hidden select-none [-webkit-tap-highlight-color:transparent]"
        style={{
          backgroundColor: READER_THEMES[readerTheme].shellBg,
          color: READER_THEMES[readerTheme].text,
        }}
      >
        <AnimatePresence mode="wait">
          {readerLoading && (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-[10050] flex flex-col items-center justify-center overflow-hidden bg-[#020202]"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="pointer-events-none absolute inset-0">
                <motion.div
                  className="absolute -left-[20%] top-[10%] h-[min(90vmin,32rem)] w-[min(90vmin,32rem)] rounded-full bg-[#ff4d00]/18 blur-[110px]"
                  animate={{ opacity: [0.35, 0.7, 0.35], x: [0, 12, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute -right-[25%] bottom-0 h-[min(80vmin,26rem)] w-[min(80vmin,26rem)] rounded-full bg-orange-400/10 blur-[100px]"
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div
                  className="absolute inset-0 opacity-[0.045]"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(255,255,255,0.85) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.85) 1px, transparent 1px)',
                    backgroundSize: '44px 44px',
                  }}
                />
                <div
                  className="absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px)',
                    backgroundSize: '10px 10px',
                  }}
                />
              </div>

              {/* Manga-style focus brackets */}
              <div className="relative mb-14 flex h-[min(52vmin,13.5rem)] w-[min(82vmin,21rem)] items-center justify-center">
                {(
                  [
                    'left-0 top-0 border-l-2 border-t-2 rounded-tl-md',
                    'right-0 top-0 border-r-2 border-t-2 rounded-tr-md',
                    'left-0 bottom-0 border-l-2 border-b-2 rounded-bl-md',
                    'right-0 bottom-0 border-r-2 border-b-2 rounded-br-md',
                  ] as const
                ).map((cornerClass, i) => (
                  <motion.span
                    key={i}
                    className={`pointer-events-none absolute h-9 w-9 border-[#ff4d00]/90 ${cornerClass}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.96, 1.02, 0.96] }}
                    transition={{
                      opacity: { delay: i * 0.1, duration: 0.35 },
                      duration: 2.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                ))}

                {/* Stacked “panels” */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-lg border border-white/12 bg-zinc-950/80 shadow-2xl backdrop-blur-[2px]"
                    style={{
                      width: `${78 - i * 9}%`,
                      height: `${88 - i * 7}%`,
                      zIndex: i,
                    }}
                    initial={{ opacity: 0, y: 16, rotate: -3.5 + i * 1.2 }}
                    animate={{
                      opacity: 0.55 - i * 0.14,
                      y: [0, -3 - i, 0],
                      rotate: -3.5 + i * 1.2,
                    }}
                    transition={{
                      opacity: { delay: 0.15 + i * 0.1, duration: 0.45 },
                      y: { duration: 2.8 + i * 0.35, repeat: Infinity, ease: 'easeInOut' },
                    }}
                  />
                ))}

                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-[18%] rounded-2xl border border-[#ff4d00]/15"
                />
                <motion.div
                  animate={{ scale: [1, 1.06, 1], opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative z-20 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-md bg-gradient-to-br from-[#ff4d00] to-[#ff9000] rotate-45 shadow-[0_0_48px_rgba(255,77,0,0.45)]"
                >
                  <BookOpen className="h-7 w-7 -rotate-45 text-white/95" strokeWidth={1.35} aria-hidden />
                </motion.div>
              </div>

              <div className="relative z-10 flex max-w-[min(92vw,24rem)] flex-col items-center gap-4 px-6 text-center">
                <p className="line-clamp-2 text-[10px] font-bold uppercase tracking-[0.35em] text-white/45">
                  {comic.title}
                </p>
                <div className="space-y-2">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.65em] text-white md:text-[12px]">
                    Opening chapter
                  </h2>
                  <motion.div
                    className="mx-auto h-0.5 max-w-[10rem] rounded-full bg-gradient-to-r from-transparent via-[#ff4d00] to-transparent"
                    animate={{ opacity: [0.4, 1, 0.4], scaleX: [0.85, 1, 0.85] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.75em] text-[#ff4d00]">
                  Ch. {chapters[currentChapterIdx]?.chapterNum || '–'}
                </p>
                <p className="text-[8px] font-bold uppercase tracking-[0.4em] text-white/25">
                  Decoding spreads · hang tight
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!readerLoading && pages.length > 0 && scrolled && (
            <motion.div 
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

        <AnimatePresence>
          {uiVisible && pages.length > 0 && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setUiVisible(false)}
                className="fixed inset-0 z-[10020] bg-black/70 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 z-[10030] bg-[#0a0a0a] border-t border-white/10 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.8)] pb-[max(env(safe-area-inset-bottom),2rem)] pt-6 px-6 md:px-12 flex flex-col gap-8 max-h-[85vh] overflow-y-auto"
              >
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#ff4d00]">Now reading</div>
                    <div className="text-[14px] md:text-[18px] font-black uppercase tracking-tight truncate text-white">{comic.title}</div>
                  </div>
                  <button 
                    onClick={() => router.push(`/library/${source}/${id}`)} 
                    className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl"
                  >
                    <X size={24}/>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-8">
                     <div className="space-y-4">
                       <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Reading Mode</div>
                       <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl">
                          <button aria-label="Classic reading mode" onClick={() => { setViewMode('classic'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'classic' ? 'bg-[#ff4d00] text-white' : 'text-white/40 hover:text-white'}`}>
                            Classic
                          </button>
                          <button aria-label="Journal reading mode" onClick={() => { setViewMode('journal'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'journal' ? 'bg-[#ff4d00] text-white' : 'text-white/40 hover:text-white'}`}>
                            Journal
                          </button>
                          <button aria-label="Flow reading mode" onClick={() => { setViewMode('flow'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'flow' ? 'bg-[#ff4d00] text-white' : 'text-white/40 hover:text-white'}`}>
                            Flow
                          </button>
                       </div>
                     </div>
                     <div className="space-y-4">
                       <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center justify-between">
                          <span>Chapter {chapters[currentChapterIdx]?.chapterNum || '0'}</span>
                          <span className="text-[#ff4d00]">{chapters.length} Total</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <button aria-label="Previous chapter" onClick={() => { prevChapter(); setUiVisible(false); }} disabled={currentChapterIdx === 0} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black uppercase disabled:opacity-20 transition-all flex items-center justify-center gap-2">
                            <ChevronLeft size={18} /> Prev
                          </button>
                          <button aria-label="Next chapter" onClick={() => { nextChapter(); setUiVisible(false); }} disabled={currentChapterIdx === chapters.length - 1} className="flex-1 h-14 bg-[#ff4d00] text-white rounded-xl text-[11px] font-black uppercase disabled:opacity-20 transition-all flex items-center justify-center gap-2">
                            Next <ChevronRight size={18} />
                          </button>
                       </div>
                     </div>
                  </div>
                  <div className="space-y-8">
                     <div className="space-y-4">
                       <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.2em]">
                         <span className="text-white/40">Progress</span>
                         <span className="text-[#ff4d00]">
                           {viewMode === 'flow' ? `${Math.round(scrollProgress)}%` : `Page ${currentPage + 1} of ${pages.length}`}
                         </span>
                       </div>
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
                         className="w-full h-2 bg-white/10 appearance-none cursor-pointer accent-[#ff4d00] rounded-full"
                       />
                     </div>
                     <div className="space-y-4">
                       <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Tools</div>
                       <div className="flex items-center gap-3">
                          <button aria-label="Open page overview" onClick={() => setShowGrid(true)} className="flex-1 h-14 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black uppercase">
                             <List size={18}/> Overview
                          </button>
                          {viewMode === 'flow' && (
                            <button aria-label="Scroll to top" onClick={() => { setUiVisible(false); canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase">
                              <ChevronUp size={18}/> Top
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

        {pages.length > 0 && (
          <div className={`fixed bottom-8 right-8 z-[10040] transition-all duration-300 ${uiVisible ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}>
             <button onClick={() => setShowSettings(true)} className="w-16 h-16 bg-[#ff4d00] text-white rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(255,77,0,0.5)] border border-[#ff4d00]/50 active:scale-90 transition-all">
               <Settings size={28} />
             </button>
          </div>
        )}

        {/* Reader Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.72)' }} />
              <motion.div 
                initial={{ y: 50, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: 50, opacity: 0 }} 
                className="relative w-full max-w-md rounded-3xl p-8 space-y-10 shadow-2xl"
                style={{
                  backgroundColor: READER_THEMES[readerTheme].panelBg,
                  border: `1px solid ${READER_THEMES[readerTheme].border}`,
                  color: READER_THEMES[readerTheme].text,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: READER_THEMES[readerTheme].accent }}>Reader</div>
                    <h3 className="mt-1 text-2xl font-black uppercase tracking-tight italic">Reader Settings</h3>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                      border: `1px solid ${READER_THEMES[readerTheme].border}`,
                      color: READER_THEMES[readerTheme].muted,
                    }}
                  >
                    <X size={20}/>
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Theme Selector */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: READER_THEMES[readerTheme].muted }}>Interface Theme</div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'dark', bg: 'bg-black', label: 'Dark' },
                        { id: 'sepia', bg: 'bg-[#f4ecd8]', label: 'Sepia' },
                        { id: 'light', bg: 'bg-white', label: 'Light' }
                      ].map(t => (
                        <button 
                          key={t.id} 
                          onClick={() => { setReaderTheme(t.id as ReaderTheme); localStorage.setItem('reader_theme', t.id); }}
                          className="flex flex-col items-center gap-2 p-3 border transition-all"
                          style={readerTheme === t.id
                            ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft }
                            : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg }
                          }
                        >
                          <div className={`w-8 h-8 rounded-full ${t.bg} border border-white/10`} />
                          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: readerTheme === t.id ? READER_THEMES[readerTheme].text : READER_THEMES[readerTheme].muted }}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reading Direction */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: READER_THEMES[readerTheme].muted }}>Reading Direction</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => { setReadingDirection('ltr'); localStorage.setItem('reading_direction', 'ltr'); }}
                        className="py-4 border text-[10px] font-black uppercase tracking-widest transition-all"
                        style={readingDirection === 'ltr'
                          ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                          : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                        }
                      >
                        Left to Right
                      </button>
                      <button 
                        onClick={() => { setReadingDirection('rtl'); localStorage.setItem('reading_direction', 'rtl'); }}
                        className="py-4 border text-[10px] font-black uppercase tracking-widest transition-all"
                        style={readingDirection === 'rtl'
                          ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                          : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                        }
                      >
                        Right to Left
                      </button>
                    </div>
                  </div>

                  {/* View Modes */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: READER_THEMES[readerTheme].muted }}>Layout Settings</div>
                    <div className="grid grid-cols-3 gap-2">
                       <button onClick={() => setViewMode('classic')} className="py-4 text-[9px] font-black uppercase tracking-widest border transition-all" style={viewMode === 'classic'
                         ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                         : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                       }>Classic</button>
                       <button onClick={() => setViewMode('journal')} className="py-4 text-[9px] font-black uppercase tracking-widest border transition-all" style={viewMode === 'journal'
                         ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                         : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                       }>Journal</button>
                       <button onClick={() => setViewMode('flow')} className="py-4 text-[9px] font-black uppercase tracking-widest border transition-all" style={viewMode === 'flow'
                         ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                         : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                       }>Flow</button>
                    </div>
                  </div>

                  {/* Page overview (thumbnail grid) */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: READER_THEMES[readerTheme].muted }}>Page Overview</div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSettings(false);
                        setShowGrid(true);
                      }}
                      className="w-full py-4 border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      style={{
                        borderColor: READER_THEMES[readerTheme].border,
                        backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                        color: READER_THEMES[readerTheme].text,
                      }}
                    >
                      <List size={16} />
                      All pages (thumbnails)
                    </button>
                  </div>

                  {/* Fullscreen */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: READER_THEMES[readerTheme].muted }}>Fullscreen</div>
                    <button
                      onClick={() => void toggleFullscreen()}
                      className="w-full py-4 border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      style={isFullscreen
                        ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                        : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                      }
                    >
                      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <div className={`fixed top-8 left-8 z-[10040] transition-all duration-300 ${uiVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           <button
             aria-label="Close reader"
             onClick={() => router.push(`/library/${source}/${id}`)}
             className="w-12 h-12 backdrop-blur-md border rounded-full flex items-center justify-center transition-all"
             style={{
               backgroundColor: READER_THEMES[readerTheme].panelBg,
               borderColor: READER_THEMES[readerTheme].border,
               color: READER_THEMES[readerTheme].muted,
             }}
           >
             <X size={20} />
           </button>
        </div>

        <div
          ref={canvasRef}
          className="flex-1 w-full overflow-y-auto relative scroll-smooth touch-pan-y"
          style={{ backgroundColor: READER_THEMES[readerTheme].canvasBg }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label="Comic reader content"
        >
           {viewMode !== 'flow' && (
             <>
               <div className="fixed inset-y-0 left-0 w-[25%] md:w-[20%] z-[10015] cursor-pointer" onClick={(e) => { e.stopPropagation(); readingDirection === 'ltr' ? handlePrevPage() : handleNextPage(); }} />
               <div className="fixed inset-y-0 right-0 w-[25%] md:w-[20%] z-[10015] cursor-pointer" onClick={(e) => { e.stopPropagation(); readingDirection === 'ltr' ? handleNextPage() : handlePrevPage(); }} />
               <div className="fixed inset-y-0 left-[25%] right-[25%] md:left-[20%] md:right-[20%] z-[10015] cursor-pointer" onClick={(e) => { e.stopPropagation(); setUiVisible(prev => !prev); }} />
             </>
           )}

           {readerLoading ? null : pages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center gap-10 p-10 text-center max-w-xl mx-auto">
                <div className="relative w-24 h-24 flex items-center justify-center">
                   <div className="absolute inset-0 blur-3xl rounded-full" style={{ backgroundColor: READER_THEMES[readerTheme].accentSoft }} />
                   <ExternalLink size={48} className="relative z-10" style={{ color: READER_THEMES[readerTheme].accent }} />
                </div>
                <div className="space-y-4">
                   <div className="text-[12px] font-black uppercase tracking-[0.5em]" style={{ color: READER_THEMES[readerTheme].accent }}>Official reader only</div>
                   <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight" style={{ color: READER_THEMES[readerTheme].text }}>Read this chapter on the publisher&apos;s site</h2>
                   <p className="text-sm leading-relaxed" style={{ color: READER_THEMES[readerTheme].muted }}>
                      This chapter is hosted on an <b>official platform</b> (for example MANGA Plus or VIZ).
                      Images are not available here so that publisher rights stay protected.
                   </p>
                </div>
                {chapters[currentChapterIdx]?.externalUrl && (
                  <a
                    href={chapters[currentChapterIdx].externalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-4 px-10 py-5 text-[12px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all"
                    style={{ backgroundColor: READER_THEMES[readerTheme].accent, color: '#fff', boxShadow: `0 20px 40px ${READER_THEMES[readerTheme].accentSoft}` }}
                  >
                    <ExternalLink size={20} /> Open official reader
                  </a>
                )}
                <div className="pt-10 flex gap-4">
                   <button onClick={prevChapter} disabled={currentChapterIdx === 0} className="px-6 py-3 border text-[10px] font-black uppercase tracking-widest disabled:opacity-0 transition-all" style={{ borderColor: READER_THEMES[readerTheme].border, color: READER_THEMES[readerTheme].muted }}>Previous chapter</button>
                   <button onClick={nextChapter} disabled={currentChapterIdx === chapters.length - 1} className="px-6 py-3 border text-[10px] font-black uppercase tracking-widest disabled:opacity-0 transition-all" style={{ borderColor: READER_THEMES[readerTheme].border, color: READER_THEMES[readerTheme].muted }}>Next chapter</button>
                </div>
             </div>
           ) : (
              <div className={`mx-auto flex flex-col items-center transition-all duration-500 ${viewMode === 'flow' ? 'w-full pt-0 pb-20' : 'min-h-[calc(100vh-40px)] justify-center py-10 md:py-20'}`}>
                {viewMode === 'classic' ? (
                   <div className="relative flex items-center justify-center w-full min-h-[80vh]">
                     {!pageReady ? (
                       <div className="flex items-center justify-center w-full min-h-[80vh]">
                         <div className="w-14 h-14 border-2 border-[#ff4d00]/30 border-t-[#ff4d00] rounded-full animate-spin" />
                       </div>
                     ) : (
                       <motion.img
                         key={`classic-${currentPage}`}
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         src={pages[currentPage]}
                         style={{ maxWidth: isMobile ? '100%' : '80vw', maxHeight: '90vh' }}
                         className="shadow-2xl border border-white/10 rounded-sm object-contain"
                         alt={`Page ${currentPage + 1} of ${comic.title}`}
                       />
                     )}
                   </div>
                ) : viewMode === 'journal' ? (
                   <div className="flex items-center justify-center w-full max-w-[98vw] gap-0 min-h-[85vh]">
                      {!pageReady ? (
                        <div className="flex items-center justify-center w-full min-h-[85vh]">
                          <div className="w-14 h-14 border-2 border-[#ff4d00]/30 border-t-[#ff4d00] rounded-full animate-spin" />
                        </div>
                      ) : currentPage === 0 && isSpreadCover ? (
                        <div className="relative max-h-[90vh] w-full aspect-[2/3] flex justify-center">
                          <Image src={pages[0]} fill className="object-contain shadow-2xl border border-white/10" alt={`${comic.title} cover`} unoptimized />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-full gap-0">
                          <div className="relative flex-1 aspect-[2/3] max-h-[90vh]">
                            <Image src={pages[currentPage]} fill className="object-contain shadow-2xl" alt={`Page ${currentPage + 1} of ${comic.title}`} unoptimized />
                          </div>
                          {pages[currentPage + 1] && (
                            <div className="relative flex-1 aspect-[2/3] max-h-[90vh]">
                              <Image src={pages[currentPage + 1]} fill className="object-contain shadow-2xl" alt={`Page ${currentPage + 2} of ${comic.title}`} unoptimized />
                            </div>
                          )}
                        </div>
                      )}
                   </div>
                 ) : (
                  <div className="flex flex-col items-center gap-0 w-full" style={{ maxWidth: isMobile ? '100%' : '800px', width: '100%' }}>
                      {pages.map((p, i) => (
                        <div key={i} className="relative w-full aspect-[2/3] bg-[#050505] border-b border-white/5">
                          <Image id={`page-${i}`} src={p} fill className="w-full h-auto object-contain relative z-10" alt={`Page ${i + 1}`} loading="lazy" unoptimized />
                        </div>
                      ))}
                      {currentChapterIdx < chapters.length - 1 && (
                        <button onClick={nextChapter} className="w-full py-40 mt-20 border-2 border-dashed border-white/5 hover:border-[#ff4d00]/50 transition-all flex flex-col items-center gap-4">
                           <div className="text-[12px] font-black uppercase tracking-[0.5em] text-white/20">Go to next chapter</div>
                           <ChevronDown size={32} className="text-white/10" />
                        </button>
                      )}
                  </div>
                )}
             </div>
           )}
        </div>

         <AnimatePresence>
           {showGrid && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10050] bg-black/90 overflow-y-auto p-4 md:p-16">
                <div className="fixed top-0 left-0 right-0 h-24 bg-black/90 backdrop-blur-xl z-[10060] px-6 flex items-center justify-between border-b border-white/10 pt-[env(safe-area-inset-top)]">
                  <button aria-label="Back to reader" onClick={() => setShowGrid(false)} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40">
                      <ChevronLeft size={20} /> Back to reader
                   </button>
                   <button aria-label="Close overview" onClick={() => setShowGrid(false)} className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl"><X size={24}/></button>
                </div>
                <div className="mt-24 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-8 max-w-7xl mx-auto">
                   {pages.map((p, i) => (
                     <button key={i} onClick={() => { setCurrentPage(i); setShowGrid(false); }} className={`relative aspect-[2/3] bg-[#0a0a0a] border ${currentPage === i ? 'border-[#ff4d00]' : 'border-white/10'} overflow-hidden`}>
                        <Image src={p} fill className="object-cover opacity-60" alt={`Page ${i + 1}`} unoptimized />
                        <div className="absolute inset-0 flex items-center justify-center">
                           <div className="px-3 py-1.5 bg-black/80 border border-white/10 text-[14px] font-black text-white">{i + 1}</div>
                        </div>
                     </button>
                   ))}
                </div>
             </motion.div>
           )}
         </AnimatePresence>
      </motion.div>

      <style jsx global>{`
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #ff4d00; cursor: pointer; border: 2px solid white; }
      `}</style>
    </div>
  );
}
