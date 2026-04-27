'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Layout, Archive, ArrowRight, Clock, Trash2, ExternalLink } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { translations, Lang } from '@/lib/translations';

interface GalleryStory {
  id: string;
  title?: string | null;
  createdAt: string;
  frames: Array<{ imageUrl?: string | null }>;
}

export default function Gallery() {
  const [stories, setStories] = useState<GalleryStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].gallery;

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (e: any) => setLang(e.detail as Lang);
    window.addEventListener('langChange', handleLang);

    async function fetchStories() {
      try {
        const res = await fetch('/api/stories');
        const data = await res.json() as GalleryStory[];
        setStories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch stories');
      } finally {
        setLoading(false);
      }
    }
    fetchStories();

    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  const deleteStory = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await fetch(`/api/stories?id=${id}`, { method: 'DELETE' });
      setStories(stories.filter(s => s.id !== id));
    } catch (err) {
      alert('Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf2] text-[#111111] selection:bg-[#ffca3a] selection:text-black overflow-x-hidden halftone-bg">
      <div className="noise-overlay" />
      <div className="paper-grain" />
      <Navbar />

      <main className="container mx-auto px-8 pt-48 pb-32">
         <div className="studio-panel p-16 md:p-24 mb-24 relative overflow-hidden bg-white">
            <div className="absolute inset-0 halftone-bg opacity-10" />
            <div className="relative z-10 flex flex-col md:flex-row items-end justify-between gap-12">
               <div className="space-y-6">
                  <div className="inline-block bg-[#e63946] px-4 py-1 border-2 border-black">
                    <span className="text-white text-[9px] font-black uppercase tracking-widest">{t.archiveHeadline}</span>
                  </div>
                  <h1 className="text-[6rem] md:text-[9rem] font-display uppercase tracking-tighter leading-none">{t.title}</h1>
                  <p className="text-black/60 text-xl font-editorial max-w-xl italic leading-relaxed border-l-4 border-black/10 pl-6">
                     {t.desc}
                  </p>
               </div>
               <Link href="/studio">
                  <button className="brutalist-button bg-[#ffca3a] text-black">
                    {t.newPub}
                  </button>
               </Link>
            </div>
         </div>

         {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-12">
               {Array.from({ length: 8 }).map((_, i) => (
                 <div key={i} className="aspect-[3/4] bg-black/5 border-2 border-black/10 animate-pulse" />
               ))}
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12 text-[#111111]">
               {stories.map((story, i) => (
                 <motion.div 
                   key={story.id}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.05 }}
                 >
                    <div className="comic-card p-6 bg-white group h-full flex flex-col">
                       <div className="aspect-[4/5] bg-[#f0f0f0] mb-8 overflow-hidden border-2 border-black grayscale group-hover:grayscale-0 transition-all duration-500">
                          {story.frames[0]?.imageUrl ? (
                            <img src={story.frames[0].imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-10">
                              <Layout size={64} strokeWidth={1} />
                            </div>
                          )}
                       </div>

                       <div className="space-y-6 mt-auto">
                          <div className="flex justify-between items-start gap-4">
                             <h3 className="text-2xl font-display uppercase tracking-tight group-hover:text-[#e63946] transition-colors line-clamp-2">{story.title || t.untitled}</h3>
                             <span className="shrink-0 w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-black text-[10px]">
                               {String(i+1).padStart(2, '0')}
                             </span>
                          </div>
                          
                          <div className="flex items-center gap-6 pt-4 border-t-2 border-black/5">
                             <div className="flex items-center gap-2 text-black/40 text-[9px] font-black uppercase tracking-widest">
                                <Clock size={10} /> {new Date(story.createdAt).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : (lang === 'ru' ? 'ru-RU' : 'en-US'))}
                             </div>
                             <div className="w-2 h-[2px] bg-black/10" />
                             <div className="text-[#3b82f6] text-[9px] font-black uppercase tracking-widest">
                                {story.frames.length} {t.pieces}
                             </div>
                          </div>

                          <div className="flex gap-2 pt-4">
                             <Link href={`/story/${story.id}`} className="flex-1">
                                <button className="w-full py-4 border-2 border-black text-black font-black uppercase text-[9px] tracking-widest hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_#000] active:shadow-none active:translate-x-1 active:translate-y-1">{t.open}</button>
                             </Link>
                             <button 
                               onClick={() => deleteStory(story.id)}
                               className="px-4 border-2 border-black hover:bg-red-500 hover:text-white transition-all"
                             >
                                <Trash2 size={12} />
                             </button>
                          </div>
                       </div>
                    </div>
                 </motion.div>
               ))}
               {stories.length === 0 && (
                 <div className="col-span-full py-40 text-center border-4 border-black border-dashed bg-white halftone-bg">
                    <p className="text-black/40 text-sm font-black uppercase tracking-[0.5em]">{t.empty}</p>
                 </div>
               )}
            </div>
         )}
      </main>
    </div>
  );
}
