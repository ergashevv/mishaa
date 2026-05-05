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
  ChevronDown
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
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
import { getChapterPages } from '@/actions/comic';
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
  source: 'mangadex' | 'archive' | 'nhentai' | 'marvel' | 'superhero' | BooruSource;
  aniListId?: string;
  malId?: string | number;
  aniListData?: any;
  jikanData?: any;
  superheroData?: any;
}

interface ComicReaderClientProps {
  initialComic: ComicDetails | null;
  initialChapters?: Chapter[];
  source: string;
  id: string;
  chapterId: string;
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

export default function ComicReaderClient({ initialComic, initialChapters, source, id, chapterId }: ComicReaderClientProps) {
  const router = useRouter();
  
  const [comic] = useState<ComicDetails | null>(initialComic);
  const [chapters] = useState<Chapter[]>(initialChapters || []);
  
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
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('dark');
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const readerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const chapterPageCacheRef = useRef<Map<string, string[]>>(new Map());
  const chapterPageRequestRef = useRef<Map<string, Promise<string[]>>>(new Map());
  const touchStartRef = useRef({ x: 0, y: 0 });

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
  }, []);

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

  const buildChapterPages = useCallback(async (chapter: Chapter) => {
    return getChapterPages(source as string, id as string, chapter.id);
  }, [id, source]);

  const ensureChapterPages = useCallback(async (chapter: Chapter) => {
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
    
    const minDelay = new Promise(resolve => setTimeout(resolve, 600));

    try {
      const chapterPages = await ensureChapterPages(chapter);
      await minDelay;
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

    const targetIndexes = viewMode === 'journal' && isSpreadCover && currentPage === 0
      ? [0]
      : [currentPage, ...(viewMode === 'journal' ? [currentPage + 1] : [])].filter((idx) => idx < pages.length);

    let cancelled = false;
    setPageReady(false);

    const preload = async () => {
      await Promise.all(
        targetIndexes.map((idx) => new Promise<void>((resolve) => {
          const image = new window.Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = pages[idx];
        }))
      );

      if (!cancelled) {
        setPageReady(true);
      }
    };

    void preload();

    return () => {
      cancelled = true;
    };
  }, [pages, currentPage, viewMode, isSpreadCover]);

  useEffect(() => {
    if (chapters.length > 0) {
      void loadChapterPages(currentChapterIdx);
      
      // Save to reading history
      if (typeof window !== 'undefined' && chapters[currentChapterIdx]) {
        const history = JSON.parse(localStorage.getItem('reading_history') || '{}');
        history[`${source}:${id}`] = {
          id: chapters[currentChapterIdx].id,
          title: chapters[currentChapterIdx].title || `Chapter ${chapters[currentChapterIdx].chapterNum}`,
          aniListId: comic?.aniListId,
          malId: comic?.malId,
          timestamp: Date.now()
        };
        localStorage.setItem('reading_history', JSON.stringify(history));
      }
    }
  }, [currentChapterIdx, chapters, loadChapterPages, id, source]);

  useEffect(() => {
    if (comic && isAdultComic(comic) && !isAgeVerified && !showAgeGate) {
      setShowAgeGate(true);
    }
  }, [comic, isAgeVerified, showAgeGate]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (e.key === 'Escape') router.push(`/library/${source}/${id}`);
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) readerRef.current?.requestFullscreen();
        else document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, pages.length, viewMode, currentChapterIdx, isSpreadCover, handleNextPage, handlePrevPage, router, source, id]);

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
              className="fixed inset-0 z-[10050] bg-[#020202] flex flex-col items-center justify-center overflow-hidden"
            >
              <div className="relative w-40 h-40 flex items-center justify-center mb-12">
                 <motion.div 
                   animate={{ rotate: 360 }}
                   transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                   className="absolute inset-0 border-[1px] border-[#ff4d00]/20 rounded-xl"
                 />
                 <motion.div 
                   animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="w-16 h-16 bg-gradient-to-br from-[#ff4d00] to-[#ff9000] rounded-sm rotate-45 shadow-[0_0_40px_rgba(255,77,0,0.4)]"
                 />
              </div>
              <div className="text-center relative z-10 space-y-2">
                <div className="text-[12px] font-black uppercase tracking-[1.2em] text-white pl-[1.2em]">Syncing_Matrix</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.6em] text-[#ff4d00]/50">
                   Unit_{chapters[currentChapterIdx]?.chapterNum || '00'}
                </div>
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
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Active_Matrix</div>
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
                          <button onClick={() => { setViewMode('classic'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'classic' ? 'bg-[#ff4d00] text-white' : 'text-white/40 hover:text-white'}`}>
                            Classic
                          </button>
                          <button onClick={() => { setViewMode('journal'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'journal' ? 'bg-[#ff4d00] text-white' : 'text-white/40 hover:text-white'}`}>
                            Journal
                          </button>
                          <button onClick={() => { setViewMode('flow'); setUiVisible(false); }} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-black uppercase transition-all ${viewMode === 'flow' ? 'bg-[#ff4d00] text-white' : 'text-white/40 hover:text-white'}`}>
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
                          <button onClick={() => { prevChapter(); setUiVisible(false); }} disabled={currentChapterIdx === 0} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black uppercase disabled:opacity-20 transition-all flex items-center justify-center gap-2">
                            <ChevronLeft size={18} /> Prev
                          </button>
                          <button onClick={() => { nextChapter(); setUiVisible(false); }} disabled={currentChapterIdx === chapters.length - 1} className="flex-1 h-14 bg-[#ff4d00] text-white rounded-xl text-[11px] font-black uppercase disabled:opacity-20 transition-all flex items-center justify-center gap-2">
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
                          <button onClick={() => setShowGrid(true)} className="flex-1 h-14 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black uppercase">
                             <List size={18}/> Overview
                          </button>
                          {viewMode === 'flow' && (
                            <button onClick={() => { setUiVisible(false); canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase">
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
                    <div className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: READER_THEMES[readerTheme].accent }}>Reader_Config</div>
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
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: READER_THEMES[readerTheme].muted }}>Display Matrix</div>
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
                   <div className="text-[12px] font-black uppercase tracking-[0.5em]" style={{ color: READER_THEMES[readerTheme].accent }}>External_Source_Required</div>
                   <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight" style={{ color: READER_THEMES[readerTheme].text }}>Official_Source_Access</h2>
                   <p className="text-sm leading-relaxed" style={{ color: READER_THEMES[readerTheme].muted }}>
                      This chapter is hosted on an <b>official external platform</b> (MangaPlus/Viz). 
                      MangaDex does not provide direct image assets for this specific unit to protect official licensing.
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
                    <ExternalLink size={20} /> Open_Official_Archive
                  </a>
                )}
                <div className="pt-10 flex gap-4">
                   <button onClick={prevChapter} disabled={currentChapterIdx === 0} className="px-6 py-3 border text-[10px] font-black uppercase tracking-widest disabled:opacity-0 transition-all" style={{ borderColor: READER_THEMES[readerTheme].border, color: READER_THEMES[readerTheme].muted }}>Prev_Unit</button>
                   <button onClick={nextChapter} disabled={currentChapterIdx === chapters.length - 1} className="px-6 py-3 border text-[10px] font-black uppercase tracking-widest disabled:opacity-0 transition-all" style={{ borderColor: READER_THEMES[readerTheme].border, color: READER_THEMES[readerTheme].muted }}>Next_Unit</button>
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
                         alt=""
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
                          <Image src={pages[0]} fill className="object-contain shadow-2xl border border-white/10" alt="cover" unoptimized />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-full gap-0">
                          <div className="relative flex-1 aspect-[2/3] max-h-[90vh]">
                            <Image src={pages[currentPage]} fill className="object-contain shadow-2xl" alt={`Page ${currentPage + 1}`} unoptimized />
                          </div>
                          {pages[currentPage + 1] && (
                            <div className="relative flex-1 aspect-[2/3] max-h-[90vh]">
                              <Image src={pages[currentPage + 1]} fill className="object-contain shadow-2xl" alt={`Page ${currentPage + 2}`} unoptimized />
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
                           <div className="text-[12px] font-black uppercase tracking-[0.5em] text-white/20">Next_Chapter_Ready</div>
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
                   <button onClick={() => setShowGrid(false)} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40">
                      <ChevronLeft size={20} /> BACK_TO_READER
                   </button>
                   <button onClick={() => setShowGrid(false)} className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl"><X size={24}/></button>
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
