'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, BookOpen, Grid3x3, User as UserIcon, Layers, Sparkles } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { translations, Lang } from '@/lib/translations';

interface SessionUser {
   id: string;
   firstName: string;
   lastName: string;
   username: string;
   avatar?: string | null;
}

interface StoryFrame {
   imageUrl?: string | null;
}

interface Story {
   id: string;
   title: string;
   createdAt: string;
   updatedAt: string;
   frames: StoryFrame[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
   return typeof value === 'object' && value !== null;
};

const getString = (value: unknown) => {
   return typeof value === 'string' ? value : '';
};

const getOptionalString = (value: unknown) => {
   return typeof value === 'string' ? value : null;
};

const parseSessionUser = (value: unknown): SessionUser | null => {
   if (!isRecord(value)) return null;

   const id = getString(value.id);
   const firstName = getString(value.firstName);
   const lastName = getString(value.lastName);
   const username = getString(value.username);

   if (!id || !firstName || !lastName || !username) return null;

   return {
      id,
      firstName,
      lastName,
      username,
      avatar: getOptionalString(value.avatar),
   };
};

const parseStoryFrame = (value: unknown): StoryFrame | null => {
   if (!isRecord(value)) return null;

   return {
      imageUrl: getOptionalString(value.imageUrl),
   };
};

const parseStory = (value: unknown): Story | null => {
   if (!isRecord(value)) return null;

   const id = getString(value.id);
   const title = getString(value.title);
   const createdAt = getString(value.createdAt);
   const updatedAt = getString(value.updatedAt);
   const frames = Array.isArray(value.frames)
      ? value.frames.map(parseStoryFrame).filter((frame): frame is StoryFrame => frame !== null)
      : [];

   if (!id) return null;

   return {
      id,
      title,
      createdAt,
      updatedAt,
      frames,
   };
};

const parseStories = (value: unknown): Story[] => {
   if (!Array.isArray(value)) return [];

   return value.map(parseStory).filter((story): story is Story => story !== null);
};

export default function Home() {
   const [user, setUser] = useState<SessionUser | null>(null);
   const [stories, setStories] = useState<Story[]>([]);
   const [lang, setLang] = useState<Lang>('en');

   const t = translations[lang];

   useEffect(() => {
      let isMounted = true;

      const loadUser = async () => {
         try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) throw new Error('Unable to load session');

            const data = await res.json() as unknown;
            const nextUser = isRecord(data) ? parseSessionUser(data.user) : null;

            if (!isMounted) return;
            startTransition(() => setUser(nextUser));
         } catch {
            if (!isMounted) return;
            startTransition(() => setUser(null));
         }
      };

      void loadUser();

      // Language handling
      const savedLang = localStorage.getItem('lang') as Lang;
      if (savedLang && translations[savedLang]) {
        setLang(savedLang);
      }

      const handleLang = (e: any) => {
        setLang(e.detail as Lang);
      };
      window.addEventListener('langChange', handleLang);

      return () => {
         isMounted = false;
         window.removeEventListener('langChange', handleLang);
      };
   }, []);

   useEffect(() => {
      if (!user) return;

      let isMounted = true;

      const loadStories = async () => {
         try {
            const res = await fetch('/api/stories');
            if (!res.ok) throw new Error('Unable to load stories');

            const data = await res.json() as unknown;
            const nextStories = parseStories(data);

            if (!isMounted) return;
            startTransition(() => setStories(nextStories));
         } catch {
            if (!isMounted) return;
            startTransition(() => setStories([]));
         }
      };

      void loadStories();

      return () => {
         isMounted = false;
      };
   }, [user]);

   const stepData = [
      { number: '01', title: t.features.forge, desc: t.features.forgeDesc, icon: UserIcon },
      { number: '02', title: t.features.inking, desc: t.features.inkingDesc, icon: Sparkles },
      { number: '03', title: t.features.grid, desc: t.features.gridDesc, icon: Grid3x3 },
      { number: '04', title: t.features.export, desc: t.features.exportDesc, icon: BookOpen },
   ];

   return (
      <div className="min-h-screen bg-white text-black selection:bg-[#ff4d00] selection:text-white overflow-x-hidden">
         <Navbar />

         {/* -- THE FOUNDRY HERO: STEREOSCOPIC 3D EXPERIENCE ---------- */}
         <section className="relative w-full h-screen min-h-[900px] overflow-hidden bg-black flex items-center perspective-container group/hero">
            <div 
               className="absolute bottom-0 left-0 w-full h-[60vh] opacity-10 group-hover/hero:opacity-30 transition-all duration-1000 pointer-events-none depth-layer" 
               data-depth="20"
               style={{ 
                  backgroundImage: 'radial-gradient(circle at center, #ff4d00 1px, transparent 1px)', 
                  backgroundSize: '40px 40px',
                  transform: 'rotateX(60deg) translateY(200px)',
                  transformOrigin: 'bottom'
               }} 
            />

            <div className="container mx-auto px-8 lg:px-16 relative z-30 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
               <div className="flex flex-col space-y-12">
                  <div className="space-y-4">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-[1px] bg-[#ff4d00]" />
                        <span className="text-[10px] font-black uppercase tracking-[1em] text-[#ff4d00]">{t.hero.subtitle}</span>
                     </div>

                     <div className="relative group/title cursor-default px-1">
                        <div className="absolute inset-0 text-[#ff4d00]/5 text-[clamp(2.5rem,12vw,9rem)] font-comic leading-[0.9] uppercase tracking-tighter depth-layer blur-[8px] group-hover/hero:blur-[4px] transition-all duration-700" data-depth="10">
                           {t.hero.title}
                        </div>
                        <h1 className="relative text-white text-[clamp(2.5rem,12vw,9rem)] font-comic leading-[0.9] uppercase tracking-tighter depth-layer group-hover/hero:text-[#ff4d00]/90 transition-colors duration-700" data-depth="8">
                           {t.hero.title}
                        </h1>
                     </div>
                  </div>

                   <div className="space-y-8">
                     <div className="relative border-l-2 border-[#ff4d00]/20 group-hover/hero:border-[#ff4d00] pl-6 transition-all duration-700 depth-layer" data-depth="15">
                        <p className="text-white/40 text-base md:text-lg max-w-md font-medium leading-relaxed group-hover/hero:text-white/70 transition-colors duration-700">
                           {t.hero.desc}
                        </p>
                     </div>
                     
                     <div className="flex flex-wrap items-center gap-6 depth-layer" data-depth="5">
                        <Link href={user ? '/studio' : '/auth'} className="group/btn relative w-full sm:w-auto">
                           <div className="absolute inset-0 border-2 border-[#ff4d00] translate-x-2 translate-y-2 group-hover/btn:translate-x-0 group-hover/btn:translate-y-0 transition-all duration-300" />
                           <button className="relative w-full px-10 py-5 bg-white text-black font-accent uppercase tracking-widest text-lg border-2 border-black group-hover/btn:bg-[#ff4d00] group-hover/btn:text-white transition-all duration-300 overflow-hidden">
                              <span className="relative z-10">{user ? t.hero.launch : t.hero.cta}</span>
                              <div className="absolute inset-0 bg-black translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 opacity-10" />
                           </button>
                        </Link>
                     </div>
                  </div>

                  {/* Mobile Preview Stack (Visible only on mobile) */}
                  <div className="flex lg:hidden overflow-x-auto pb-8 gap-4 snap-x no-scrollbar">
                     {['/cover1.png', '/cover2.png', '/cover3.png'].map((img, i) => (
                        <div key={i} className="min-w-[200px] aspect-[3/4] border-2 border-white/10 snap-center bg-black overflow-hidden rounded-lg">
                           <img src={img} className="w-full h-full object-cover opacity-60" alt="Preview" />
                        </div>
                     ))}
                  </div>
               </div>

               <div className="relative hidden lg:flex items-center justify-center h-[700px]">
                  <div className="absolute w-[500px] h-[500px] bg-[#ff4d00]/5 rounded-full blur-[120px] depth-layer" data-depth="15" />
                  
                   <div className="relative w-full h-full flex items-center justify-center group/stack">
                      {[
                         { img: '/cover1.png', rotate: '-5deg', x: -70, y: -50, z: 10, issue: '01', hoverX: -260, hoverY: -80, hoverRotate: '-12deg' },
                         { img: '/cover2.png', rotate: '-2deg', x: -20, y: -20, z: 20, issue: '02', hoverX: -90, hoverY: -40, hoverRotate: '-4deg' },
                         { img: '/cover3.png', rotate: '2deg', x: 30, y: 20, z: 30, issue: '03', hoverX: 80, hoverY: 30, hoverRotate: '4deg' },
                         { img: '/cover4.png', rotate: '6deg', x: 80, y: 60, z: 40, issue: '04', hoverX: 250, hoverY: 90, hoverRotate: '12deg' }
                      ].map((issue, i) => (
                         <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.8, y: 100 }}
                            whileInView={{ 
                               opacity: 1, 
                               scale: 1, 
                               x: issue.x, 
                               y: issue.y, 
                               rotate: issue.rotate,
                               zIndex: issue.z
                            }}
                            className="absolute w-72 aspect-[3/4] border-4 border-black bg-black shadow-2xl overflow-hidden perspective-card aesthetic-shadow group transition-all duration-500 ease-[0.23,1,0.32,1] group-hover/stack:!translate-x-[var(--hx)] group-hover/stack:!translate-y-[var(--hy)] group-hover/stack:!rotate-[var(--hr)]"
                            style={{ 
                               zIndex: issue.z,
                               '--hx': `${issue.hoverX}px`,
                               '--hy': `${issue.hoverY}px`,
                               '--hr': issue.hoverRotate
                            } as any}
                         >
                            {/* Technical Metadata Overlays */}
                            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-20 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black bg-white text-black px-2 py-0.5 uppercase tracking-tighter">{t.hero.issue}_{issue.issue}</span>
                                  <span className="text-[8px] font-bold text-white/40 mt-1 uppercase">{t.hero.protocol}</span>
                               </div>
                               <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-md">
                                  <div className="w-1.5 h-1.5 bg-[#ff4d00]" />
                               </div>
                            </div>

                            <div className="absolute bottom-0 left-0 w-full p-6 z-20 pointer-events-none translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                               <div className="h-[2px] bg-[#ff4d00] w-12 mb-4" />
                               <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">{t.hero.standard}</p>
                               <h4 className="text-xl font-accent text-white uppercase tracking-wider">iComics_V7</h4>
                            </div>

                            <img 
                               src={issue.img} 
                               className="w-full h-full object-cover grayscale-[0.9] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" 
                               alt={`Issue ${issue.issue}`} 
                            />
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-40 group-hover:opacity-20 transition-opacity" />
                            <div className="absolute inset-0 border-[12px] border-black/10 group-hover:border-transparent transition-all" />
                         </motion.div>
                      ))}
                   </div>
               </div>
            </div>
         </section>

         {/* -- ARCHITECTURAL FEATURES ------------------------------ */}
         <section className="py-24 md:py-40 bg-white border-y-8 border-black perspective-container relative overflow-hidden">
            <div className="container mx-auto px-8 max-w-[1400px]">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
                  <div className="space-y-8 md:space-y-12 depth-layer" data-depth="15">
                     <div className="space-y-6">
                        <span className="inline-block bg-black text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest">{t.features.protocol}</span>
                        <h2 className="text-5xl md:text-[8rem] font-accent uppercase leading-[0.9] tracking-tight">{t.features.title}</h2>
                     </div>
                     <p className="text-xl md:text-2xl font-bold italic border-l-8 border-black pl-8 max-w-lg">
                        {t.features.quote}
                     </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {[
                        { title: t.features.forge, icon: UserIcon, desc: t.features.forgeDesc },
                        { title: t.features.inking, icon: Zap, desc: t.features.inkingDesc },
                        { title: t.features.grid, icon: Grid3x3, desc: t.features.gridDesc },
                        { title: t.features.export, icon: Layers, desc: t.features.exportDesc }
                     ].map((feat, i) => (
                        <div key={i} data-tilt-card className="p-8 md:p-10 bg-white border-4 border-black group hover:bg-[#ff4d00] hover:-translate-y-2 md:hover:-translate-y-4 transition-all duration-500 ease-[0.23,1,0.32,1] perspective-card aesthetic-shadow h-full cursor-pointer relative overflow-hidden">
                           <div className="absolute inset-x-0 bottom-0 h-1 bg-black group-hover:bg-white transition-colors" />
                           <div className="relative z-10">
                              <div className="w-12 h-12 bg-black text-white flex items-center justify-center mb-8 border-2 border-black group-hover:bg-white group-hover:text-black transition-all duration-500" style={{ transform: 'translateZ(40px)' }}>
                                 <feat.icon size={20} />
                              </div>
                              <h3 className="text-2xl md:text-3xl font-accent uppercase mb-4 group-hover:text-white transition-colors duration-500" style={{ transform: 'translateZ(25px)' }}>{feat.title}</h3>
                              <p className="text-[11px] font-black uppercase text-black/40 group-hover:text-black transition-colors duration-500" style={{ transform: 'translateZ(10px)' }}>{feat.desc}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </section>

         {/* -- THE BLUEPRINT (STEPS) --------------- */}
         <section className="py-24 md:py-48 bg-[#080808] text-white overflow-hidden perspective-container">
            <div className="container mx-auto px-8 lg:px-16">
               <div className="mb-16 md:mb-32 space-y-4 depth-layer" data-depth="20">
                  <span className="text-[#ff4d00] text-[10px] font-black uppercase tracking-widest">{t.features.blueprint}</span>
                  <h2 className="text-5xl md:text-9xl font-display uppercase tracking-tighter">{t.features.sequence}</h2>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 border-r border-b border-white/10">
                  {stepData.map((step, i) => (
                     <div key={i} data-tilt-card className="p-8 md:p-12 border-l border-t border-white/10 group hover:bg-[#ff4d00] hover:-translate-y-2 md:hover:-translate-y-4 transition-all duration-700 ease-[0.23,1,0.32,1] h-full perspective-card cursor-pointer relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="relative z-10">
                           <div className="flex justify-between items-start mb-8 md:mb-12" style={{ transform: 'translateZ(40px)' }}>
                              <span className="text-2xl font-display text-white/10 group-hover:text-black transition-colors duration-500">{step.number}</span>
                              <step.icon size={24} className="text-[#ff4d00] group-hover:text-black transition-colors duration-500" />
                           </div>
                           <h3 className="text-2xl md:text-3xl font-accent uppercase mb-4 md:mb-6 group-hover:text-black transition-colors duration-500" style={{ transform: 'translateZ(30px)' }}>{step.title}</h3>
                           <p className="text-xs font-bold text-white/30 uppercase leading-relaxed group-hover:text-black/60 transition-colors duration-500" style={{ transform: 'translateZ(20px)' }}>{step.desc}</p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         {/* -- PURE RELIABILITY (RESTORED PANEL SECTION) -- */}
         <section className="py-24 md:py-40 bg-white relative overflow-hidden border-b-8 border-black perspective-container">
            <div className="container mx-auto px-8 max-w-[1400px]">
               <div className="flex flex-col lg:flex-row items-center gap-16 md:gap-24">
                  <div className="w-full lg:w-1/2 depth-layer" data-depth="25">
                     <div data-tilt-card className="relative group p-4 bg-black rotate-[-1deg] hover:rotate-0 transition-transform duration-700 shadow-2xl perspective-card">
                        <div className="relative aspect-[4/5] overflow-hidden border-4 border-white">
                           <img src="/showcase.png" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-100 group-hover:scale-105" alt="Foundry Showcase" />
                           <div className="absolute top-8 left-8 bg-white border-2 border-black p-4 shadow-[8px_8px_0_#ff4d00] rotate-[-2deg]" style={{ transform: 'translateZ(40px)' }}>
                              <h4 className="text-xl md:text-2xl font-accent uppercase text-black leading-none">{t.studio.accession}</h4>
                              <p className="text-[10px] font-black uppercase text-black/40 mt-1 tracking-widest">CORE_VERSION_8.0</p>
                           </div>
                           <div className="absolute bottom-0 right-0 bg-[#ff4d00] text-white px-6 md:px-8 py-4 font-accent text-lg md:text-xl uppercase tracking-widest border-l-4 border-t-4 border-black" style={{ transform: 'translateZ(30px)' }}>
                              {t.studio.systemStable}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="w-full lg:w-1/2 space-y-8 md:space-y-12 depth-layer" data-depth="15">
                     <div className="space-y-6">
                        <div className="flex items-center gap-6">
                           <div className="px-4 py-1 bg-black text-white font-comic text-[10px] uppercase tracking-widest">{t.features.uplink}</div>
                           <div className="flex-1 h-[2px] bg-black/10" />
                        </div>
                        <h2 className="text-5xl md:text-[7rem] font-accent uppercase tracking-wide leading-[0.9] text-black">
                           {t.features.reliability.split(' ')[0]} <br />
                           <span className="text-[#ff4d00]">{t.features.reliability.split(' ')[1]}</span>
                        </h2>
                        <p className="text-base md:text-lg font-bold text-black/60 max-w-md">{t.features.reliabilityDesc}</p>
                     </div>
                  </div>
               </div>
            </div>
         </section>

         <Footer />
      </div>
   );
}
