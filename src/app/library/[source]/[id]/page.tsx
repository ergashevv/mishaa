"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Play, Info, Star, Clock, 
  Layers, Globe, BookOpen, Share2, 
  Bookmark, Heart, Download, X,
  ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronRight, Loader2, Sparkles, Flag, List,
  Settings, Columns, Smartphone, Monitor,
  ChevronDown, ChevronUp, Menu, MousePointer2
} from 'lucide-react';
import AgeGateOverlay from '@/components/AgeGateOverlay';
import RichTextContent from '@/components/RichTextContent';
import { isAdultComic, persistAgeVerification, readAgeVerification } from '@/lib/age-verification';
import { translations, Lang } from '@/lib/translations';
import { 
  DEFAULT_MANGA_LANGUAGE,
  getMangaDexTranslatedLanguages,
  resolveMangaDexLocalizedText,
  readStoredMangaLanguage,
  MangaLanguage,
} from '@/lib/manga-language';

interface Chapter {
  id: string;
  title: string;
  chapterNum: string;
  volume?: string;
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
  source: 'mangadex' | 'archive' | 'nhentai' | 'marvel';
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

export default function ComicDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { source, id } = params;
  
  const [comic, setComic] = useState<ComicDetails | null>(null);
  const [marvelIssue, setMarvelIssue] = useState<MarvelIssue | null>(null);
  const [marvelSeriesIssues, setMarvelSeriesIssues] = useState<MarvelSeriesIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  
  // Reader State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'classic' | 'flow' | 'journal'>('classic');
  const [isLongStrip, setIsLongStrip] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isSpreadCover, setIsSpreadCover] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [mangaLanguage] = useState<MangaLanguage>(readStoredMangaLanguage);
  const t = (translations[lang] as any).library;
  
  const readerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check device type
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Check age verification
    const verified = readAgeVerification();
    setIsAgeVerified(verified);
    if (verified) persistAgeVerification();

    // Language handling
    const savedLang = localStorage.getItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      setLang(savedLang);
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // UI Auto-hide logic
  const handleUserActivity = useCallback(() => {
    setUiVisible(true);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    uiTimeoutRef.current = setTimeout(() => {
      if (reading) setUiVisible(false);
    }, 4000);
  }, [reading]);

  useEffect(() => {
    fetchComicDetails();
  }, [id, source, isAgeVerified]);

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

  const fetchComicDetails = async () => {
    setLoading(true);
    try {
      if (source === 'nhentai' && !isAgeVerified) {
        setShowAgeGate(true);
        return;
      }

      if (source === 'marvel') {
        const issueRes = await fetch(`/api/marvel/issues/${id}`);
        if (!issueRes.ok) {
          throw new Error('Failed to load Marvel issue metadata');
        }

        const issue = await issueRes.json() as MarvelIssue;
        setMarvelIssue(issue);

        const seriesRes = await fetch(`/api/marvel/series/${issue.seriesId}/issues`);
        const seriesData = seriesRes.ok ? await seriesRes.json() : null;
        const seriesIssues = Array.isArray(seriesData?.items) ? seriesData.items as MarvelSeriesIssue[] : [];
        setMarvelSeriesIssues(seriesIssues);

        const issueCreators = issue.creators || [];
        const writer = issueCreators.find((creator) => creator.role === 'writer') || issueCreators[0];

        setComic({
          id: String(issue.id),
          title: issue.title,
          description: issue.description || 'Marvel metadata only.',
          coverUrl: issue.cover
            ? `${issue.cover.path.replace(/^http:\/\//, 'https://')}.${issue.cover.extension}`
            : '/logo.png',
          bannerUrl: issue.cover
            ? `${issue.cover.path.replace(/^http:\/\//, 'https://')}.${issue.cover.extension}`
            : undefined,
          rating: issue.pageCount ? `${issue.pageCount} pages` : 'Marvel Metadata',
          genres: [issue.seriesName, 'Marvel Comics', 'Issue Metadata'].filter(Boolean) as string[],
          status: 'Metadata',
          year: issue.yearPage ? String(issue.yearPage) : issue.onSaleDate?.slice(0, 4),
          author: writer?.name || 'Marvel',
          source: 'marvel',
        });
      } else if (source === 'mangadex') {
        const res = await fetch(`https://api.mangadex.org/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`);
        const data = await res.json();
        const manga = data.data;
        
        const coverFileName = manga.relationships.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
        const author = manga.relationships.find((r: any) => r.type === 'author')?.attributes?.name;
        const aniListId = manga.attributes.links?.al;
        const title = resolveMangaDexLocalizedText(manga.attributes.title, mangaLanguage);
        const description = resolveMangaDexLocalizedText(manga.attributes.description, mangaLanguage);
        const genres = manga.attributes.tags.map((t: any) =>
          resolveMangaDexLocalizedText(t.attributes.name, mangaLanguage)
        ).filter(Boolean);

        let details: ComicDetails = {
          id: manga.id,
          title: title || Object.values(manga.attributes.title || {})[0] as string,
          description: description || "No description available.",
          coverUrl: coverFileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.512.jpg` : '/logo.png',
          rating: manga.attributes.contentRating,
          genres: genres.length > 0 ? genres : manga.attributes.tags.map((t: any) => t.attributes.name.en),
          status: manga.attributes.status,
          year: manga.attributes.year,
          author: author,
          source: 'mangadex',
          aniListId: aniListId
        };

        const tags = manga.attributes.tags.map((t: any) =>
          resolveMangaDexLocalizedText(t.attributes.name, mangaLanguage).toLowerCase()
        );
        if (tags.includes('long strip') || tags.includes('webtoon')) {
          setIsLongStrip(true);
        }

        // Fetch Chapters Feed
        const translatedLanguages = getMangaDexTranslatedLanguages(mangaLanguage);
        const feedParams = new URLSearchParams();
        feedParams.set('limit', '100');
        feedParams.set('order[chapter]', 'asc');
        feedParams.append('contentRating[]', 'safe');
        feedParams.append('contentRating[]', 'suggestive');
        feedParams.append('contentRating[]', 'erotica');
        feedParams.append('contentRating[]', 'pornographic');
        translatedLanguages?.forEach((language) => feedParams.append('translatedLanguage[]', language));

        let feedRes = await fetch(`https://api.mangadex.org/manga/${id}/feed?${feedParams.toString()}`);
        let feedData = await feedRes.json();
        if ((!feedData.data || feedData.data.length === 0) && mangaLanguage === DEFAULT_MANGA_LANGUAGE) {
          feedRes = await fetch(`https://api.mangadex.org/manga/${id}/feed?limit=100&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`);
          feedData = await feedRes.json();
        }
        const chList = feedData.data?.map((ch: any) => ({
          id: ch.id,
          title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
          chapterNum: ch.attributes.chapter,
          volume: ch.attributes.volume
        })) || [];
        setChapters(chList);

        if (aniListId) {
          try {
            const alRes = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                query: `query ($id: Int) { Media (id: $id, type: MANGA) { bannerImage averageScore } }`,
                variables: { id: parseInt(aniListId) }
              })
            });
            if (alRes.ok) {
              const alData = await alRes.json();
              if (alData.data.Media) {
                details.bannerUrl = alData.data.Media.bannerImage;
                if (alData.data.Media.averageScore) details.rating = `${alData.data.Media.averageScore / 10}`;
              }
            }
          } catch (e) {}
        }
        setComic(details);
      } else if (source === 'nhentai') {
        const res = await fetch(`/api/proxy/nhentai?path=${encodeURIComponent(`galleries/${id}`)}`);
        if (!res.ok) throw new Error("Failed to fetch nhentai");
        const data = await res.json();
        
        setComic({
          id: data.id.toString(),
          title: data.english_title || data.title?.english || data.title?.japanese || data.title?.pretty || "Untitled",
          description: data.tags?.map((t: any) => t.name).join(', ') || "",
          coverUrl: `https://t3.nhentai.net/${data.cover?.path || data.thumbnail?.path || data.thumbnail}`,
          rating: 'pornographic',
          genres: data.tags?.filter((t: any) => t.type === 'tag').map((t: any) => t.name) || [],
          status: 'Completed',
          author: data.tags?.find((t: any) => t.type === 'artist')?.name || 'Unknown',
          source: 'nhentai'
        });
        setChapters([{ id: data.id.toString(), title: 'Full Gallery', chapterNum: '1' }]);
        if (!isAgeVerified) {
          setShowAgeGate(true);
        }
      } else {
        const res = await fetch(`https://archive.org/metadata/${id}`);
        const data = await res.json();
        const meta = data.metadata;
        setComic({
          id: id as string,
          title: meta.title || id as string,
          description: meta.description || "No description available.",
          coverUrl: `https://archive.org/services/img/${id}`,
          bannerUrl: `https://archive.org/services/img/${id}`,
          rating: "N/A",
          genres: meta.subject ? (Array.isArray(meta.subject) ? meta.subject : [meta.subject]) : ['Classic'],
          status: 'Completed',
          year: meta.date,
          author: meta.creator || 'Unknown',
          source: 'archive'
        });

        // Smart Chapter Detection for Archive.org
        const bookFiles = data.files?.filter((f: any) => 
          f.format === "Image Container PDF" || 
          f.format === "PDF" || 
          f.format === "EPUB" || 
          f.format === "Comic Book Archive"
        ) || [];

        if (bookFiles.length > 1) {
          const chList = bookFiles.map((f: any, i: number) => ({
            id: f.name, // Store filename
            title: f.title || f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            chapterNum: (i + 1).toString()
          }));
          setChapters(chList);
        } else {
          setChapters([{ id: id as string, title: 'Complete Volume', chapterNum: '1' }]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (comic && isAdultComic(comic) && !isAgeVerified) {
      setShowAgeGate(true);
    }
  }, [comic, isAgeVerified]);

  const handleAgeVerify = () => {
    persistAgeVerification();
    setIsAgeVerified(true);
    setShowAgeGate(false);
  };

  const loadChapterPages = async (idx: number) => {
    if (!chapters[idx]) return;
    setReaderLoading(true);
    setCurrentPage(0);
    setScrolled(false);
    setScrollProgress(0);
    try {
      if (source === 'mangadex') {
        const res = await fetch(`https://api.mangadex.org/at-home/server/${chapters[idx].id}`);
        const data = await res.json();
        const urls = data.chapter.data.map((n: string) => `${data.baseUrl}/data/${data.chapter.hash}/${n}`);
        setPages(urls);
        // Preload first 3 pages
        urls.slice(0, 3).forEach((u: string) => { const img = new Image(); img.src = u; });
      } else if (source === 'nhentai') {
        const res = await fetch(`/api/proxy/nhentai?path=${encodeURIComponent(`galleries/${id}`)}`);
        if (!res.ok) throw new Error("Failed to fetch nhentai gallery");
        const data = await res.json();
        const nhPages = data.pages.map((p: any) => {
           return `https://i.nhentai.net/${p.path}`;
        });
        setPages(nhPages);
      } else {
        const res = await fetch(`https://archive.org/metadata/${id}`);
        const data = await res.json();
        let archivePages = [];
        
        const ch = chapters[idx];
        const isSubFile = ch.id !== id;
        
        // Find the most reliable page count
        let jp2File;
        if (isSubFile) {
          // If it's a sub-file, we need to find its related jp2.zip or just use metadata
          const baseName = ch.id.replace(/\.[^/.]+$/, "");
          jp2File = data.files?.find((f: any) => f.name.includes(baseName) && f.format === "Single Page Processed JP2 ZIP");
        } else {
          jp2File = data.files?.find((f: any) => f.format === "Single Page Processed JP2 ZIP");
        }

        let count = parseInt(jp2File?.filecount || data.metadata?.page_count || "1");
        
        if (count <= 1) {
          // Fallback to searching the file list for the specific file's page count if available
          const targetFile = data.files?.find((f: any) => f.name === ch.id);
          count = parseInt(targetFile?.page_count || targetFile?.filecount || data.metadata?.page_count || "60");
        }

        count = Math.min(count, 1500);
        for(let i=0; i<count; i++) {
          const url = isSubFile 
            ? `https://archive.org/services/img/${id}/${i}?scale=8&fullsize=1&file=${encodeURIComponent(ch.id)}`
            : `https://archive.org/services/img/${id}/${i}?scale=8&fullsize=1`;
          archivePages.push(url);
        }
        setPages(archivePages);
      }
    } catch (e) {
      alert("Error loading chapter.");
    } finally {
      setReaderLoading(false);
      canvasRef.current?.scrollTo(0,0);
    }
  };

  const startReading = () => {
    setReading(true);
    if (isLongStrip) setViewMode('flow');
    else setViewMode('classic');
    loadChapterPages(0);
  };

  const nextChapter = () => {
    if (currentChapterIdx < chapters.length - 1) {
      const next = currentChapterIdx + 1;
      setCurrentChapterIdx(next);
      loadChapterPages(next);
    }
  };

  const prevChapter = () => {
    if (currentChapterIdx > 0) {
      const prev = currentChapterIdx - 1;
      setCurrentChapterIdx(prev);
      loadChapterPages(prev);
    }
  };

  const handleNextPage = () => {
    const step = (viewMode === 'journal' && !(isSpreadCover && currentPage === 0)) ? 2 : 1;
    if (currentPage < pages.length - step) {
      setCurrentPage(p => p + step);
      canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      nextChapter();
    }
  };

  const handlePrevPage = () => {
    const step = (viewMode === 'journal' && !(isSpreadCover && currentPage <= 1)) ? 2 : 1;
    if (currentPage > 0) {
      setCurrentPage(p => Math.max(0, p - step));
      canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      prevChapter();
    }
  };

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
  }, [reading, currentPage, pages.length, viewMode, currentChapterIdx, isSpreadCover]);

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
        <div className="fixed inset-0 z-0 h-[65vh]">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/85 to-[#050505] z-10" />
          <img
            src={comic.bannerUrl || comic.coverUrl}
            className="w-full h-full object-cover opacity-20 grayscale blur-3xl scale-110"
            alt=""
          />
        </div>

        <main className="relative z-10 pt-28 pb-24 px-6 md:px-20 max-w-7xl mx-auto">
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
              className="sticky top-28 space-y-6"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-[0_40px_120px_rgba(0,0,0,0.85)]">
                <img
                  src={comic.coverUrl}
                  className="w-full h-full object-cover"
                  alt={comic.title}
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

                <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter leading-[0.88]">
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

      <main className="relative z-10 pt-24 pb-24 px-6 md:px-20 max-w-7xl mx-auto">
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => router.back()} className="mb-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-[#ff4d00] transition-all group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Neural_Backtrack
        </motion.button>

        <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] backdrop-blur-xl shadow-[0_40px_140px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-16 lg:gap-24 items-start p-6 md:p-10 lg:p-12">
          {/* Side Info */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="space-y-10 sticky top-32">
            <div className="group relative aspect-[2/3] w-full bg-[#0a0a0a] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
               <img src={comic.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={comic.title} />
               <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-[#ff4d00] text-white text-[9px] font-black uppercase italic shadow-lg">HQ_Asset</div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
               <button onClick={startReading} className="group relative py-6 bg-white text-black flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] overflow-hidden transition-all hover:bg-[#ff4d00] hover:text-white">
                 <div className="absolute left-0 top-0 bottom-0 w-0 bg-black group-hover:w-full transition-all duration-500 z-0 opacity-10" />
                 <span className="relative z-10 flex items-center gap-3"><Play fill="currentColor" size={16} /> Initial_Reading_Sequence</span>
               </button>
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

            {/* Chapters */}
            <div className="space-y-8">
               <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-white/40">Synchronized_Chapters</h3>
                  <span className="text-[10px] font-black text-[#ff4d00] uppercase tracking-widest">{chapters.length} FOUND</span>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-4">
                  {chapters.map((ch, i) => (
                    <button key={ch.id} onClick={() => { setCurrentChapterIdx(i); setReading(true); loadChapterPages(i); }} className="group flex items-center justify-between p-5 bg-white/5 border border-white/5 hover:border-[#ff4d00]/50 transition-all text-left">
                       <div className="space-y-1">
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#ff4d00]">Vol.{ch.volume || '0'} Ch.{ch.chapterNum}</div>
                          <div className="text-[13px] font-black uppercase tracking-tight group-hover:text-[#ff4d00] transition-colors break-words line-clamp-2">{ch.title}</div>
                       </div>
                       <ChevronRight size={20} className="text-white/20 group-hover:text-[#ff4d00] group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
               </div>
            </div>
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
            onClick={(e) => {
              // Only toggle if clicking the background/canvas, not buttons
              if (e.target === e.currentTarget || (e.target as HTMLElement).closest('#reader-canvas')) {
                setUiVisible(!uiVisible);
              }
            }}
            className="fixed inset-0 z-[10000] bg-black flex flex-col overflow-hidden select-none"
          >
            
            {/* Minimal Top Header */}
            <motion.div animate={{ y: uiVisible ? 0 : -100 }} transition={{ type: 'spring', damping: 25 }} className="fixed top-0 left-0 right-0 z-[10020] h-20 bg-gradient-to-b from-black via-black/80 to-transparent px-8 flex items-center justify-between pointer-events-auto">
               <div className="flex items-center gap-6">
                  <button onClick={() => setReading(false)} className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-red-600 transition-colors"><X size={20}/></button>
                  <div className="hidden sm:block space-y-0.5">
                     <div className="text-[8px] font-black uppercase tracking-[0.4em] text-[#ff4d00]">Active_Matrix</div>
                     <div className="text-[11px] font-black uppercase tracking-tight max-w-[300px] truncate">{comic.title}</div>
                  </div>
               </div>

               {/* View Mode Controls (Responsive) */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-white/5 border border-white/10 rounded-full p-1 shadow-2xl backdrop-blur-xl">
                  {!isLongStrip && (
                    <button onClick={() => setViewMode('classic')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${viewMode === 'classic' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>
                      <Monitor size={14} className="hidden sm:block"/>
                      <Smartphone size={14} className="sm:hidden"/>
                      Classic
                    </button>
                  )}
                  {!isLongStrip && !isMobile && (
                    <button onClick={() => setViewMode('journal')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${viewMode === 'journal' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>
                      <Columns size={14}/> Journal
                    </button>
                  )}
                  <button onClick={() => setViewMode('flow')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${viewMode === 'flow' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>
                    <Smartphone size={14}/> Flow
                  </button>
                </div>

                <div className="flex items-center gap-3">
                   <button onClick={() => setShowGrid(true)} className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded-md" title="Page Overview"><List size={16}/></button>
                   <div className="text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-4 h-10 flex items-center hidden md:flex">
                      CH_{chapters[currentChapterIdx]?.chapterNum} <span className="text-white/20 ml-3">P_{currentPage + 1}/{pages.length}</span>
                   </div>
                   <button onClick={() => { if (!document.fullscreenElement) readerRef.current?.requestFullscreen(); else document.exitFullscreen(); }} className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded-md"><Maximize2 size={16}/></button>
                </div>
             </motion.div>


            {/* Reader Canvas */}
            <div ref={canvasRef} className="flex-1 w-full bg-[#020202] overflow-y-auto custom-scrollbar relative scroll-smooth" id="reader-canvas">
               {/* Scroll Hint */}
               <AnimatePresence>
                 {!scrolled && !readerLoading && pages.length > 0 && viewMode === 'flow' && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10015] flex flex-col items-center gap-2 pointer-events-none">
                      <div className="text-[8px] font-black uppercase tracking-[0.4em] text-white/30">Initiate_Scroll</div>
                      <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}><ChevronDown className="text-[#ff4d00]" size={20}/></motion.div>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Carousel-Style Nav Buttons (Interactive Areas) */}
               {viewMode !== 'flow' && (
                 <>
                   {/* Left Hover Area */}
                   <div 
                     className="fixed inset-y-0 left-0 w-[15%] md:w-[20%] z-[10015] group/nav cursor-pointer" 
                     onClick={handlePrevPage}
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
                     className="fixed inset-y-0 right-0 w-[15%] md:w-[20%] z-[10015] group/nav cursor-pointer" 
                     onClick={handleNextPage}
                   >
                      <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-0 group-hover/nav:opacity-100 transition-all duration-300 transform translate-x-4 group-hover/nav:translate-x-0 text-right hidden md:block">
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-[#ff4d00] hover:scale-110 transition-all shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                           <ChevronRight size={32} className="text-white" />
                        </div>
                      </div>
                      <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-black/40 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity pointer-events-none" />
                   </div>
                 </>
               )}

               {readerLoading ? (
                 <div className="h-full flex flex-col items-center justify-center gap-8">
                    <Loader2 className="w-16 h-16 text-[#ff4d00] animate-spin" />
                    <div className="text-[12px] font-black uppercase tracking-[0.8em] text-white/20 animate-pulse">Syncing_Assets...</div>
                 </div>
               ) : pages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center gap-6">
                    <Sparkles className="w-12 h-12 text-white/10" />
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/20">Empty_Chapter_Buffer</div>
                 </div>
               ) : (
                  <div className={`mx-auto flex flex-col items-center transition-all duration-500 ${viewMode === 'flow' ? 'w-full pt-32 pb-20' : 'min-h-full justify-center pt-20 pb-20'}`}>
                    
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
                                <img 
                                  src={pages[0]} 
                                  className="max-h-[90vh] w-auto shadow-2xl border border-white/10 rounded-sm" 
                                  alt="cover" 
                                />
                              </motion.div>
                            ) : (
                              <div className="flex items-center justify-center w-full gap-0">
                                <motion.img 
                                  key={currentPage} 
                                  initial={{ opacity: 0, x: 20 }} 
                                  animate={{ opacity: 1, x: 0 }} 
                                  src={pages[currentPage]} 
                                  style={{ width: pages[currentPage+1] ? '50%' : 'auto', maxWidth: pages[currentPage+1] ? '45vw' : '80vw', height: 'auto', maxHeight: '90vh' }} 
                                  className={`object-contain ${pages[currentPage+1] ? 'border-r border-white/5 shadow-2xl rounded-l-sm' : 'shadow-2xl border border-white/10 rounded-sm'}`} 
                                />
                                {pages[currentPage + 1] && (
                                  <motion.img 
                                    key={currentPage+1} 
                                    initial={{ opacity: 0, x: -20 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    src={pages[currentPage+1]} 
                                    style={{ width: '50%', maxWidth: '45vw', height: 'auto', maxHeight: '90vh' }} 
                                    className="object-contain shadow-2xl rounded-r-sm" 
                                  />
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
                          {pages.map((p, i) => <img key={i} id={`page-${i}`} src={p + (source === 'archive' ? '?scale=2' : '')} className="w-full h-auto" loading="lazy" />)}
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

            {/* Bottom Status Bar */}
            <motion.div animate={{ y: uiVisible ? 0 : 100 }} transition={{ type: 'spring', damping: 25 }} className="fixed bottom-0 left-0 right-0 z-[10020] h-20 bg-gradient-to-t from-black via-black/90 to-transparent px-10 flex items-center justify-between backdrop-blur-sm">
                <div className="flex items-center gap-8">
                   <div className="flex items-center gap-4">
                      <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"><ZoomOut size={16}/></button>
                      <div className="text-[9px] font-black text-white/40 w-12 text-center uppercase tracking-tighter">{Math.round(zoom * 100)}%</div>
                      <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"><ZoomIn size={16}/></button>
                   </div>
                   <div className="h-4 w-px bg-white/10 hidden sm:block" />
                   {viewMode === 'journal' && (
                      <button 
                        onClick={() => setIsSpreadCover(!isSpreadCover)} 
                        className={`px-4 py-2 border border-white/10 text-[8px] font-black uppercase tracking-widest transition-all ${isSpreadCover ? 'bg-white text-black' : 'text-white/40'}`}
                      >
                        Cover_Offset: {isSpreadCover ? 'ON' : 'OFF'}
                      </button>
                   )}
                   {viewMode === 'flow' && (
                      <button onClick={() => canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"><ChevronUp size={16}/></button>
                   )}
                </div>

                 {/* Intelligent Progress Scrubber */}
                 <div className="flex-1 max-w-2xl mx-10 sm:mx-20 relative flex items-center">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/20 uppercase tracking-[0.3em] whitespace-nowrap">
                       {viewMode === 'flow' ? 'Reading_Progress' : `Page_Sequence_${currentPage + 1}_of_${pages.length}`}
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
                      className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-[#ff4d00] rounded-full hover:bg-white/20 transition-all"
                    />
                 </div>

                <div className="flex items-center gap-6">
                   <button onClick={prevChapter} className="hidden sm:block px-6 py-2 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 disabled:opacity-10 transition-all" disabled={currentChapterIdx === 0}>Prev_Chapter</button>
                   <button onClick={nextChapter} className="px-6 py-2 bg-[#ff4d00] text-white text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black disabled:opacity-10 transition-all" disabled={currentChapterIdx === chapters.length - 1}>Next_Chapter</button>
                </div>
            </motion.div>
 
             {/* Page Grid Overview Overlay */}
             <AnimatePresence>
               {showGrid && (
                 <motion.div 
                   initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                   animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
                   exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                   className="fixed inset-0 z-[10050] bg-black/90 overflow-y-auto custom-scrollbar p-8 md:p-16"
                 >
                    {/* Grid Header */}
                    <div className="fixed top-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-md z-[10060] px-8 flex items-center justify-between border-b border-white/5">
                       <button onClick={() => setShowGrid(false)} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">
                          <ChevronLeft size={16} /> BACK_TO_READER
                       </button>
                       <div className="text-[11px] font-black uppercase tracking-[0.4em] text-white/60 text-center flex-1 hidden sm:block">
                          {comic.title} <span className="text-[#ff4d00]">/ OVERVIEW</span>
                       </div>
                       <button onClick={() => setShowGrid(false)} className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-red-600 transition-colors"><X size={20}/></button>
                    </div>

                    <div className="mt-24 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8 max-w-7xl mx-auto">
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
                            <img src={p} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" loading="lazy" />
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
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #ff4d00;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(255, 77, 0, 0.5);
        }
      `}</style>
    </div>
  );
}
