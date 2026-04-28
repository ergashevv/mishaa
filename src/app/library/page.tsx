"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Search, X, ChevronLeft, ChevronRight, 
  Loader2, Maximize2, Minimize2, List, Eye, EyeOff, AlertTriangle,
  ZoomIn, ZoomOut, Columns, FileText, Sparkles, TrendingUp, Clock, Star, Shuffle, Globe, Flag
} from 'lucide-react';

interface Comic {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  rating: string;
  source: 'mangadex' | 'archive';
}

const CATEGORIES = [
  { label: 'Marvel Universe', query: 'subject:("Marvel Comics") AND language:(eng) AND NOT collection:printdisabled', source: 'archive' },
  { label: 'DC Universe', query: 'subject:("DC Comics") AND language:(eng) AND NOT collection:printdisabled', source: 'archive' },
  { label: 'Classic Comics', query: 'collection:(comic_books_archive OR digitalcomicmuseum) AND NOT collection:printdisabled', source: 'archive' },
  { label: 'Graphic Novels', query: 'subject:(graphic novels) AND language:(eng) AND NOT collection:printdisabled', source: 'archive' },
  { label: 'Manga Hub', query: '', source: 'mangadex' },
  { label: 'Webtoons', query: 'webtoon', source: 'mangadex' },
  { label: 'Manhwa', query: 'manhwa', source: 'mangadex' },
  { label: 'Hentai', query: '', nsfw: true, source: 'mangadex', ratings: ['pornographic'] },
  { label: 'Erotica', query: '', nsfw: true, source: 'mangadex', ratings: ['erotica'] },
];

const LIMIT = 36;

export default function ComicLibrary() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reading, setReading] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'webtoon' | 'double'>('single');
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Marvel Universe');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [zoom, setZoom] = useState(1);
  
  const router = useRouter();
  const readerRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  // Initialize age verification from localStorage
  useEffect(() => {
    const verified = localStorage.getItem('age_verified') === 'true';
    setIsAgeVerified(verified);
    if (verified) setNsfwEnabled(true);
  }, []);

  const handleAgeVerify = () => {
    localStorage.setItem('age_verified', 'true');
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
  const fetchMangaDex = async (query: string, currentOffset: number, ratingsOverride?: string[]) => {
    try {
      const defaultRatings = nsfwEnabled ? ['safe', 'suggestive', 'erotica', 'pornographic'] : ['safe', 'suggestive'];
      const ratings = ratingsOverride || defaultRatings;
      const ratingParams = ratings.map(r => `contentRating[]=${r}`).join('&');
      // Added order by relevance if query exists, else followedCount
      const orderParam = query ? 'order[relevance]=desc' : 'order[followedCount]=desc';
      const url = `https://api.mangadex.org/manga?limit=${LIMIT}&offset=${currentOffset * LIMIT}&includes[]=cover_art&${ratingParams}&availableTranslatedLanguage[]=en&title=${query}&${orderParam}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.data) return [];
      return data.data.map((item: any) => {
        const coverFileName = item.relationships.find((r: any) => r.type === 'cover_art')?.attributes?.fileName;
        return {
          id: item.id,
          title: item.attributes.title.en || Object.values(item.attributes.title)[0],
          coverUrl: coverFileName ? `https://uploads.mangadex.org/covers/${item.id}/${coverFileName}.512.jpg` : '/logo.png',
          source: 'mangadex',
          rating: item.attributes.contentRating
        };
      });
    } catch (e) { return []; }
  };

  // Fetch from Archive.org
  const fetchArchive = async (query: string, page: number) => {
    try {
      let searchFilter = `(${query})`;
      if (!query.includes('collection:') && !query.includes('subject:')) {
        searchFilter = `(${query}) AND (collection:comic_books_archive OR collection:digitalcomicmuseum OR subject:"Comic Books")`;
      }
      
      const url = `https://archive.org/advancedsearch.php?q=${searchFilter}+AND+mediatype:texts&fl[]=identifier,title,description&rows=${LIMIT}&page=${page + 1}&output=json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      
      if (!data.response || !data.response.docs) return [];

      return data.response.docs.map((item: any) => ({
        id: item.identifier,
        title: item.title,
        coverUrl: `https://archive.org/services/img/${item.identifier}`,
        source: 'archive'
      }));
    } catch (e) { return []; }
  };

  const loadData = async (append: boolean = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const cat = CATEGORIES.find(c => c.label === activeCategory);
      const query = searchQuery;
      
      let results: Comic[] = [];

      if (query) {
        // Global search: search both sources
        const [mdResults, arcResults] = await Promise.all([
          fetchMangaDex(query, offset),
          fetchArchive(query, offset)
        ]);
        
        results = [...mdResults, ...arcResults].sort((a, b) => a.title.localeCompare(b.title));
      } else {
        const source = cat?.source || 'mangadex';
        const catQuery = cat?.query || '';
        
        if (source === 'mangadex') {
          results = await fetchMangaDex(catQuery, offset, cat?.ratings);
        } else {
          results = await fetchArchive(catQuery, offset);
        }
      }

      if (results.length < LIMIT) setHasMore(false);
      setComics(prev => append ? [...prev, ...results] : results);
    } catch (e) { 
      console.error(e); 
      if (!append) setComics([]);
    } finally { 
      setLoading(false); 
      setLoadingMore(false); 
    }
  };

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    loadData(false);
  }, [activeCategory, searchQuery, nsfwEnabled]);

  useEffect(() => {
    if (offset > 0) loadData(true);
  }, [offset]);

  const fetchPages = async (comic: Comic) => {
    // Check for adult content age gate
    if ((comic.rating === 'erotica' || comic.rating === 'pornographic') && !isAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    setReading(true);
    setPages([]);
    try {
      if (comic.source === 'mangadex') {
        // Try English first
        let feedRes = await fetch(`https://api.mangadex.org/manga/${comic.id}/feed?translatedLanguage[]=en&limit=5&order[chapter]=asc`);
        let feedData = await feedRes.json();
        
        // Fallback to any language if English is not available
        if (!feedData.data || feedData.data.length === 0) {
          feedRes = await fetch(`https://api.mangadex.org/manga/${comic.id}/feed?limit=5&order[chapter]=asc`);
          feedData = await feedRes.json();
        }

        if (!feedData.data || feedData.data.length === 0) throw new Error("No readable chapters found on MangaDex");
        
        const chId = feedData.data[0].id;
        const srvRes = await fetch(`https://api.mangadex.org/at-home/server/${chId}`);
        const srvData = await srvRes.json();
        
        if (!srvData.chapter || !srvData.chapter.data) throw new Error("Chapter data is unavailable");
        
        setPages(srvData.chapter.data.map((n: string) => `${srvData.baseUrl}/data/${srvData.chapter.hash}/${n}`));
      } else {
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
               archivePages.push(`https://archive.org/services/img/${comic.id}/${i}`);
            }
          }
        }

        if (archivePages.length === 0) throw new Error("No readable pages found");
        setPages(archivePages);
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
          <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
             <div className="max-w-md w-full bg-[#0a0a0a] border border-red-900/40 p-12 text-center shadow-[0_0_100px_rgba(255,0,0,0.1)]">
                <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-6" />
                <h2 className="text-4xl font-black italic uppercase mb-2 tracking-tighter">RESTRICTED</h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-8">This content is for adults only (18+)</p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleAgeVerify} className="w-full py-5 bg-red-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors">I AM 18 OR OLDER</button>
                  <button onClick={() => setShowAgeGate(false)} className="w-full py-5 bg-white/5 text-white/40 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors">GO BACK</button>
                </div>
             </div>
          </div>
        )}
      </AnimatePresence>

      {!selectedComic && (
        <div className="p-8 md:p-16">
          <header className="max-w-7xl mx-auto mb-20 space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-end gap-10">
              <div>
                <h1 className="text-8xl md:text-[120px] font-black italic tracking-tighter uppercase leading-[0.7]">
                   COMIC<span className="text-[#ff4d00]">.</span>HUB
                </h1>
                <div className="flex items-center gap-6 mt-10">
                   <div className="h-[2px] w-16 bg-[#ff4d00]" />
                   <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.4em] text-white/30">
                      <Sparkles size={12} className="text-[#ff4d00]" /> Global_Library_Active
                   </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full md:w-auto">
                 <div className="flex items-center gap-2">
                    <div className="relative flex-1 md:w-96">
                       <input type="text" placeholder="SEARCH_GLOBAL_ARCHIVES..." className="w-full bg-white/5 border border-white/10 py-5 px-12 text-[11px] font-black uppercase focus:border-[#ff4d00] transition-all outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    </div>
                    <button onClick={() => { if (!isAgeVerified) { setShowAgeGate(true); } else { setNsfwEnabled(!nsfwEnabled); } }} className={`w-16 h-16 flex items-center justify-center border transition-all ${nsfwEnabled ? 'bg-red-600 border-red-600' : 'border-white/10 text-white/20'}`}>
                      {nsfwEnabled ? <Eye /> : <EyeOff />}
                    </button>
                 </div>
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
                  onClick={() => router.push(`/library/${comic.source}/${comic.id}`)} 
                  className="relative group cursor-pointer"
                >
                  <div className="aspect-[2/3] border border-white/5 bg-[#0a0a0a] overflow-hidden relative shadow-[0_40px_80px_rgba(0,0,0,0.8)]">
                    <img src={comic.coverUrl} className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt={comic.title} />
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent flex items-center justify-between">
                       <span className="text-[7px] font-black uppercase tracking-widest text-[#ff4d00]">{comic.source}</span>
                       {(comic.rating === 'erotica' || comic.rating === 'pornographic') && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[6px] font-black uppercase">18+</span>}
                    </div>
                  </div>
                  <h3 className="mt-6 text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:text-white leading-relaxed line-clamp-2">{comic.title}</h3>
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
