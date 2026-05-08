"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Play, Star, Clock, Globe, BookOpen, Share2, 
  Bookmark, ChevronRight, Loader2, Sparkles, X, Send, Copy, Check, ExternalLink
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import RichTextContent from '@/components/RichTextContent';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import { removeBookmark, upsertBookmark, BOOKMARKS_UPDATED_EVENT, LIBRARY_ACTIVITY_EVENT, readReadingHistory } from '@/lib/library-storage';
import { trackEvent } from '@/lib/analytics';
import {
  readStoredMangaLanguage,
  MangaLanguage,
} from '@/lib/manga-language';
import { getChapters, getComicDetails } from '@/actions/comic';
import { isRestrictedLibrarySource } from '@/lib/comic-sources';
import type { ComicChapter, ComicDetail } from '@/lib/comic-types';
import type {
  MarvelCharacter,
  MarvelIssue,
  MarvelSeries,
  MarvelSeriesIssue,
} from '@/lib/marvel/types';
import { normalizeMarvelImageToProxyUrl } from '@/lib/marvel/image';
import Image from 'next/image';
import Link from 'next/link';
import { useDominantColor } from '@/hooks/use-dominant-color';


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

const trimText = (value?: string, max = 140) => {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}...` : cleaned;
};

interface ComicDetailsClientProps {
  initialComic: ComicDetail | null;
  initialChapters?: ComicChapter[];
  source: string;
  id: string;
  initialAgeVerified?: boolean;
}

export default function ComicDetailsClient({ initialComic, initialChapters, source, id, initialAgeVerified = false }: ComicDetailsClientProps) {
  const router = useRouter();

  const [comic, setComic] = useState<ComicDetail | null>(initialComic);
  const [chapters, setChapters] = useState<ComicChapter[]>(initialChapters || []);
  const [marvelIssue, setMarvelIssue] = useState<MarvelIssue | null>(initialComic?.marvelIssue || null);
  const [marvelSeries, setMarvelSeries] = useState<MarvelSeries | null>(initialComic?.marvelSeries || null);
  const [marvelSeriesIssues, setMarvelSeriesIssues] = useState<MarvelSeriesIssue[]>(initialComic?.marvelSeriesIssues || []);
  const [marvelCharacters, setMarvelCharacters] = useState<MarvelCharacter[]>(initialComic?.marvelCharacters || []);
  const [loading, setLoading] = useState(!initialComic);

  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t = translations[lang].library;

  // UI State
  const [isAgeVerified, setIsAgeVerified] = useState(() => Boolean(initialAgeVerified));
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [lastReadChapter, setLastReadChapter] = useState<{ id: string, title: string, progressPercent?: number, currentPage?: number } | null>(null);

  const dominantColor = useDominantColor(comic?.coverUrl);
  const restrictedSource = isRestrictedLibrarySource(source);

  useEffect(() => {
    const verified = initialAgeVerified || readAgeVerification();
    const t = setTimeout(() => setIsAgeVerified(prev => (verified !== prev ? verified : prev)), 0);
    if (verified) persistAgeVerification();
    return () => clearTimeout(t);
  }, [initialAgeVerified]);

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

  const fetchComicDetails = useCallback(async () => {
    if (restrictedSource && !isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    const chaptersCacheKey = `chapters_${source}_${id}_${mangaLanguage}`;
    const comicCacheKey = `comic_${source}_${id}_${mangaLanguage}`;

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
        if (comicData.marvelSeries) setMarvelSeries(comicData.marvelSeries);
        if (comicData.marvelSeriesIssues) setMarvelSeriesIssues(comicData.marvelSeriesIssues);
        if (comicData.marvelCharacters) setMarvelCharacters(comicData.marvelCharacters);
      }
      if (chapterData) {
        setChapters(chapterData);
        writeStorageItem(chaptersCacheKey, JSON.stringify(chapterData));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, source, mangaLanguage, isAgeVerified, restrictedSource]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchComicDetails();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchComicDetails]);


  useEffect(() => {
    let cancelled = false;

    const syncLibraryState = async () => {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      const bookmarked = bookmarks.some((b: any) => b.id === id && b.source === source);
      setIsBookmarked(bookmarked);

      const localHistory = readReadingHistory();
      const localComicHistory = localHistory[`${source}:${id}`];
      let nextHistory = localComicHistory
        ? {
            id: localComicHistory.chapterId || localComicHistory.id || id,
            title: localComicHistory.chapterTitle || localComicHistory.title || 'Continue reading',
            progressPercent: localComicHistory.progressPercent,
            currentPage: localComicHistory.currentPage,
          }
        : null;

      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json().catch(() => null);

        if (meData?.user) {
          const progressRes = await fetch(`/api/reading-progress?source=${encodeURIComponent(source)}&comicId=${encodeURIComponent(id)}`);
          const progressData = await progressRes.json().catch(() => null);
          const progress = progressData?.progress;
          if (progress?.chapterId) {
            nextHistory = {
              id: progress.chapterId,
              title: progress.chapterTitle || 'Continue reading',
              progressPercent: progress.progressPercent,
              currentPage: progress.currentPage,
            };
          }
        }
      } catch {
        // Local history is still available even if the cloud sync fails.
      }

      if (!cancelled) {
        setLastReadChapter(nextHistory);
      }
    };

    void syncLibraryState();
    window.addEventListener(BOOKMARKS_UPDATED_EVENT, syncLibraryState);
    window.addEventListener(LIBRARY_ACTIVITY_EVENT, syncLibraryState);
    window.addEventListener('storage', syncLibraryState);
    return () => {
      cancelled = true;
      window.removeEventListener(BOOKMARKS_UPDATED_EVENT, syncLibraryState);
      window.removeEventListener(LIBRARY_ACTIVITY_EVENT, syncLibraryState);
      window.removeEventListener('storage', syncLibraryState);
    };
  }, [id, source]);

  const toggleBookmark = () => {
    if (typeof window === 'undefined') return;
    if (isBookmarked) {
      removeBookmark(source, id);
      trackEvent('bookmark_removed', { source, comicId: id, comicTitle: comic?.title || id });
    } else {
      upsertBookmark({
        id,
        source,
        title: comic?.title,
        coverUrl: comic?.coverUrl,
        rating: comic?.rating,
        href: `/library/${source}/${id}`,
        savedAt: Date.now(),
      });
      trackEvent('bookmark_added', { source, comicId: id, comicTitle: comic?.title || id });
    }
    setIsBookmarked(!isBookmarked);
  };

  const shareToTelegram = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out ${comic?.title} on iComics.wiki! \n\n${comic?.description.substring(0, 100)}...`);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const shareToTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Reading ${comic?.title} on iComics.wiki!`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  const socialShares = [
    { name: 'Telegram', url: '#', icon: 'https://cdn.simpleicons.org/telegram/24A1DE' },
    { name: 'X / Twitter', url: '#', icon: 'https://cdn.simpleicons.org/x/1DA1F2' },
    { name: 'WhatsApp', url: '#', icon: 'https://cdn.simpleicons.org/whatsapp/25D366' },
    { name: 'Copy Link', url: '#', icon: 'https://cdn.simpleicons.org/link/FFFFFF' },
  ];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const reportIssue = () => {
    const params = new URLSearchParams({
      category: 'CONTENT_ISSUE',
      comic: comic?.title || id,
      source,
      details: `Please review this item for broken metadata, unsafe content, or copyright concerns.\n\n${comic?.title || id} (${source}:${id})`,
    });

    trackEvent('report_opened', { source, comicId: id, comicTitle: comic?.title || id });
    router.push(`/support?${params.toString()}`);
  };

  useEffect(() => {
    if ((restrictedSource || (comic && isAdultComic(comic))) && !isAgeVerified && !showAgeGate) {
      const timer = setTimeout(() => setShowAgeGate(true), 0);
      return () => clearTimeout(timer);
    }
  }, [comic, isAgeVerified, showAgeGate, restrictedSource]);

  const handleAgeVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };

  const startReading = () => {
    if (chapters.length > 0) {
      const resumeChapterId = lastReadChapter?.id && chapters.some((chapter) => chapter.id === lastReadChapter.id)
        ? lastReadChapter.id
        : chapters[0].id;
      trackEvent('comic_start_reading', {
        source,
        comicId: id,
        comicTitle: comic?.title || id,
        chapterId: resumeChapterId,
      });
      router.push(`/library/${source}/${id}/read/${resumeChapterId}`);
    } else {
      // Professional approach: Scroll to the chapters section to show the explanation
      const chaptersSection = document.getElementById('chapters-section');
      if (chaptersSection) {
        chaptersSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        console.warn("No chapters available to read.");
      }
    }
  };


  if (restrictedSource && !isAgeVerified) {
    return (
      <div className="min-h-screen bg-[#020202] text-white overflow-x-hidden selection:bg-[#ff4d00] selection:text-white">
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

  if (loading) return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="w-12 h-12 text-[#ff4d00] animate-spin" />
        <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/20">Loading comic...</div>
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
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Loading issue...</div>
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
            Back
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
                  Official site
                </a>
                <button
                  onClick={() => router.push('/library')}
                  className="py-4 px-4 bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-[0.25em] hover:bg-white/10 hover:text-white transition-all"
                >
                  Library
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 p-5 space-y-3">
                <div className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Issue details</div>
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
                    <div className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30">Featured characters</div>
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
                    Marvel Comics
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
                      <div className="text-[9px] uppercase tracking-[0.35em] text-white/25">Series</div>
                      <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">About this series</h2>
                    </div>
                    <Globe className="text-[#ff4d00]" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
                    <div className="aspect-[2/3] bg-black border border-white/10 overflow-hidden relative">
                      <Image
                        src={normalizeMarvelImageToProxyUrl(marvelSeries.thumbnail) || comic.coverUrl}
                        alt={marvelSeries.title || marvelIssue.seriesName || ''}
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
                          {trimText(marvelSeries.description, 300) || 'Series description from Marvel.'}
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
    ? 'text-[clamp(1.35rem,2.4vw+0.6rem,2.65rem)]'
    : titleLength > 55
      ? 'text-[clamp(1.6rem,2.8vw+0.65rem,3.15rem)]'
      : titleLength > 35
        ? 'text-[clamp(1.85rem,3.2vw+0.7rem,3.85rem)]'
        : 'text-[clamp(2rem,3.8vw+0.5rem,4.5rem)]';
  const pageBackdropStyle = {
    backgroundImage: `
      radial-gradient(circle at 18% 18%, rgba(${dominantColor}, 0.15), transparent 30%),
      radial-gradient(circle at 82% 12%, rgba(255, 255, 255, 0.05), transparent 22%),
      radial-gradient(circle at 50% 100%, rgba(${dominantColor}, 0.08), transparent 40%),
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
      
      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[30000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0a0a0a] border border-white/10 w-full max-w-sm p-8 space-y-6">
              <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white"><X size={20} /></button>
              <h3 className="text-sm font-black uppercase tracking-[0.3em]">Share</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={shareToTelegram} className="p-4 bg-[#24A1DE]/10 border border-[#24A1DE]/30 text-[#24A1DE] flex flex-col items-center justify-center gap-2 hover:bg-[#24A1DE] hover:text-white transition-all"><Send size={24} /><span className="text-[9px] font-black uppercase tracking-widest">Telegram</span></button>
                <button onClick={shareToTwitter} className="p-4 bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 text-[#1DA1F2] flex flex-col items-center justify-center gap-2 hover:bg-[#1DA1F2] hover:text-white transition-all"><X size={24} /><span className="text-[9px] font-black uppercase tracking-widest">X / Twitter</span></button>
              </div>
              <button onClick={copyToClipboard} className="w-full p-4 bg-white/5 border border-white/10 flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
                {linkCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                <span className="text-[10px] font-black uppercase tracking-widest">{linkCopied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </motion.div>
          </div>
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

      <main className="relative z-10 mx-auto max-w-[min(100%,88rem)] px-4 pb-28 pt-20 sm:px-6 lg:px-10">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            href="/library"
            className="mb-10 flex items-center gap-3 text-xs font-semibold tracking-wide text-zinc-500 transition-colors hover:text-[#ff4d00] group"
          >
            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" /> Back to library
          </Link>
        </motion.div>

        <article
          itemScope
          itemType="https://schema.org/ComicStory"
          className="space-y-14 lg:space-y-20"
        >
          <section className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12 xl:gap-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-[14rem] shrink-0 sm:max-w-[15rem] lg:mx-0 lg:max-w-[15.5rem] xl:max-w-[16.5rem] lg:sticky lg:top-24">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/12 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06]">
               <Image 
                 src={comic.coverUrl} 
                 fill
                 className="object-cover"
                 alt={`Read ${comic.title} online - Cover Art`} 
                 itemProp="image"
                 sizes="(max-width: 1024px) 256px, 288px"
                 unoptimized
               />
            </div>
            
            <div className="mt-6 grid grid-cols-1 gap-3">
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
               
               {lastReadChapter && (
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                 >
                   <Link
                     href={`/library/${source}/${id}/read/${lastReadChapter.id}`}
                     className="flex w-full flex-col items-center justify-center gap-1 overflow-hidden border border-white/20 bg-white/5 py-4 font-black uppercase tracking-widest text-[9px] text-white transition-all hover:bg-white/10"
                   >
                     <span className="text-[#ff4d00]">Continue reading</span>
                     <span className="w-full truncate px-4 text-center text-white/40 opacity-70">{lastReadChapter.title}</span>
                     {typeof lastReadChapter.progressPercent === 'number' && (
                       <span className="text-[8px] font-black uppercase tracking-[0.35em] text-white/25">
                         {lastReadChapter.progressPercent}% complete
                       </span>
                     )}
                   </Link>
                 </motion.div>
               )}
               {comic.source === 'superhero' && (
                 <button onClick={() => router.push('/studio')} className="group relative py-6 bg-[#ff4d00] text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] overflow-hidden transition-all hover:bg-white hover:text-black">
                   <div className="absolute left-0 top-0 bottom-0 w-0 bg-black group-hover:w-full transition-all duration-500 z-0 opacity-10" />
                   <span className="relative z-10 flex items-center gap-3"><Sparkles fill="currentColor" size={16} /> Comic studio</span>
                 </button>
               )}
              <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={toggleBookmark}
                    className={`py-4 border flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                      isBookmarked 
                        ? 'bg-[#ff4d00] border-[#ff4d00] text-white' 
                        : 'border-white/10 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} /> 
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </button>
                  <button 
                    onClick={() => setShowShareModal(true)}
                    className="py-4 border border-white/10 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                    <Share2 size={14} /> Share
                  </button>
                  <button
                    onClick={reportIssue}
                    className="col-span-2 py-4 border border-[#ff4d00]/30 bg-[#ff4d00]/10 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#ff4d00] hover:bg-[#ff4d00] hover:text-white transition-all"
                  >
                    Report Issue
                  </button>
               </div>
            </div>
          </motion.div>

          <div className="flex min-w-0 flex-1 flex-col gap-10 lg:gap-12">
          {/* Main Info */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="min-w-0 space-y-6">
            <div className="min-w-0 space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                 <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                    <Star size={12} className="text-[#ff4d00]" fill="#ff4d00" /><span className="text-[12px] font-black tracking-tighter">{comic.rating}</span>
                 </div>
                 <div className="px-4 py-2 bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
                    {comic.source}
                 </div>
                 <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-[0.3em]"><Clock size={12} /> {comic.year || 'N/A'}</div>
                 {comic.author && (
                   <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">
                     <span className="text-[#ff4d00]">Author:</span> {comic.author}
                   </div>
                 )}
                 <div className="px-4 py-2 bg-[#ff4d00]/10 border border-[#ff4d00]/30 text-[#ff4d00] text-[10px] font-black uppercase tracking-widest">{comic.status}</div>
              </div>
              
                <h1 
                  itemProp="name"
                  className={`${titleSizeClass} w-full min-w-0 max-w-full font-black italic uppercase tracking-tight md:tracking-tighter leading-[1.05] text-balance wrap-anywhere`}
                >
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
          </motion.div>

            <div className="min-w-0 space-y-12 lg:space-y-14">
            <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                     <h2 className="text-sm font-semibold text-[#ff4d00]">Synopsis</h2>
                     <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  </div>
                  <div 
                    itemProp="description"
                    className="description-content max-h-[min(70vh,48rem)] overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/50 p-5 text-[0.95rem] leading-relaxed text-zinc-300 md:p-6 md:text-[1.02rem]"
                  >
                    <RichTextContent
                      content={String(comic.description || "")
                        .replace(/\[b\]/g, '')
                        .replace(/\[\/b\]/g, '')
                        .replace(/\[i\]/g, '')
                        .replace(/\[\/i\]/g, '')}
                    />
                  </div>
            </section>

               {comic.related && comic.related.length > 0 && (
                 <section className="space-y-4 rounded-xl border border-white/[0.07] bg-zinc-950/35 p-4 md:p-5">
                   <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="text-[#ff4d00]" size={15} />
                        <h2 className="text-sm font-semibold text-white">More like this</h2>
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Similar titles</span>
                   </div>

                   <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
                     {comic.related.map((item) => (
                       <motion.button
                         type="button"
                         key={item.id}
                         whileHover={{ y: -3 }}
                         transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                         onClick={() => router.push(`/library/${item.source}/${item.id}`)}
                         className="group/rail w-[6.75rem] shrink-0 snap-start text-left sm:w-[7.25rem]"
                       >
                         <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-md transition-colors group-hover/rail:border-[#ff4d00]/40">
                           <div className="relative h-[7.5rem] w-full sm:h-[8rem]">
                             <Image
                               src={item.coverUrl}
                               fill
                               sizes="116px"
                               className="object-cover"
                               alt={item.title}
                               unoptimized
                             />
                           </div>
                         </div>
                         <p className="mt-2 line-clamp-2 px-0.5 text-[9px] font-medium uppercase leading-snug tracking-tight text-zinc-500 group-hover/rail:text-zinc-200">
                             {item.title}
                         </p>
                       </motion.button>
                     ))}
                   </div>
                 </section>
               )}

                {/* Big Data - Characters & Actors Section */}
                {comic.aniListData && (comic.aniListData.characters?.edges?.length ?? 0) > 0 && (
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="text-[#ff4d00]" size={15} />
                        <h2 className="text-sm font-semibold text-white">Characters & cast</h2>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                      {(comic.aniListData?.characters?.edges ?? []).map((edge, index) => (
                        <div key={edge.node?.id ?? `char-${index}`} className="group cursor-default">
                          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                            <Image 
                              src={edge.node?.image?.large || '/logo.png'} 
                              alt={edge.node?.name?.full || ''}
                              fill
                              sizes="80px"
                              className="object-cover object-top"
                              unoptimized
                            />
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md text-[6px] font-black uppercase tracking-widest text-white/80 border border-white/10">
                              {edge.role}
                            </div>
                          </div>
                          <div className="mt-2 space-y-0.5">
                            <div className="truncate text-[9px] font-medium uppercase tracking-wide text-zinc-400">
                              {edge.node?.name?.userPreferred}
                            </div>
                            <div className="text-[8px] font-medium uppercase tracking-wider text-zinc-600">
                              {edge.role === 'MAIN' ? 'Main' : 'Support'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advanced Metadata Stats */}
                {(comic.aniListData || comic.jikanData) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <div className="bg-white/5 border border-white/10 p-4 md:p-6 space-y-3 min-w-0">
                      <div className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/20">Community score</div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <div className="text-2xl md:text-4xl lg:text-5xl font-black text-[#ff4d00] italic leading-none">
                          {Math.round(Number(comic.aniListData?.averageScore || (comic.jikanData?.score ? (comic.jikanData.score * 10) : 85)))}
                        </div>
                        <div className="text-xs md:text-sm font-black text-white/20">/100</div>
                      </div>
                      <div className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest text-white/40">
                        Based on {comic.aniListData?.popularity || comic.jikanData?.members || '15k'} users
                      </div>
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 p-4 md:p-6 space-y-3 min-w-0">
                      <div className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/20">Trending rank</div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <div className="text-2xl md:text-4xl lg:text-5xl font-black text-white italic leading-none">
                          #{comic.aniListData?.trending || comic.jikanData?.rank || '42'}
                        </div>
                        <div className="text-xs md:text-sm font-black text-white/20">TOP</div>
                      </div>
                      <div className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest text-white/40">
                        Trending globally
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-4 md:p-6 space-y-3 min-w-0">
                      <div className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/20">Series status</div>
                      <div className="flex items-baseline gap-2 overflow-hidden">
                        <div className="text-lg md:text-xl lg:text-2xl font-black uppercase text-white italic leading-none truncate">
                          {comic.status}
                        </div>
                      </div>
                      <div className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest text-white/40">
                        {comic.year ? `Since ${comic.year}` : 'Active timeline'}
                      </div>
                    </div>
                  </div>
                )}
             </div>

            {/* Conditional Content based on source */}
            {comic.source === 'superhero' && (comic as any).superheroData ? (
               <div className="space-y-10">
                  <div className="space-y-6">
                     <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">Power stats</h3>
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
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 border-b border-white/10 pb-2">Work & base</div>
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
              <div id="chapters-section" className="space-y-8">
                 <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-white/40">Chapters</h3>
                    <span className="text-[10px] font-black text-[#ff4d00] uppercase tracking-widest">{chapters.length} total</span>
                 </div>
                 <div className="grid grid-cols-1 gap-3 max-h-[min(70vh,44rem)] overflow-y-auto custom-scrollbar pr-2 md:pr-4 md:gap-4">
                    {chapters.length > 0 ? (
                      chapters.map((ch) => {
                        const sharedClass =
                          'group relative flex w-full items-center gap-4 border border-white/5 bg-white/5 p-5 text-left transition-all hover:border-[#ff4d00]/45 hover:bg-[#ff4d00]/10 md:p-6';
                        const inner = (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-r from-[#ff4d00]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="relative z-10 min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff4d00]">
                                  Vol.{ch.volume || '0'} Ch.{ch.chapterNum}
                                </div>
                                {ch.externalUrl && (
                                  <div className="rounded-sm border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-blue-500">
                                    External
                                  </div>
                                )}
                              </div>
                              <div className="wrap-anywhere line-clamp-2 text-[13px] font-black uppercase leading-snug tracking-tight text-white/90 transition-colors group-hover:text-white md:text-[15px]">
                                {ch.title || `Chapter ${ch.chapterNum}`}
                              </div>
                            </div>
                            {ch.externalUrl ? (
                              <ExternalLink
                                size={20}
                                className="relative z-10 shrink-0 text-white/20 transition-all group-hover:text-blue-400"
                              />
                            ) : (
                              <ChevronRight
                                size={20}
                                className="relative z-10 shrink-0 text-white/15 transition-all group-hover:translate-x-0.5 group-hover:text-[#ff4d00]"
                              />
                            )}
                          </>
                        );

                        if (ch.externalUrl) {
                          return (
                            <a
                              key={ch.id}
                              href={ch.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={sharedClass}
                            >
                              {inner}
                            </a>
                          );
                        }

                        return (
                          <Link
                            key={ch.id}
                            href={`/library/${source}/${id}/read/${ch.id}`}
                            prefetch={false}
                            className={sharedClass}
                          >
                            {inner}
                          </Link>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-20 border border-dashed border-white/10 flex flex-col items-center justify-center text-center px-10">
                         <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <BookOpen className="text-white/20" size={32} />
                         </div>
                         <h4 className="text-[11px] font-black uppercase tracking-[0.5em] text-white mb-3">No chapters for this language</h4>
                         <p className="text-sm text-white/30 max-w-sm leading-relaxed mb-8">
                            We didn&apos;t find any <b>{mangaLanguage.toUpperCase()}</b> chapters. This title might only have releases in other languages on MangaDex.
                         </p>
                         <div className="flex flex-wrap justify-center gap-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#ff4d00]">Try another language from the menu in the header</span>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>
          </section>
        </article>
      </main>

      {/* Custom Creative Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 p-8 rounded-[2rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Pulse Glow Effect */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#ff4d00]/20 blur-[60px] rounded-full pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Share</div>
                  <div className="text-xl font-black uppercase tracking-tight">Share link</div>
                </div>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-red-600 transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Comic Preview Card */}
              <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl mb-8">
                 <div className="relative w-16 aspect-[2/3] flex-shrink-0 overflow-hidden rounded-lg">
                    <Image src={comic.coverUrl} fill className="object-cover" alt="" unoptimized />
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="text-xs font-black uppercase tracking-tight text-white/40 mb-1">{comic.source}</div>
                    <div className="text-sm font-black uppercase tracking-tight truncate">{comic.title}</div>
                 </div>
              </div>

              {/* Social Grid */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {socialShares.map((social) => (
                  <a 
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-3 group"
                  >
                    <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-[#ff4d00] group-hover:border-[#ff4d00] group-hover:-translate-y-1 transition-all shadow-lg">
                       <img src={social.icon} className="w-6 h-6 invert group-hover:invert-0 transition-all" alt={social.name} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30 group-hover:text-white transition-colors">{social.name}</span>
                  </a>
                ))}
              </div>

              {/* Copy Field */}
              <div className="space-y-3">
                 <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Page link</div>
                 <div className="relative group">
                    <input 
                      type="text" 
                      readOnly 
                      value={typeof window !== 'undefined' ? window.location.href : ''} 
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-[11px] font-mono text-white/60 focus:outline-none focus:border-[#ff4d00]/50 transition-all"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className={`absolute right-2 top-2 bottom-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        linkCopied ? 'bg-green-500 text-white' : 'bg-[#ff4d00] text-white hover:brightness-110 active:scale-95'
                      }`}
                    >
                      {linkCopied ? 'Copied' : 'Copy'}
                    </button>
                 </div>
              </div>

              {/* Footer Decoration */}
              <div className="mt-10 flex items-center gap-4">
                 <div className="h-px flex-1 bg-white/5" />
                 <div className="flex gap-1">
                    {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-[#ff4d00]/30 rounded-full" />)}
                 </div>
                 <div className="h-px flex-1 bg-white/5" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 77, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 77, 0, 0.5); }
        .description-content strong { color: rgb(244 244 245); }
        .description-content em { color: rgb(161 161 170); font-style: italic; }
      `}</style>
    </div>
  );
}
