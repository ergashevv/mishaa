"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, X, Settings,
  ChevronRight, Loader2,
  ChevronUp,
  List, ExternalLink,
  Maximize2, Minimize2,
  ChevronDown,
  BookOpen,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { translations, Lang } from '@/lib/translations';
import { useLibraryAgeDescription } from '@/hooks/useLibraryAgeDescription';
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
import {
  clampReaderZoom,
  computeLastPageIndexForAdjacentChapter,
} from '@/lib/reader-navigation';

interface ComicReaderClientProps {
  initialComic: ComicDetail | null;
  initialChapters?: ComicChapter[];
  source: string;
  id: string;
  chapterId: string;
  initialAgeVerified?: boolean;
}

type ReaderTheme = 'dark' | 'light' | 'sepia';

/**
 * Reading Room reader chrome palette. Canvas/text values mirror the dedicated
 * --reader-dark-bg/fg, --reader-light-bg/fg and --reader-sepia-bg/fg tokens in
 * globals.css (hex literals are required because shellBg also feeds the
 * <meta name="theme-color"> sync). Accent is the single marigold token.
 * scrim* fields are the frosted ink chrome used for bars/buttons over imagery.
 */
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
  accentText: string;
  onAccent: string;
  scrimBg: string;
  scrimBorder: string;
  scrimText: string;
}> = {
  dark: {
    shellBg: '#0C0B10',
    canvasBg: '#0C0B10',
    panelBg: '#1C1925',
    panelAltBg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.10)',
    text: '#E9E5EE',
    muted: 'rgba(233,229,238,0.58)',
    accent: '#F2994A',
    accentSoft: 'rgba(242,153,74,0.14)',
    accentText: '#F7AE5A',
    onAccent: '#2A1705',
    scrimBg: 'rgba(12,11,16,0.62)',
    scrimBorder: 'rgba(255,255,255,0.12)',
    scrimText: '#F8F5F0',
  },
  light: {
    shellBg: '#F6F3EC',
    canvasBg: '#F6F3EC',
    panelBg: '#FFFFFF',
    panelAltBg: 'rgba(27,24,34,0.05)',
    border: 'rgba(27,24,34,0.12)',
    text: '#221E2D',
    muted: 'rgba(34,30,45,0.60)',
    accent: '#F2994A',
    accentSoft: 'rgba(242,153,74,0.16)',
    accentText: '#B5611C',
    onAccent: '#2A1705',
    scrimBg: 'rgba(27,24,34,0.55)',
    scrimBorder: 'rgba(255,255,255,0.14)',
    scrimText: '#F8F5F0',
  },
  sepia: {
    shellBg: '#F0E2C6',
    canvasBg: '#F0E2C6',
    panelBg: '#FBF6EA',
    panelAltBg: 'rgba(74,59,38,0.07)',
    border: 'rgba(74,59,38,0.18)',
    text: '#4A3B26',
    muted: 'rgba(74,59,38,0.62)',
    accent: '#F2994A',
    accentSoft: 'rgba(242,153,74,0.18)',
    accentText: '#B5611C',
    onAccent: '#2A1705',
    scrimBg: 'rgba(27,24,34,0.55)',
    scrimBorder: 'rgba(255,255,255,0.14)',
    scrimText: '#F8F5F0',
  },
};

const READER_ZOOM_STEP = 0.12;
const READER_HELP_DISMISSED_KEY = 'reader_help_dismissed';
const READER_ZOOM_STORAGE_KEY = 'reader_zoom';
const READER_VIEW_MODE_KEY = 'reader_view_mode';
const UI_SHEET_AUTO_HIDE_MS = 4500;
/** Horizontal swipe distance (px) to flip pages on touch devices — lower feels easier on phones. */
const READER_TOUCH_SWIPE_MIN_DX = 38;

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
  const ageDescription = useLibraryAgeDescription(t.ageDesc, {
    ageDescEastAsia: t.ageDescEastAsia,
    ageDescEurope: t.ageDescEurope,
  });

  // Reader State
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageReady, setPageReady] = useState(false);
  const [viewMode, setViewMode] = useState<'classic' | 'flow' | 'journal'>('classic');
  const [readerLoading, setReaderLoading] = useState(false);
  const [uiVisible, setUiVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [readerZoom, setReaderZoomState] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isSpreadCover] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('dark');
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [showSettings, setShowSettings] = useState(false);
  /** False while the chapter canvas is scrolling; FAB reappears after scroll idle. */
  const [settingsFabIdle, setSettingsFabIdle] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedPageIndex, setSavedPageIndex] = useState<number | null>(null);
  const [resumeOfferPage, setResumeOfferPage] = useState<number | null>(null);
  const [showReaderHelp, setShowReaderHelp] = useState(false);
  /** False until queueMicrotask restores view mode / prefs so we do not overwrite localStorage with SSR default. */
  const [readerUiPrefsReady, setReaderUiPrefsReady] = useState(false);
  
  const readerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const chapterPageCacheRef = useRef<Map<string, string[]>>(new Map());
  const chapterPageRequestRef = useRef<Map<string, Promise<string[]>>>(new Map());
  const touchStartRef = useRef({ x: 0, y: 0 });
  const progressSaveAbortRef = useRef<AbortController | null>(null);
  const settingsFabScrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adjNavigateRef = useRef<'prev' | 'next' | null>(null);
  const readerZoomRef = useRef(1);
  const resumeDismissGateRef = useRef<string | null>(null);
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const twoFingerGestureRef = useRef(false);

  const restrictedSource = isRestrictedLibrarySource(source);

  const comicWorkHref = useMemo(() => `/library/${source}/${id}`, [source, id]);

  /** Exit fullscreen without blocking navigation; prefetch makes return to detail feel instant. */
  const exitToComicDetail = useCallback(() => {
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        writeStorageItem('reader_fullscreen', 'false');
        void document.exitFullscreen();
      }
    } catch {
      /* noop */
    }
    router.push(comicWorkHref);
  }, [router, comicWorkHref]);

  useEffect(() => {
    router.prefetch(comicWorkHref);
  }, [router, comicWorkHref]);

  /** Route/progress can diverge from `currentChapterIdx`; empty pages must still expose official links. */
  const officialReaderOutboundUrl = useMemo(() => {
    const loaded = chapters[currentChapterIdx];
    const targetId = loaded?.id ?? chapterId;
    return (
      loaded?.externalUrl ??
      chapters.find((c) => c.id === chapterId)?.externalUrl ??
      (initialChapters ?? []).find((c) => c.id === targetId)?.externalUrl
    );
  }, [chapterId, chapters, currentChapterIdx, initialChapters]);

  const setReaderZoom = useCallback((value: number | ((z: number) => number)) => {
    setReaderZoomState((prev) => {
      const resolved = typeof value === 'function' ? value(prev) : value;
      const clamped = clampReaderZoom(resolved);
      readerZoomRef.current = clamped;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(READER_ZOOM_STORAGE_KEY, String(clamped));
        } catch {
          /* private mode */
        }
      }
      return clamped;
    });
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);

    let verificationTimer: number | undefined;

    queueMicrotask(() => {
      const initialMobile = window.innerWidth < 768;
      setIsMobile(initialMobile);
      try {
        const savedVm = localStorage.getItem(READER_VIEW_MODE_KEY);
        if (savedVm === 'flow' || savedVm === 'classic' || savedVm === 'journal') {
          setViewMode(savedVm);
        } else if (initialMobile) {
          setViewMode('flow');
        }
      } catch {
        if (initialMobile) setViewMode('flow');
      }

      const verified = initialAgeVerified || readAgeVerification();
      verificationTimer = window.setTimeout(() => {
        setIsAgeVerified((prev) => (verified !== prev ? verified : prev));
      }, 0);
      if (verified) persistAgeVerification();

      const savedTheme = localStorage.getItem('reader_theme') as ReaderTheme | null;
      if (savedTheme && READER_THEMES[savedTheme]) {
        setReaderTheme(savedTheme);
      } else if (!savedTheme) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setReaderTheme(prefersDark ? 'dark' : 'light');
      }
      const savedDirRaw = localStorage.getItem('reading_direction');
      if (savedDirRaw === 'ltr' || savedDirRaw === 'rtl') {
        setReadingDirection(savedDirRaw);
      }
      const savedFullscreen = readStorageItem('reader_fullscreen') === 'true';
      setIsFullscreen(savedFullscreen);

      try {
        const raw = localStorage.getItem(READER_ZOOM_STORAGE_KEY);
        const parsed = raw ? parseFloat(raw) : 1;
        const z = clampReaderZoom(Number.isFinite(parsed) ? parsed : 1);
        readerZoomRef.current = z;
        setReaderZoomState(z);
      } catch {
        readerZoomRef.current = 1;
      }

      setReaderUiPrefsReady(true);
    });

    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      if (verificationTimer !== undefined) window.clearTimeout(verificationTimer);
    };
  }, [initialAgeVerified]);

  useEffect(() => {
    if (!readerUiPrefsReady) return;
    try {
      localStorage.setItem(READER_VIEW_MODE_KEY, viewMode);
    } catch {
      /* noop */
    }
  }, [viewMode, readerUiPrefsReady]);

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
  }, [chapters.length, chapterId, comic, id, mangaLanguage, restrictedSource, source, isAgeVerified]);

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

      setSettingsFabIdle(false);
      if (settingsFabScrollEndTimerRef.current) clearTimeout(settingsFabScrollEndTimerRef.current);
      settingsFabScrollEndTimerRef.current = setTimeout(() => {
        settingsFabScrollEndTimerRef.current = null;
        setSettingsFabIdle(true);
      }, 420);

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
    if (canvas) canvas.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (settingsFabScrollEndTimerRef.current) {
        clearTimeout(settingsFabScrollEndTimerRef.current);
        settingsFabScrollEndTimerRef.current = null;
      }
      setSettingsFabIdle(true);
      canvas?.removeEventListener('scroll', handleScroll);
    };
  }, [viewMode, uiVisible]);

  useEffect(() => {
    queueMicrotask(() => setSettingsFabIdle(true));
  }, [chapterId]);

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

    let loadedPages: string[] = [];
    try {
      loadedPages = await ensureChapterPages(chapter);
      setPages(loadedPages);
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
      const nav = adjNavigateRef.current;
      adjNavigateRef.current = null;
      if (loadedPages.length > 0 && nav === 'prev') {
        const lastIdx = computeLastPageIndexForAdjacentChapter(
          viewMode,
          isSpreadCover,
          loadedPages.length,
        );
        setCurrentPage(lastIdx);
      }
    }
  }, [
    chapters,
    chapterId,
    ensureChapterPages,
    id,
    isSpreadCover,
    preloadNeighborChapters,
    source,
    viewMode,
  ]);

  useEffect(() => {
    if (viewMode === 'flow' || pages.length === 0) {
      queueMicrotask(() => setPageReady(true));
      return;
    }

    const visible = getReaderVisibleIndices(viewMode, isSpreadCover, currentPage, pages.length);

    let cancelled = false;
    queueMicrotask(() => setPageReady(false));

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
    resumeDismissGateRef.current = null;
    queueMicrotask(() => setResumeOfferPage(null));
  }, [chapterId]);

  useEffect(() => {
    if (readerLoading || pages.length === 0) return;
    if (savedPageIndex === null || savedPageIndex < 1) return;
    if (chapters[currentChapterIdx]?.id !== chapterId) return;
    const clampedOffer = Math.min(savedPageIndex, pages.length - 1);
    if (clampedOffer < 1) return;
    const gateKey = `${chapterId}:${savedPageIndex}`;
    if (resumeDismissGateRef.current === gateKey) return;
    queueMicrotask(() => setResumeOfferPage(clampedOffer));
  }, [
    chapters,
    chapterId,
    currentChapterIdx,
    pages.length,
    readerLoading,
    savedPageIndex,
  ]);

  useEffect(() => {
    if (!uiVisible || showGrid) return;
    const tid = window.setTimeout(() => setUiVisible(false), UI_SHEET_AUTO_HIDE_MS);
    return () => clearTimeout(tid);
  }, [uiVisible, showGrid]);

  useEffect(() => {
    if (readerLoading || pages.length === 0) return;
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(READER_HELP_DISMISSED_KEY) === '1') return;
    } catch {
      return;
    }
    const tid = window.setTimeout(() => setShowReaderHelp(true), 900);
    return () => window.clearTimeout(tid);
  }, [readerLoading, pages.length]);

  /** Trackpad pinch / Ctrl+scroll: capture on reader root, normalize wheel delta (deltaMode), smooth zoom curve. */
  useEffect(() => {
    const root = readerRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      if (viewMode === 'flow') return;
      if (showSettings || showGrid || showReaderHelp || uiVisible) return;
      if (!(e.ctrlKey || e.metaKey)) return;

      e.preventDefault();
      e.stopPropagation();

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      if (e.deltaMode === 2) dy *= canvasRef.current?.clientHeight ?? 800;

      const sensitivity = 0.0016;
      setReaderZoom((z) =>
        clampReaderZoom(z * Math.exp(-dy * sensitivity)),
      );
    };

    root.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => root.removeEventListener('wheel', onWheel, { capture: true });
  }, [setReaderZoom, viewMode, showSettings, showGrid, showReaderHelp, uiVisible, readerLoading, pages.length]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || viewMode === 'flow') return;

    const onTouchMovePinch = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      const base = pinchStartDistRef.current;
      if (base <= 0) return;
      const a = e.touches[0];
      const b = e.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      e.preventDefault();
      const ratio = dist / base;
      setReaderZoom(pinchStartZoomRef.current * ratio);
      twoFingerGestureRef.current = true;
    };

    el.addEventListener('touchmove', onTouchMovePinch, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMovePinch);
  }, [setReaderZoom, viewMode]);

  useEffect(() => {
    if (chapters.length > 0) {
      queueMicrotask(() => {
        void loadChapterPages(currentChapterIdx);
      });
    }
  }, [currentChapterIdx, chapters, loadChapterPages]);

  useEffect(() => {
    if ((restrictedSource || (comic && isAdultComic(comic))) && !isAgeVerified && !showAgeGate) {
      queueMicrotask(() => setShowAgeGate(true));
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

    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', theme.shellBg);
    meta.setAttribute('data-reader-theme-sync', '');
    document.head.appendChild(meta);

    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      meta.remove();
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
      adjNavigateRef.current = 'next';
      nextChapter();
    }
  }, [viewMode, isSpreadCover, currentPage, pages.length, nextChapter]);

  const handlePrevPage = useCallback(() => {
    const step = (viewMode === 'journal' && !(isSpreadCover && currentPage <= 1)) ? 2 : 1;
    if (currentPage > 0) {
      setCurrentPage(p => Math.max(0, p - step));
      canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      adjNavigateRef.current = 'prev';
      prevChapter();
    }
  }, [viewMode, isSpreadCover, currentPage, prevChapter]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (viewMode !== 'flow' && event.touches.length >= 2) {
      const a = event.touches[0];
      const b = event.touches[1];
      twoFingerGestureRef.current = true;
      pinchStartDistRef.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStartZoomRef.current = readerZoomRef.current;
      return;
    }
    pinchStartDistRef.current = 0;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [viewMode]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (twoFingerGestureRef.current) {
      if (event.touches.length === 0) {
        twoFingerGestureRef.current = false;
        pinchStartDistRef.current = 0;
      }
      return;
    }
    if (viewMode === 'flow') return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    if (Math.abs(dx) < READER_TOUCH_SWIPE_MIN_DX || Math.abs(dx) <= Math.abs(dy)) return;

    const currentChapterId = chapters[currentChapterIdx]?.id || chapterId;
    if (dx < 0) {
      trackEvent('reader_swipe_next', { source, comicId: id, chapterId: currentChapterId });
      if (readingDirection === 'ltr') handleNextPage();
      else handlePrevPage();
      return;
    }

    trackEvent('reader_swipe_prev', { source, comicId: id, chapterId: currentChapterId });
    if (readingDirection === 'ltr') handlePrevPage();
    else handleNextPage();
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

      if (!flow) {
        const zoomReset = !e.repeat && (e.code === 'Digit0' || e.code === 'Numpad0');
        const zoomOut = e.code === 'Minus' || e.code === 'NumpadSubtract';
        const zoomIn = e.code === 'NumpadAdd' || (e.shiftKey && e.code === 'Equal');
        if (zoomReset || zoomIn || zoomOut) {
          e.preventDefault();
          if (zoomReset) setReaderZoom(1);
          else if (zoomIn) setReaderZoom((z) => z + READER_ZOOM_STEP);
          else setReaderZoom((z) => z - READER_ZOOM_STEP);
          return;
        }
      }

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
        if (readingDirection === 'ltr') handlePrevPage();
        else handleNextPage();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (readingDirection === 'ltr') handleNextPage();
        else handlePrevPage();
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
      if (e.key === 'Escape') {
        exitToComicDetail();
      }
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
    exitToComicDetail,
    setReaderZoom,
  ]);

  const flowDisplayZoom = viewMode === 'flow' ? 1 : readerZoom;
  const comicZoomWrapStyle: React.CSSProperties =
    flowDisplayZoom !== 1
      ? {
          width: `${100 / flowDisplayZoom}%`,
          transform: `scale(${flowDisplayZoom})`,
          transformOrigin: 'top center',
          marginLeft: 'auto',
          marginRight: 'auto',
        }
      : {
          width: '100%',
          marginLeft: 'auto',
          marginRight: 'auto',
        };

  if (restrictedSource && !isAgeVerified) {
    return (
      <LazyMotion features={domAnimation} strict>
      <div className="min-h-dvh overflow-hidden" style={{ backgroundColor: READER_THEMES[readerTheme].shellBg, color: READER_THEMES[readerTheme].text }}>
        <AnimatePresence>
          <AgeGateOverlay
            title={t.restricted}
            description={ageDescription}
            confirmLabel={t.verifyBtn}
            cancelLabel={t.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => router.push('/library')}
            zIndex={10000}
          />
        </AnimatePresence>
      </div>
      </LazyMotion>
    );
  }

  if (metadataLoading) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0C0B10]">
        <div className="flex flex-col items-center gap-5 px-6 text-center">
          <BookOpen className="h-9 w-9 text-[#E9E5EE]/80" strokeWidth={1.5} aria-hidden />
          <Loader2 className="h-5 w-5 animate-spin text-[#F2994A]" aria-hidden />
          <div className="flex flex-col items-center gap-1.5">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#E9E5EE]/75">Preparing library</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#E9E5EE]/40">Catalog & chapters</p>
          </div>
        </div>
      </div>
    );
  }

  if (!comic) return null;

  return (
    <LazyMotion features={domAnimation} strict>
    <div
      className="min-h-dvh overflow-hidden"
      style={{
        backgroundColor: READER_THEMES[readerTheme].shellBg,
        color: READER_THEMES[readerTheme].text,
      }}
    >
      <AnimatePresence>
        {showAgeGate && (
          <AgeGateOverlay
            title={t.restricted}
            description={ageDescription}
            confirmLabel={t.verifyBtn}
            cancelLabel={t.cancelBtn}
            confirmAction={handleAgeVerify}
            cancelAction={() => router.push('/library')}
            zIndex={10000}
          />
        )}
      </AnimatePresence>

      <m.div 
        ref={readerRef} 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="fixed inset-0 z-[10000] flex min-h-0 flex-col overflow-hidden select-none [-webkit-tap-highlight-color:transparent]"
        style={{
          backgroundColor: READER_THEMES[readerTheme].shellBg,
          color: READER_THEMES[readerTheme].text,
        }}
      >
        <AnimatePresence mode="wait">
          {readerLoading && (
            <m.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
              className="fixed inset-0 z-[10050] flex flex-col items-center justify-center overflow-hidden bg-[#0C0B10]"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex w-full max-w-[min(92vw,24rem)] flex-col items-center gap-5 px-6 text-center">
                <div
                  className="h-10 w-10 animate-spin rounded-full border-2"
                  style={{ borderColor: 'rgba(242,153,74,0.25)', borderTopColor: '#F2994A' }}
                  aria-hidden
                />
                <p className="line-clamp-2 text-sm font-medium text-[#E9E5EE]">
                  {comic.title}
                </p>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#F7AE5A]">
                  Chapter {chapters[currentChapterIdx]?.chapterNum || '–'}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#E9E5EE]/40">
                  Opening chapter
                </p>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!readerLoading && pages.length > 0 && scrolled && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="fixed left-1/2 z-[10045] flex -translate-x-1/2 items-center justify-center rounded-full border px-5 py-2 backdrop-blur-md pointer-events-none top-[max(0.75rem,env(safe-area-inset-top,0px))]"
              style={{
                backgroundColor: READER_THEMES[readerTheme].scrimBg,
                borderColor: READER_THEMES[readerTheme].scrimBorder,
              }}
            >
               <div className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: READER_THEMES[readerTheme].scrimText }}>
                  Chapter {chapters[currentChapterIdx]?.chapterNum}
               </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {uiVisible && pages.length > 0 && (
            <>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                onClick={() => setUiVisible(false)}
                className="fixed inset-0 z-[10020] bg-[rgba(12,11,16,0.6)] backdrop-blur-sm"
              />
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
                className="fixed bottom-0 left-0 right-0 z-[10030] bg-[#16131C] text-[#F8F5F0] border-t border-white/10 rounded-t-[20px] shadow-[0_-18px_48px_rgba(0,0,0,0.6)] pb-[max(env(safe-area-inset-bottom),2rem)] pt-6 px-6 md:px-12 flex flex-col gap-8 max-h-[85vh] overflow-y-auto"
              >
                <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">Now reading</div>
                    <div className="mt-1 truncate text-base font-semibold text-[#F8F5F0] md:text-lg">{comic.title}</div>
                  </div>
                  <button
                    onClick={exitToComicDetail}
                    className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-btn border border-white/10 bg-white/5 text-white/70 transition-colors hover:text-white"
                  >
                    <X size={20}/>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-8">
                     <div className="space-y-4">
                       <div className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">Reading mode</div>
                       <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-1">
                          <button aria-label="Classic reading mode" onClick={() => { setViewMode('classic'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${viewMode === 'classic' ? 'bg-[#F2994A] text-[#2A1705]' : 'text-white/55 hover:text-white'}`}>
                            Classic
                          </button>
                          <button aria-label="Journal reading mode" onClick={() => { setViewMode('journal'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${viewMode === 'journal' ? 'bg-[#F2994A] text-[#2A1705]' : 'text-white/55 hover:text-white'}`}>
                            Journal
                          </button>
                          <button aria-label="Flow reading mode" onClick={() => { setViewMode('flow'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${viewMode === 'flow' ? 'bg-[#F2994A] text-[#2A1705]' : 'text-white/55 hover:text-white'}`}>
                            Flow
                          </button>
                       </div>
                     </div>
                     <div className="space-y-4">
                       <div className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white/45 flex items-center justify-between">
                          <span>Chapter {chapters[currentChapterIdx]?.chapterNum || '0'}</span>
                          <span className="text-[#F7AE5A]">{chapters.length} total</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <button aria-label="Previous chapter" onClick={() => { prevChapter(); setUiVisible(false); }} disabled={currentChapterIdx === 0} className="flex-1 h-12 rounded-btn border border-white/10 bg-white/5 text-sm font-medium text-white/80 disabled:opacity-30 transition-colors flex items-center justify-center gap-2">
                            <ChevronLeft size={18} /> Previous
                          </button>
                          <button aria-label="Next chapter" onClick={() => { nextChapter(); setUiVisible(false); }} disabled={currentChapterIdx === chapters.length - 1} className="flex-1 h-12 rounded-btn bg-[#F2994A] text-[#2A1705] text-sm font-semibold disabled:opacity-30 transition-colors flex items-center justify-center gap-2">
                            Next <ChevronRight size={18} />
                          </button>
                       </div>
                     </div>
                  </div>
                  <div className="space-y-8">
                     <div className="space-y-4">
                       <div className="flex items-center justify-between font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
                         <span className="text-white/45">Progress</span>
                         <span className="text-[#F7AE5A]">
                           {viewMode === 'flow' ? `${Math.round(scrollProgress)}%` : `Page ${currentPage + 1} / ${pages.length}`}
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
                         className="w-full h-1.5 bg-white/10 appearance-none cursor-pointer accent-[#F2994A] rounded-full"
                       />
                     </div>
                     <div className="space-y-4">
                       <div className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">Tools</div>
                       <div className="flex items-center gap-3">
                          <button aria-label="Open page overview" onClick={() => setShowGrid(true)} className="flex-1 h-12 flex items-center justify-center gap-2 rounded-btn border border-white/10 bg-white/5 text-sm font-medium text-white/80 transition-colors hover:text-white">
                             <List size={18}/> Overview
                          </button>
                          {viewMode === 'flow' && (
                            <button aria-label="Scroll to top" onClick={() => { setUiVisible(false); canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex-1 h-12 flex items-center justify-center gap-2 rounded-btn border border-white/10 bg-white/5 text-sm font-medium text-white/80 transition-colors hover:text-white">
                              <ChevronUp size={18}/> Top
                            </button>
                          )}
                       </div>
                     </div>
                  </div>
                </div>
              </m.div>
            </>
          )}
        </AnimatePresence>

        {pages.length > 0 && viewMode !== 'flow' && !readerLoading && (
          <div
            className={`fixed z-[10055] flex max-w-[calc(100vw-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)-1.25rem)] touch-manipulation items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full border py-1 pl-1 pr-2 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] transition-opacity duration-300 sm:max-w-[calc(100vw-8rem)] sm:overflow-visible sm:px-1.5 sm:pr-1.5 bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] left-[max(0.75rem,env(safe-area-inset-left,0px))] sm:bottom-[max(2rem,env(safe-area-inset-bottom,0px))] sm:left-8 [&::-webkit-scrollbar]:hidden ${
              showSettings || showGrid || showReaderHelp || uiVisible
                ? 'pointer-events-none opacity-0'
                : 'opacity-100'
            }`}
            style={{
              backgroundColor: READER_THEMES[readerTheme].scrimBg,
              borderColor: READER_THEMES[readerTheme].scrimBorder,
            }}
            title={t.readerZoomHint}
            role="toolbar"
            aria-label="Zoom and display"
          >
            <button
              type="button"
              aria-label="Zoom out"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-30 sm:h-auto sm:w-auto sm:p-2.5"
              disabled={readerZoom <= 0.66}
              style={{ color: READER_THEMES[readerTheme].scrimText }}
              onClick={() => setReaderZoom((z) => z - READER_ZOOM_STEP)}
            >
              <ZoomOut size={18} aria-hidden />
            </button>
            <span
              className="min-w-10 flex-shrink-0 text-center font-mono text-[10px] font-medium tabular-nums sm:min-w-[3.25rem] sm:text-[11px]"
              style={{ color: READER_THEMES[readerTheme].scrimText }}
            >
              {Math.round(readerZoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-30 sm:h-auto sm:w-auto sm:p-2.5"
              disabled={readerZoom >= 2.98}
              style={{ color: READER_THEMES[readerTheme].scrimText }}
              onClick={() => setReaderZoom((z) => z + READER_ZOOM_STEP)}
            >
              <ZoomIn size={18} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t.readerZoomReset}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full sm:h-auto sm:w-auto sm:p-2.5"
              style={{ color: 'rgba(248,245,240,0.65)' }}
              onClick={() => setReaderZoom(1)}
            >
              <RotateCcw size={17} aria-hidden />
            </button>
            <span
              className="mx-0.5 h-6 w-px shrink-0 self-center"
              style={{ backgroundColor: READER_THEMES[readerTheme].scrimBorder }}
              aria-hidden
            />
            <button
              type="button"
              aria-label={isFullscreen ? t.readerFullscreenExit : t.readerFullscreenEnter}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full sm:h-auto sm:w-auto sm:p-2.5"
              style={{ color: READER_THEMES[readerTheme].scrimText }}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
            </button>
          </div>
        )}

        {pages.length > 0 && (
          <div
            className={`fixed z-[10040] touch-manipulation transition-opacity duration-300 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] sm:bottom-8 sm:right-8 ${
              uiVisible || showSettings || !settingsFabIdle
                ? 'opacity-0 pointer-events-none'
                : 'opacity-100'
            }`}
          >
             <button
               onClick={() => setShowSettings(true)}
               className="flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-md transition-colors"
               style={{
                 backgroundColor: READER_THEMES[readerTheme].scrimBg,
                 borderColor: READER_THEMES[readerTheme].scrimBorder,
                 color: READER_THEMES[readerTheme].scrimText,
               }}
             >
               <Settings className="h-6 w-6" aria-hidden />
             </button>
          </div>
        )}

        {/* Reader Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
              <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }} onClick={() => setShowSettings(false)} className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: 'rgba(12,11,16,0.6)' }} />
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
                className="relative w-full max-w-md rounded-sheet p-6 sm:p-8 space-y-7 shadow-2xl max-h-[88vh] overflow-y-auto"
                style={{
                  backgroundColor: READER_THEMES[readerTheme].panelBg,
                  border: `1px solid ${READER_THEMES[readerTheme].border}`,
                  color: READER_THEMES[readerTheme].text,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="ic-eyebrow" style={{ color: READER_THEMES[readerTheme].muted }}>{t.readerEyebrow}</div>
                    <h3 className="mt-1 font-display text-2xl font-normal">{t.readerSettingsModalTitle}</h3>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-btn transition-colors"
                    style={{
                      backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                      border: `1px solid ${READER_THEMES[readerTheme].border}`,
                      color: READER_THEMES[readerTheme].muted,
                    }}
                  >
                    <X size={20}/>
                  </button>
                </div>

                <div className="space-y-7">
                  {/* Theme Selector */}
                  <div className="space-y-3">
                    <div className="ic-eyebrow" style={{ color: READER_THEMES[readerTheme].muted }}>{t.readerInterfaceThemeLabel}</div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'dark', bg: 'bg-[#0C0B10]', label: t.readerThemeDark },
                        { id: 'sepia', bg: 'bg-[#F0E2C6]', label: t.readerThemeSepia },
                        { id: 'light', bg: 'bg-[#F6F3EC]', label: t.readerThemeLight }
                      ].map((themeOption) => (
                        <button
                          key={themeOption.id}
                          onClick={() => { setReaderTheme(themeOption.id as ReaderTheme); localStorage.setItem('reader_theme', themeOption.id); }}
                          className="flex flex-col items-center gap-2 rounded-card border p-3 transition-colors"
                          style={readerTheme === themeOption.id
                            ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft }
                            : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg }
                          }
                        >
                          <div className={`w-8 h-8 rounded-full border ${themeOption.bg}`} style={{ borderColor: READER_THEMES[readerTheme].border }} />
                          <span className="text-xs font-medium" style={{ color: readerTheme === themeOption.id ? READER_THEMES[readerTheme].text : READER_THEMES[readerTheme].muted }}>{themeOption.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reading Direction */}
                  <div className="space-y-3">
                    <div className="ic-eyebrow" style={{ color: READER_THEMES[readerTheme].muted }}>{t.readerReadingDirectionLabel}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { setReadingDirection('ltr'); localStorage.setItem('reading_direction', 'ltr'); }}
                        className="rounded-btn border py-3.5 text-sm font-medium transition-colors"
                        style={readingDirection === 'ltr'
                          ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                          : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                        }
                      >
                        {t.readerDirectionLtr}
                      </button>
                      <button
                        onClick={() => { setReadingDirection('rtl'); localStorage.setItem('reading_direction', 'rtl'); }}
                        className="rounded-btn border py-3.5 text-sm font-medium transition-colors"
                        style={readingDirection === 'rtl'
                          ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                          : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                        }
                      >
                        {t.readerDirectionRtl}
                      </button>
                    </div>
                  </div>

                  {/* View Modes */}
                  <div className="space-y-3">
                    <div className="ic-eyebrow" style={{ color: READER_THEMES[readerTheme].muted }}>{t.readerLayoutSectionTitle}</div>
                    <div className="flex items-center gap-0.5 rounded-full border p-1" style={{ borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg }}>
                       <button onClick={() => setViewMode('classic')} className="flex-1 rounded-full py-2.5 text-sm font-medium transition-colors" style={viewMode === 'classic'
                         ? { backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].accentText }
                         : { color: READER_THEMES[readerTheme].muted }
                       }>{t.readerViewClassic}</button>
                       <button onClick={() => setViewMode('journal')} className="flex-1 rounded-full py-2.5 text-sm font-medium transition-colors" style={viewMode === 'journal'
                         ? { backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].accentText }
                         : { color: READER_THEMES[readerTheme].muted }
                       }>{t.readerViewJournal}</button>
                       <button onClick={() => setViewMode('flow')} className="flex-1 rounded-full py-2.5 text-sm font-medium transition-colors" style={viewMode === 'flow'
                         ? { backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].accentText }
                         : { color: READER_THEMES[readerTheme].muted }
                       }>{t.readerViewFlow}</button>
                    </div>
                  </div>

                  {/* Page overview (thumbnail grid) */}
                  <div className="space-y-3">
                    <div className="ic-eyebrow" style={{ color: READER_THEMES[readerTheme].muted }}>{t.readerPageOverviewLabel}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSettings(false);
                        setShowGrid(true);
                      }}
                      className="w-full rounded-btn border py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      style={{
                        borderColor: READER_THEMES[readerTheme].border,
                        backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                        color: READER_THEMES[readerTheme].text,
                      }}
                    >
                      <List size={16} />
                      {t.readerAllPagesThumbnailsCta}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      setShowReaderHelp(true);
                    }}
                    className="w-full rounded-btn border py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    style={{
                      borderColor: READER_THEMES[readerTheme].border,
                      backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                      color: READER_THEMES[readerTheme].text,
                    }}
                  >
                    <HelpCircle size={16} aria-hidden /> {t.readerShortcutsBtn}
                  </button>

                  {/* Fullscreen */}
                  <div className="space-y-3">
                    <div className="ic-eyebrow" style={{ color: READER_THEMES[readerTheme].muted }}>{t.readerFullscreenSectionTitle}</div>
                    <button
                      onClick={() => void toggleFullscreen()}
                      className="w-full rounded-btn border py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      style={isFullscreen
                        ? { borderColor: READER_THEMES[readerTheme].accent, backgroundColor: READER_THEMES[readerTheme].accentSoft, color: READER_THEMES[readerTheme].text }
                        : { borderColor: READER_THEMES[readerTheme].border, backgroundColor: READER_THEMES[readerTheme].panelAltBg, color: READER_THEMES[readerTheme].muted }
                      }
                    >
                      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      {isFullscreen ? t.readerModalExitFullscreen : t.readerModalEnterFullscreen}
                    </button>
                  </div>
                </div>
              </m.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!readerLoading && resumeOfferPage !== null && resumeOfferPage > 0 && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
              className="fixed left-4 right-4 z-[10056] flex flex-col items-stretch gap-3 sm:left-1/2 sm:right-auto sm:w-[min(92vw,24rem)] sm:-translate-x-1/2"
              style={{
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)',
                bottom:
                  pages.length > 0 && viewMode !== 'flow' && !readerLoading
                    ? 'calc(7.35rem + env(safe-area-inset-bottom, 0px))'
                    : 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div
                className="rounded-card border px-4 py-3.5 shadow-2xl"
                style={{
                  backgroundColor: READER_THEMES[readerTheme].panelBg,
                  borderColor: READER_THEMES[readerTheme].border,
                  color: READER_THEMES[readerTheme].text,
                }}
              >
                <p className="text-center text-sm font-medium">
                  {t.readerResumePrompt.replace('{page}', String(resumeOfferPage + 1))}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 py-2.5 rounded-btn text-sm font-semibold transition-colors"
                    style={{ backgroundColor: READER_THEMES[readerTheme].accent, color: READER_THEMES[readerTheme].onAccent }}
                    onClick={() => {
                      if (savedPageIndex !== null) {
                        resumeDismissGateRef.current = `${chapterId}:${savedPageIndex}`;
                      } else {
                        resumeDismissGateRef.current = `${chapterId}:${resumeOfferPage}`;
                      }
                      const p = resumeOfferPage;
                      setResumeOfferPage(null);
                      setCurrentPage(p);
                      if (viewMode === 'flow') {
                        window.requestAnimationFrame(() => {
                          document.getElementById(`page-${p}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                      } else {
                        canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                      }
                    }}
                  >
                    {t.readerResumeBtn}
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2.5 rounded-btn border text-sm font-medium transition-colors"
                    style={{
                      borderColor: READER_THEMES[readerTheme].border,
                      color: READER_THEMES[readerTheme].muted,
                      backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                    }}
                    onClick={() => {
                      if (savedPageIndex !== null) {
                        resumeDismissGateRef.current = `${chapterId}:${savedPageIndex}`;
                      } else {
                        resumeDismissGateRef.current = `${chapterId}:${resumeOfferPage}`;
                      }
                      setResumeOfferPage(null);
                    }}
                  >
                    {t.readerStartOverBtn}
                  </button>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showReaderHelp && (
            <div className="fixed inset-0 z-[21000] flex items-center justify-center p-4">
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                onClick={() => setShowReaderHelp(false)}
                className="absolute inset-0 backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(12,11,16,0.6)' }}
              />
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
                className="relative w-full max-w-md rounded-sheet p-6 sm:p-8 space-y-6 shadow-2xl max-h-[85vh] overflow-y-auto"
                style={{
                  backgroundColor: READER_THEMES[readerTheme].panelBg,
                  border: `1px solid ${READER_THEMES[readerTheme].border}`,
                  color: READER_THEMES[readerTheme].text,
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-2xl font-normal pr-4">{t.readerShortcutsTitle}</h3>
                  <button
                    type="button"
                    onClick={() => setShowReaderHelp(false)}
                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-btn transition-colors"
                    style={{
                      backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                      border: `1px solid ${READER_THEMES[readerTheme].border}`,
                      color: READER_THEMES[readerTheme].muted,
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {t.readerShortcutsBody.split('\n').map((line, i) => {
                    const sep = line.indexOf(' — ');
                    if (sep === -1) {
                      return (
                        <p key={i} className="text-sm leading-relaxed" style={{ color: READER_THEMES[readerTheme].muted }}>
                          {line}
                        </p>
                      );
                    }
                    return (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <span className="text-sm" style={{ color: READER_THEMES[readerTheme].muted }}>
                          {line.slice(sep + 3)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {line.slice(0, sep).split(' / ').map((key, j) => (
                            <kbd
                              key={j}
                              className="rounded-[6px] border px-1.5 py-0.5 font-mono text-[11px]"
                              style={{
                                borderColor: READER_THEMES[readerTheme].border,
                                borderBottomWidth: 2,
                                backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                                color: READER_THEMES[readerTheme].text,
                              }}
                            >
                              {key}
                            </kbd>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs" style={{ color: READER_THEMES[readerTheme].muted }}>
                  {t.readerShortcutsShowHint}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="flex-1 py-3 rounded-btn text-sm font-semibold transition-colors"
                    style={{ backgroundColor: READER_THEMES[readerTheme].accent, color: READER_THEMES[readerTheme].onAccent }}
                    onClick={() => setShowReaderHelp(false)}
                  >
                    {t.readerShortcutsOk}
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-3 rounded-btn border text-sm font-medium transition-colors"
                    style={{
                      borderColor: READER_THEMES[readerTheme].border,
                      backgroundColor: READER_THEMES[readerTheme].panelAltBg,
                      color: READER_THEMES[readerTheme].text,
                    }}
                    onClick={() => {
                      try {
                        window.localStorage.setItem(READER_HELP_DISMISSED_KEY, '1');
                      } catch {
                        /* noop */
                      }
                      setShowReaderHelp(false);
                    }}
                  >
                    {t.readerShortcutsDontShow}
                  </button>
                </div>
              </m.div>
            </div>
          )}
        </AnimatePresence>
        
        <div
          className={`fixed z-[10040] touch-manipulation transition-opacity duration-300 top-[max(0.75rem,env(safe-area-inset-top,0px))] left-[max(0.75rem,env(safe-area-inset-left,0px))] sm:top-8 sm:left-8 ${uiVisible ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        >
           <button
             aria-label="Close reader"
             type="button"
             onClick={exitToComicDetail}
             className="flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-colors sm:h-12 sm:w-12"
             style={{
               backgroundColor: READER_THEMES[readerTheme].scrimBg,
               borderColor: READER_THEMES[readerTheme].scrimBorder,
               color: READER_THEMES[readerTheme].scrimText,
             }}
           >
             <X size={20} />
           </button>
        </div>

        <div
          ref={canvasRef}
          className={`relative h-full min-h-0 flex-1 w-full overflow-y-auto scroll-smooth touch-pan-y overscroll-y-contain ${
            viewMode !== 'flow' && pages.length > 0 && !readerLoading
              ? 'scroll-pb-[max(8.25rem,calc(7rem+env(safe-area-inset-bottom,0px)))] sm:scroll-pb-[max(6.75rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))]'
              : ''
          }`}
          style={{
            backgroundColor: READER_THEMES[readerTheme].canvasBg,
            scrollbarGutter: 'stable',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label="Comic reader content"
        >
           {viewMode !== 'flow' && (
             <>
               {/* Desktop: tap zones for page + UI. Mobile: pointer-events-none so vertical scroll reaches the canvas (swipe still changes page via onTouchEnd on parent). */}
               <div
                 className={`fixed inset-y-0 left-0 z-[10015] w-[25%] md:w-[20%] ${isMobile ? 'pointer-events-none' : 'cursor-pointer'}`}
                 onClick={(e) => {
                   if (isMobile) return;
                   e.stopPropagation();
                   if (readingDirection === 'ltr') handlePrevPage();
                   else handleNextPage();
                 }}
                 aria-hidden
               />
               <div
                 className={`fixed inset-y-0 right-0 z-[10015] w-[25%] md:w-[20%] ${isMobile ? 'pointer-events-none' : 'cursor-pointer'}`}
                 onClick={(e) => {
                   if (isMobile) return;
                   e.stopPropagation();
                   if (readingDirection === 'ltr') handleNextPage();
                   else handlePrevPage();
                 }}
                 aria-hidden
               />
               <div
                 className={`fixed inset-y-0 left-[25%] right-[25%] z-[10015] md:left-[20%] md:right-[20%] ${isMobile ? 'pointer-events-none' : 'cursor-pointer'}`}
                 onClick={(e) => {
                   if (isMobile) return;
                   e.stopPropagation();
                   setUiVisible((prev) => !prev);
                 }}
                 aria-hidden
               />
             </>
           )}

           {readerLoading ? null : pages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center gap-8 p-10 text-center max-w-md mx-auto">
                <ExternalLink size={32} style={{ color: READER_THEMES[readerTheme].muted }} />
                <div className="space-y-3">
                   <div className="ic-eyebrow" style={{ color: READER_THEMES[readerTheme].muted }}>Official reader only</div>
                   <h2 className="font-display text-2xl font-normal" style={{ color: READER_THEMES[readerTheme].text }}>Read this chapter on the publisher&apos;s site</h2>
                   <p className="text-sm leading-relaxed" style={{ color: READER_THEMES[readerTheme].muted }}>
                      This chapter is hosted on an official platform (for example MANGA Plus or VIZ).
                      Images are not available here so that publisher rights stay protected.
                   </p>
                </div>
                {officialReaderOutboundUrl && (
                  <a
                    href={officialReaderOutboundUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-btn px-6 py-3.5 text-sm font-semibold transition-colors"
                    style={{ backgroundColor: READER_THEMES[readerTheme].accent, color: READER_THEMES[readerTheme].onAccent }}
                  >
                    <ExternalLink size={18} /> Open official reader
                  </a>
                )}
                <div className="pt-6 flex gap-3">
                   <button onClick={prevChapter} disabled={currentChapterIdx === 0} className="rounded-btn border px-5 py-2.5 text-sm font-medium disabled:opacity-0 transition-colors" style={{ borderColor: READER_THEMES[readerTheme].border, color: READER_THEMES[readerTheme].muted }}>Previous chapter</button>
                   <button onClick={nextChapter} disabled={currentChapterIdx === chapters.length - 1} className="rounded-btn border px-5 py-2.5 text-sm font-medium disabled:opacity-0 transition-colors" style={{ borderColor: READER_THEMES[readerTheme].border, color: READER_THEMES[readerTheme].muted }}>Next chapter</button>
                </div>
             </div>
           ) : (
              <div
                style={comicZoomWrapStyle}
                className={`mx-auto flex w-full flex-col items-center transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
                  viewMode === 'flow'
                    ? 'pt-0 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] sm:pb-24'
                    : 'box-border min-h-full justify-center px-3 pt-4 pb-[max(8.25rem,calc(7rem+env(safe-area-inset-bottom,0px)))] sm:px-4 sm:pt-6 sm:pb-[max(7rem,calc(6rem+env(safe-area-inset-bottom,0px)))]'
                }`}
              >
                {viewMode === 'classic' ? (
                   <div className="relative flex w-full items-center justify-center">
                     {!pageReady ? (
                       <div className="flex min-h-[min(50vh,28rem)] w-full items-center justify-center py-12">
                         <div className="w-12 h-12 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(242,153,74,0.25)', borderTopColor: '#F2994A' }} />
                       </div>
                     ) : (
                       <m.img
                         key={`classic-${currentPage}`}
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                         src={pages[currentPage]}
                         style={{
                           maxWidth: isMobile ? '100%' : '80vw',
                           maxHeight: isMobile ? 'min(92dvh, 56rem)' : '90vh',
                           border: `1px solid ${READER_THEMES[readerTheme].border}`,
                         }}
                         className="mx-auto block shadow-2xl rounded-sm object-contain"
                         alt={`Page ${currentPage + 1} of ${comic.title}`}
                       />
                     )}
                   </div>
                ) : viewMode === 'journal' ? (
                   <div className="mx-auto flex w-full max-w-[min(100%,98vw)] items-stretch justify-center gap-0">
                      {!pageReady ? (
                        <div className="flex min-h-[min(50vh,28rem)] w-full items-center justify-center py-12">
                          <div className="w-12 h-12 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(242,153,74,0.25)', borderTopColor: '#F2994A' }} />
                        </div>
                      ) : currentPage === 0 && isSpreadCover ? (
                        <div className="relative max-h-[90vh] w-full aspect-[2/3] flex justify-center">
                          <Image
                            src={pages[0]}
                            fill
                            className="object-contain shadow-2xl"
                            style={{ border: `1px solid ${READER_THEMES[readerTheme].border}` }}
                            alt={`${comic.title} cover`}
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex items-stretch justify-center w-full gap-0">
                          <div className="relative flex-1 aspect-[2/3] max-h-[90vh] min-h-0">
                            <Image
                              src={pages[currentPage]}
                              fill
                              className="object-contain shadow-2xl"
                              style={{ border: `1px solid ${READER_THEMES[readerTheme].border}` }}
                              alt={`Page ${currentPage + 1} of ${comic.title}`}
                              unoptimized
                            />
                          </div>
                          {pages[currentPage + 1] && (
                            <div className="relative flex-1 aspect-[2/3] max-h-[90vh] min-h-0">
                              <Image
                                src={pages[currentPage + 1]}
                                fill
                                className="object-contain shadow-2xl"
                                style={{ border: `1px solid ${READER_THEMES[readerTheme].border}` }}
                                alt={`Page ${currentPage + 2} of ${comic.title}`}
                                unoptimized
                              />
                            </div>
                          )}
                        </div>
                      )}
                   </div>
                 ) : (
                  <div
                    className="mx-auto flex w-full flex-col items-center gap-0"
                    style={{ maxWidth: isMobile ? '100%' : '800px', width: '100%' }}
                  >
                      {pages.map((p, i) => (
                        <div
                          key={i}
                          className="relative w-full border-b flex justify-center"
                          style={{
                            backgroundColor: READER_THEMES[readerTheme].canvasBg,
                            borderColor: READER_THEMES[readerTheme].border,
                          }}
                        >
                          {/* Native img preserves each page aspect ratio (webtoon / tall pages); fixed aspect-[2/3] forced letterboxing on phones. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p}
                            alt={`Page ${i + 1}`}
                            loading={i < 2 ? 'eager' : 'lazy'}
                            decoding="async"
                            draggable={false}
                            className="block h-auto w-full max-w-full select-none object-contain"
                          />
                        </div>
                      ))}
                      {currentChapterIdx < chapters.length - 1 && (
                        <button
                          type="button"
                          onClick={nextChapter}
                          className="w-full rounded-card py-24 mt-12 mb-4 border border-dashed transition-colors flex flex-col items-center gap-3"
                          style={{
                            borderColor: READER_THEMES[readerTheme].border,
                          }}
                        >
                           <div className="font-mono text-xs font-medium uppercase tracking-[0.12em]" style={{ color: READER_THEMES[readerTheme].muted }}>
                             Go to next chapter
                           </div>
                           <ChevronDown size={24} style={{ color: READER_THEMES[readerTheme].muted, opacity: 0.6 }} />
                        </button>
                      )}
                  </div>
                )}
             </div>
           )}
        </div>

         <AnimatePresence>
           {showGrid && (
             <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }} className="fixed inset-0 z-[10050] bg-[rgba(12,11,16,0.92)] overflow-y-auto p-4 md:p-16">
                <div className="fixed top-0 left-0 right-0 h-24 bg-[rgba(12,11,16,0.78)] backdrop-blur-xl z-[10060] px-6 flex items-center justify-between border-b border-white/10 pt-[env(safe-area-inset-top)]">
                  <button aria-label="Back to reader" onClick={() => setShowGrid(false)} className="flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white">
                      <ChevronLeft size={20} /> Back to reader
                   </button>
                   <button aria-label="Close overview" onClick={() => setShowGrid(false)} className="w-11 h-11 flex items-center justify-center rounded-btn border border-white/10 bg-white/5 text-white/80 transition-colors hover:text-white"><X size={22}/></button>
                </div>
                <div className="mt-24 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6 max-w-7xl mx-auto">
                   {pages.map((p, i) => (
                     <button key={i} onClick={() => { setCurrentPage(i); setShowGrid(false); }} className={`relative aspect-[2/3] overflow-hidden rounded-[4px] bg-[#16131C] border-2 transition-colors ${currentPage === i ? 'border-[#F2994A]' : 'border-transparent hover:border-white/30'}`}>
                        <Image src={p} fill className="object-cover opacity-80" alt={`Page ${i + 1}`} unoptimized />
                        <span className="absolute bottom-1.5 right-1.5 rounded-[4px] bg-[rgba(12,11,16,0.72)] px-2 py-0.5 font-mono text-[11px] font-medium text-white/85">{i + 1}</span>
                     </button>
                   ))}
                </div>
             </m.div>
           )}
         </AnimatePresence>
      </m.div>

      <style jsx global>{`
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; border-radius: 50%; background: #F2994A; cursor: pointer; border: 2px solid #2A1705; }
      `}</style>
    </div>
    </LazyMotion>
  );
}
