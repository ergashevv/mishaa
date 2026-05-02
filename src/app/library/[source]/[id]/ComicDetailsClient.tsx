"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Play, Star, Clock, 
  Globe, BookOpen, Share2, 
  Bookmark, ChevronRight, Loader2, Sparkles, X
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import RichTextContent from '@/components/RichTextContent';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import {
  BooruSource,
} from '@/lib/booru';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';
import {
  readStoredMangaLanguage,
  MangaLanguage,
} from '@/lib/manga-language';
import { getChapters, getComicDetails } from '@/actions/comic';
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
  superheroData?: any;
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
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters || []);
  const [marvelIssue, setMarvelIssue] = useState<MarvelIssue | null>(initialComic?.marvelIssue || null);
  const [marvelSeries, setMarvelSeries] = useState<MarvelSeries | null>(initialComic?.marvelSeries || null);
  const [marvelSeriesIssues, setMarvelSeriesIssues] = useState<MarvelSeriesIssue[]>(initialComic?.marvelSeriesIssues || []);
  const [marvelCharacters, setMarvelCharacters] = useState<MarvelCharacter[]>(initialComic?.marvelCharacters || []);
  const [loading, setLoading] = useState(!initialComic);

  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage, setMangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t = translations[lang].library;

  // UI State
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const verified = readAgeVerification();
    const t = setTimeout(() => setIsAgeVerified(prev => (verified !== prev ? verified : prev)), 0);
    if (verified) persistAgeVerification();
    return () => clearTimeout(t);
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

  const fetchComicDetails = useCallback(async () => {
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
        if (comicData.marvelSeries) setMarvelSeries(comicData.marvelSeries as MarvelSeries);
        if (comicData.marvelSeriesIssues) setMarvelSeriesIssues(comicData.marvelSeriesIssues as MarvelSeriesIssue[]);
        if (comicData.marvelCharacters) setMarvelCharacters(comicData.marvelCharacters as MarvelCharacter[]);
      }
      if (chapterData) {
        setChapters(chapterData as Chapter[]);
        writeStorageItem(chaptersCacheKey, JSON.stringify(chapterData));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, source, mangaLanguage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchComicDetails();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchComicDetails]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      const bookmarked = bookmarks.some((b: any) => b.id === id && b.source === source);
      setIsBookmarked(bookmarked);
    }
  }, [id, source]);

  const toggleBookmark = () => {
    if (typeof window === 'undefined') return;
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    let newBookmarks;
    if (isBookmarked) {
      newBookmarks = bookmarks.filter((b: any) => !(b.id === id && b.source === source));
    } else {
      newBookmarks = [...bookmarks, { id, source, title: comic?.title, coverUrl: comic?.coverUrl }];
    }
    localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
    setIsBookmarked(!isBookmarked);
    
    // Dispatch custom event for real-time updates in other components
    window.dispatchEvent(new Event('bookmarksUpdated'));
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const socialShares = [
    { name: 'Telegram', icon: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png', url: `https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(comic?.title || '')}` },
    { name: 'Twitter', icon: 'https://cdn-icons-png.flaticon.com/512/733/733579.png', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(comic?.title || '')}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}` },
    { name: 'WhatsApp', icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png', url: `https://api.whatsapp.com/send?text=${encodeURIComponent((comic?.title || '') + ' ' + (typeof window !== 'undefined' ? window.location.href : ''))}` },
    { name: 'Facebook', icon: 'https://cdn-icons-png.flaticon.com/512/733/733547.png', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}` },
  ];

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

  const startReading = () => {
    if (chapters.length > 0) {
      router.push(`/library/${source}/${id}/read/${chapters[0].id}`);
    } else {
      alert("No chapters available to read.");
    }
  };


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
                    onClick={handleShare}
                    className="py-4 border border-white/10 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                    <Share2 size={14} /> Share
                  </button>
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
                    {chapters.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => {
                          router.push(`/library/${source}/${id}/read/${ch.id}`);
                        }}
                        className="group flex items-center justify-between p-5 transition-all text-left border bg-white/5 border-white/5 hover:border-[#ff4d00]/50"
                      >
                         <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#ff4d00]">Vol.{ch.volume || '0'} Ch.{ch.chapterNum}</div>
                            <div className="text-[13px] font-black uppercase tracking-tight group-hover:text-[#ff4d00] transition-colors break-words line-clamp-2">
                              {ch.title}
                            </div>
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
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Neural_Broadcast</div>
                  <div className="text-xl font-black uppercase tracking-tight">Share_Log</div>
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
                 <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Direct_Access_Key</div>
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
        .description-content strong { color: white; }
        .description-content em { color: rgba(255,255,255,0.7); font-style: italic; }
      `}</style>
    </div>
  );
}
