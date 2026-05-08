'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Layout, Clock, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

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
    const savedLang = readStorageItem('lang') as Lang;
    const timer = savedLang && translations[savedLang]
      ? window.setTimeout(() => setLang((current) => (savedLang !== current ? savedLang : current)), 0)
      : undefined;

    const handleLang = (event: Event) => {
      setLang((event as CustomEvent<Lang>).detail);
    };
    window.addEventListener('langChange', handleLang);

    async function fetchStories() {
      try {
        const res = await fetch('/api/stories');
        const data = await res.json() as GalleryStory[];
        setStories(Array.isArray(data) ? data : []);
      } catch {
        console.error('Failed to fetch stories');
      } finally {
        setLoading(false);
      }
    }
    fetchStories();

    return () => {
      window.removeEventListener('langChange', handleLang);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const deleteStory = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await fetch(`/api/stories?id=${id}`, { method: 'DELETE' });
      setStories(stories.filter(s => s.id !== id));
    } catch {
      alert('Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white overflow-x-hidden dark:bg-[#020202] dark:text-white dark:selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-36 pb-20 sm:pb-28 lg:pb-32">
         <div className="relative mb-16 overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-black/[0.04] dark:bg-white/5 p-6 sm:p-10 md:p-16 backdrop-blur-xl">
            <div className="relative z-10 flex flex-col md:flex-row items-end justify-between gap-12">
               <div className="space-y-6">
                  <div className="inline-block bg-[#ff4d00] px-4 py-1">
                    <span className="text-white text-[9px] font-black uppercase tracking-widest">{t.archiveHeadline}</span>
                  </div>
                  <h1 className="text-4xl sm:text-6xl md:text-[6rem] font-black italic uppercase tracking-tighter leading-none text-balance">{t.title}</h1>
                  <p className="text-neutral-600 dark:text-white/60 text-sm sm:text-base md:text-lg max-w-xl leading-relaxed">
                     {t.desc}
                  </p>
               </div>
            </div>
         </div>

         {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
               {Array.from({ length: 8 }).map((_, i) => (
                 <div key={i} className="aspect-[3/4] bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 animate-pulse rounded-2xl" />
               ))}
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 text-white">
               {stories.map((story, i) => (
                 <motion.div 
                   key={story.id}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.05 }}
                 >
                    <div className="p-5 bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl group h-full flex flex-col hover:border-[#ff4d00]/50 transition-all">
                       <div className="aspect-[4/5] bg-black mb-6 overflow-hidden border border-neutral-100 dark:border-white/5 rounded-xl group-hover:border-neutral-300 dark:border-white/20 transition-all duration-500">
                          {story.frames[0]?.imageUrl ? (
                            <img src={story.frames[0].imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20">
                              <Layout size={48} strokeWidth={1} className="text-white" />
                            </div>
                          )}
                       </div>

                       <div className="space-y-5 mt-auto">
                          <div className="flex justify-between items-start gap-4">
                             <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-[#ff4d00] transition-colors line-clamp-2">{story.title || t.untitled}</h3>
                             <span className="shrink-0 text-[#ff4d00] font-black text-[10px]">
                               #{String(i+1).padStart(2, '0')}
                             </span>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-white/10">
                             <div className="flex items-center gap-2 text-neutral-500 dark:text-white/40 text-[9px] font-black uppercase tracking-widest">
                                <Clock size={10} /> {new Date(story.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}
                             </div>
                             <div className="text-neutral-600 dark:text-white/60 text-[9px] font-black uppercase tracking-widest">
                                {story.frames.length} {t.pieces}
                             </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                             <Link href={`/story/${story.id}`} className="flex-1">
                                <button className="w-full py-3 bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-white font-black uppercase text-[9px] tracking-widest hover:bg-[#ff4d00] hover:border-[#ff4d00] transition-all rounded-lg">{t.open}</button>
                             </Link>
                             <button 
                               onClick={() => deleteStory(story.id)}
                               className="px-4 bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-white/50 hover:bg-red-600/20 hover:text-red-500 hover:border-red-600/30 transition-all rounded-lg"
                             >
                                <Trash2 size={12} />
                             </button>
                          </div>
                       </div>
                    </div>
                 </motion.div>
               ))}
               {stories.length === 0 && (
                 <div className="col-span-full py-32 text-center border border-neutral-200 dark:border-white/10 bg-black/[0.04] dark:bg-white/5 rounded-3xl backdrop-blur-sm">
                    <p className="text-neutral-500 dark:text-white/40 text-[10px] font-black uppercase tracking-[0.5em]">{t.empty}</p>
                 </div>
               )}
            </div>
         )}
      </main>
    </div>
  );
}
