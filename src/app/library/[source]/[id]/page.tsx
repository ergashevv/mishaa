"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Play, Info, Star, Clock, 
  Layers, Globe, BookOpen, Share2, 
  Bookmark, Heart, Download, X,
  ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronRight, Loader2, Sparkles, Flag,
  Settings, Columns, Smartphone, Monitor,
  ChevronDown, ChevronUp, Menu, MousePointer2
} from 'lucide-react';

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
  source: 'mangadex' | 'archive';
  aniListId?: string;
}

export default function ComicDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { source, id } = params;
  
  const [comic, setComic] = useState<ComicDetails | null>(null);
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
  
  const readerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check device type
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // UI Auto-hide logic
  const handleUserActivity = () => {
    setUiVisible(true);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    uiTimeoutRef.current = setTimeout(() => {
      if (reading) setUiVisible(false);
    }, 3000);
  };

  useEffect(() => {
    fetchComicDetails();
  }, [id, source]);

  // Handle Scroll for progress and indicators
  useEffect(() => {
    const handleScroll = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      if (canvas.scrollTop > 100) setScrolled(true);
      else setScrolled(false);

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
  }, [reading, viewMode]);

  const fetchComicDetails = async () => {
    setLoading(true);
    try {
      if (source === 'mangadex') {
        const res = await fetch(`https://api.mangadex.org/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`);
        const data = await res.json();
        const manga = data.data;
        
        const coverFileName = manga.relationships.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
        const author = manga.relationships.find((r: any) => r.type === 'author')?.attributes?.name;
        const aniListId = manga.attributes.links?.al;

        let details: ComicDetails = {
          id: manga.id,
          title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] as string,
          description: manga.attributes.description.en || "No description available.",
          coverUrl: coverFileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.512.jpg` : '/logo.png',
          rating: manga.attributes.contentRating,
          genres: manga.attributes.tags.map((t: any) => t.attributes.name.en),
          status: manga.attributes.status,
          year: manga.attributes.year,
          author: author,
          source: 'mangadex',
          aniListId: aniListId
        };

        const tags = manga.attributes.tags.map((t: any) => t.attributes.name.en.toLowerCase());
        if (tags.includes('long strip') || tags.includes('webtoon')) {
          setIsLongStrip(true);
        }

        // Fetch Chapters Feed
        const feedRes = await fetch(`https://api.mangadex.org/manga/${id}/feed?translatedLanguage[]=en&limit=100&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`);
        const feedData = await feedRes.json();
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
        setChapters([{ id: id as string, title: 'Complete Volume', chapterNum: '1' }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
      } else {
        const res = await fetch(`https://archive.org/metadata/${id}`);
        const data = await res.json();
        let archivePages = [];
        let count = parseInt(data.metadata?.page_count || "60");
        for(let i=0; i<count; i++) archivePages.push(`https://archive.org/services/img/${id}/${i}`);
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!reading) return;
      
      const step = viewMode === 'journal' ? 2 : 1;
      
      if (e.key === 'ArrowLeft') {
         if (currentPage > 0) {
           setCurrentPage(p => Math.max(0, p - step));
           canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
         } else prevChapter();
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
         if (currentPage < pages.length - step) {
           setCurrentPage(p => Math.min(pages.length - 1, p + step));
           canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
         } else nextChapter();
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
  }, [reading, currentPage, pages.length, viewMode, currentChapterIdx]);

  if (loading) return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="w-12 h-12 text-[#ff4d00] animate-spin" />
        <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Syncing_Neural_Matrix...</div>
      </div>
    </div>
  );

  if (!comic) return null;

  return (
    <div className="min-h-screen bg-[#020202] text-white overflow-x-hidden selection:bg-[#ff4d00] selection:text-white">
      {/* Immersive Backdrop */}
      <div className="fixed inset-0 z-0 h-[70vh]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020202]/90 to-[#020202] z-10" />
        <img src={comic.bannerUrl || comic.coverUrl} className="w-full h-full object-cover opacity-20 grayscale blur-3xl scale-110" alt="" />
      </div>

      <main className="relative z-10 pt-32 pb-32 px-6 md:px-20 max-w-7xl mx-auto">
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => router.back()} className="mb-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-[#ff4d00] transition-all group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Neural_Backtrack
        </motion.button>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-16 lg:gap-24 items-start">
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
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black italic uppercase tracking-tighter leading-none break-words max-w-full">
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
               <div 
                 className="text-xl md:text-2xl text-white/50 font-medium leading-relaxed max-w-3xl italic description-content"
                 dangerouslySetInnerHTML={{ 
                   __html: comic.description
                     .replace(/\[b\]/g, '<strong>').replace(/\[\/b\]/g, '</strong>')
                     .replace(/\[i\]/g, '<em>').replace(/\[\/i\]/g, '</em>')
                     .replace(/\n/g, '<br />')
                 }}
               />
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
                          <div className="text-[13px] font-black uppercase tracking-tight group-hover:text-[#ff4d00] transition-colors">{ch.title}</div>
                       </div>
                       <ChevronRight size={20} className="text-white/20 group-hover:text-[#ff4d00] group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
               </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* IDEAL PRO READER */}
      <AnimatePresence>
        {reading && (
          <motion.div ref={readerRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseMove={handleUserActivity} onTouchStart={handleUserActivity} className="fixed inset-0 z-[10000] bg-black flex flex-col overflow-hidden select-none">
            
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
                  {!isLongStrip && !isMobile && (
                    <>
                      <button onClick={() => setViewMode('classic')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${viewMode === 'classic' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}><Monitor size={14}/> Classic</button>
                      <button onClick={() => setViewMode('journal')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${viewMode === 'journal' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}><Columns size={14}/> Journal</button>
                    </>
                  )}
                  {isMobile && !isLongStrip && (
                     <button onClick={() => setViewMode('classic')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${viewMode === 'classic' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}><Smartphone size={14}/> Classic</button>
                  )}
                  <button onClick={() => setViewMode('flow')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${viewMode === 'flow' ? 'bg-[#ff4d00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}><Smartphone size={14}/> Flow</button>
                </div>

               <div className="flex items-center gap-4">
                  <div className="text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-4 py-2 hidden md:block">CH_{chapters[currentChapterIdx]?.chapterNum} <span className="text-white/20 ml-2">P_{currentPage + 1}/{pages.length}</span></div>
                  <button onClick={() => { if (!document.fullscreenElement) readerRef.current?.requestFullscreen(); else document.exitFullscreen(); }} className="w-12 h-12 flex items-center justify-center hover:bg-white/5 border border-white/10"><Maximize2 size={18}/></button>
               </div>
            </motion.div>

            {/* Reader Canvas */}
            <div ref={canvasRef} className="flex-1 w-full bg-[#020202] overflow-y-auto custom-scrollbar relative scroll-smooth" id="reader-canvas">
               {/* Scroll Hint */}
               <AnimatePresence>
                 {!scrolled && !readerLoading && pages.length > 0 && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10015] flex flex-col items-center gap-2 pointer-events-none">
                      <div className="text-[8px] font-black uppercase tracking-[0.4em] text-white/30">Initiate_Scroll</div>
                      <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}><ChevronDown className="text-[#ff4d00]" size={20}/></motion.div>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Carousel-Style Nav Buttons (Desktop) */}
               {viewMode !== 'flow' && !isMobile && (
                 <>
                   {/* Left Hover Area */}
                   <div 
                     className="fixed inset-y-0 left-0 w-[20%] z-[10015] group/nav cursor-pointer" 
                     onClick={() => { 
                       if (currentPage > 0) { 
                         setCurrentPage(p => Math.max(0, p - (viewMode === 'journal' ? 2 : 1))); 
                         canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' }); 
                       } else prevChapter(); 
                     }}
                   >
                      <div className="absolute top-1/2 left-8 -translate-y-1/2 opacity-0 group-hover/nav:opacity-100 transition-all duration-300 transform -translate-x-4 group-hover/nav:translate-x-0">
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-[#ff4d00] hover:scale-110 transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                           <ChevronLeft size={32} className="text-white" />
                        </div>
                      </div>
                      <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/20 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity pointer-events-none" />
                   </div>

                   {/* Right Hover Area */}
                   <div 
                     className="fixed inset-y-0 right-0 w-[20%] z-[10015] group/nav cursor-pointer" 
                     onClick={() => { 
                       const step = viewMode === 'journal' ? 2 : 1; 
                       if (currentPage < pages.length - step) { 
                         setCurrentPage(p => p + step); 
                         canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' }); 
                       } else nextChapter(); 
                     }}
                   >
                      <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-0 group-hover/nav:opacity-100 transition-all duration-300 transform translate-x-4 group-hover/nav:translate-x-0 text-right">
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-[#ff4d00] hover:scale-110 transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                           <ChevronRight size={32} className="text-white" />
                        </div>
                      </div>
                      <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-black/20 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity pointer-events-none" />
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
                  <div className={`mx-auto flex flex-col items-center transition-all duration-500 ${viewMode === 'flow' ? 'max-w-4xl pt-32 pb-20 px-4' : 'min-h-full pt-32 pb-40'}`}>
                    
                    {viewMode === 'classic' ? (
                       <motion.img 
                        key={currentPage} 
                        initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }} 
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} 
                        src={pages[currentPage]} 
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', maxWidth: isMobile ? '100%' : '1000px', width: '100%', height: 'auto' }} 
                        className="shadow-[0_0_150px_rgba(0,0,0,0.9)] border border-white/10" alt="" 
                       />
                    ) : viewMode === 'journal' ? (
                       <div className="flex items-start justify-center w-full max-w-[98vw] gap-0 transition-transform duration-300" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                          <motion.img 
                            key={currentPage} 
                            initial={{ opacity: 0, x: -20, filter: 'blur(5px)' }} 
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} 
                            src={pages[currentPage]} 
                            style={{ width: pages[currentPage+1] ? '50%' : 'auto', maxWidth: pages[currentPage+1] ? 'none' : '1000px', height: 'auto' }} 
                            className={`${pages[currentPage+1] ? 'border-r border-white/5 shadow-2xl' : 'shadow-2xl border border-white/10'}`} 
                          />
                          {pages[currentPage + 1] && (
                            <motion.img 
                              key={currentPage+1} 
                              initial={{ opacity: 0, x: 20, filter: 'blur(5px)' }} 
                              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} 
                              src={pages[currentPage+1]} 
                              style={{ width: '50%', height: 'auto' }} 
                              className="shadow-2xl" 
                            />
                          )}
                       </div>
                    ) : (
                       <div className="flex flex-col items-center gap-0 w-full transition-all duration-300" style={{ maxWidth: isMobile ? '100%' : `${zoom * 1000}px` }}>
                          {pages.map((p, i) => <img key={i} src={p} className="w-full h-auto" loading="lazy" />)}
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
                   <div className="hidden md:flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
                      <MousePointer2 size={14}/> ENGINE_STABLE
                   </div>
                </div>

                 {/* Intelligent Progress Scrubber */}
                 <div className="flex-1 max-w-2xl mx-10 sm:mx-20 relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/20 uppercase tracking-[0.3em] whitespace-nowrap">
                       {viewMode === 'flow' ? 'Scroll_Velocity' : `Page_Sequence_${currentPage + 1}_of_${pages.length}`}
                    </div>
                    <div className="relative h-1 bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         className="absolute h-full bg-[#ff4d00] transition-all duration-100" 
                         style={{ 
                           width: viewMode === 'flow' ? `${scrollProgress}%` : `${((currentPage + 1) / (pages.length || 1)) * 100}%` 
                         }} 
                       />
                    </div>
                 </div>

                <div className="flex items-center gap-6">
                   <button onClick={prevChapter} className="hidden sm:block px-6 py-2 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 disabled:opacity-10 transition-all" disabled={currentChapterIdx === 0}>Prev_Chapter</button>
                   <button onClick={nextChapter} className="px-6 py-2 bg-[#ff4d00] text-white text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black disabled:opacity-10 transition-all" disabled={currentChapterIdx === chapters.length - 1}>Next_Chapter</button>
                </div>
            </motion.div>

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
      `}</style>
    </div>
  );
}
