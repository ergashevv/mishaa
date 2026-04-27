'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Layout, MousePointer2 } from 'lucide-react';
import Navbar from './Navbar';

interface CinematicFrame {
  id: string;
  imageUrl?: string | null;
  dialogue?: string | null;
  soundEffect?: string | null;
}

interface CinematicStory {
  frames: CinematicFrame[];
}

type RenderedFrame = CinematicFrame & {
  imageUrl: string;
};

const hasImageUrl = (frame: CinematicFrame): frame is RenderedFrame => {
  return typeof frame.imageUrl === 'string' && frame.imageUrl.length > 0;
};

export default function CinematicViewer({ story }: { story: CinematicStory }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [viewMode, setViewMode] = useState<'cinematic' | 'webtoon'>('cinematic');
  const frames = story.frames.filter(hasImageUrl);

  useEffect(() => {
    if (!isPlaying || viewMode === 'webtoon') return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % frames.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPlaying, frames.length, viewMode]);

  if (frames.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center text-white font-black uppercase italic tracking-widest opacity-20">
        This story has no rendered frames yet.
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-black text-white selection:bg-yellow-400 selection:text-black">
      <Navbar />

      {/* Mode Switcher */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-black/40 backdrop-blur-xl border border-white/5 p-1.5 rounded-2xl flex gap-2">
         <button 
           onClick={() => setViewMode('cinematic')}
           className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'cinematic' ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white'}`}
         >
           Cinema
         </button>
         <button 
           onClick={() => setViewMode('webtoon')}
           className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'webtoon' ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white'}`}
         >
           Webtoon
         </button>
      </div>

      {viewMode === 'cinematic' ? (
        <div className="relative h-screen w-screen overflow-hidden">
          {/* Background Cinematic Layer */}
          <AnimatePresence mode="wait">
            <motion.div
              key={frames[currentIndex].id}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <img
                src={frames[currentIndex].imageUrl}
                className="w-full h-full object-cover grayscale-[0.2] contrast-125 saturate-[1.2]"
                alt="Story Frame"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
              
              {/* SPEECH BUBBLE OVERLAY */}
              {frames[currentIndex].dialogue && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute top-[15%] left-[10%] max-w-[40%]"
                >
                   <div className="bg-white border-[4px] border-black p-6 rounded-[50px] relative shadow-[8px_8px_0px_rgba(0,0,0,1)]">
                      <p className="text-black text-xl font-black uppercase tracking-tight leading-tight text-center italic">
                        {frames[currentIndex].dialogue}
                      </p>
                      <div className="absolute -bottom-6 left-12 w-10 h-10 bg-white border-r-[4px] border-b-[4px] border-black rotate-45" />
                   </div>
                </motion.div>
              )}

              {/* SOUND EFFECT OVERLAY */}
              {frames[currentIndex].soundEffect && (
                <motion.div 
                  initial={{ opacity: 0, scale: 2, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: -15 }}
                  className="absolute top-[40%] right-[15%]"
                >
                   <span className="text-[12rem] font-black text-yellow-400 uppercase italic tracking-tighter drop-shadow-[10px_10px_0px_rgba(0,0,0,1)]" style={{ WebkitTextStroke: '6px black' }}>
                     {frames[currentIndex].soundEffect}
                   </span>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="absolute bottom-10 left-12 right-12 md:left-24 md:right-24 flex items-center justify-between z-20">
            <div className="flex items-center gap-6">
               <button 
                 onClick={() => setIsPlaying(!isPlaying)}
                 className="p-5 bg-white text-black rounded-full hover:bg-yellow-400 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
               >
                 {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
               </button>
               <div className="h-1 w-64 bg-white/10 rounded-full overflow-hidden hidden md:block">
                  <motion.div 
                    key={currentIndex}
                    initial={{ width: 0 }}
                    animate={{ width: isPlaying ? "100%" : "auto" }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="h-full bg-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                  />
               </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setCurrentIndex((prev) => (prev - 1 + frames.length) % frames.length)}
                className="p-5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-full transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setCurrentIndex((prev) => (prev + 1) % frames.length)}
                className="p-5 bg-yellow-400 text-black rounded-full hover:bg-white transition-all shadow-xl"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="absolute top-10 right-12 md:right-24">
            <span className="text-xs font-black italic uppercase tracking-[0.6em] text-white/40">SCENE {currentIndex + 1} / {frames.length}</span>
          </div>
        </div>
      ) : (
        <div className="pt-40 max-w-4xl mx-auto space-y-0 pb-40 px-4 md:px-0">
           {frames.map((frame, idx) => (
             <div key={frame.id} className="relative group">
                <div className="absolute -left-12 top-0 bottom-0 w-8 flex flex-col items-center justify-start opacity-0 group-hover:opacity-20 transition-opacity">
                   <div className="h-20 w-px bg-white" />
                   <span className="text-[10px] font-black rotate-90 mt-4 tracking-widest">{idx + 1}</span>
                </div>
                
                <img 
                  src={frame.imageUrl} 
                  className="w-full h-auto border-x-8 border-black shadow-[0_40px_100px_rgba(0,0,0,0.8)]" 
                />

                {/* Overlays in vertical scroll */}
                {frame.dialogue && (
                  <div className="absolute top-[10%] left-[10%] max-w-[50%] z-10 pointer-events-none">
                     <div className="bg-white border-[3px] border-black p-4 rounded-[40px] relative shadow-[6px_6px_0px_rgba(0,0,0,1)]">
                        <p className="text-black text-sm font-black uppercase tracking-tight leading-tight text-center italic">{frame.dialogue}</p>
                        <div className="absolute -bottom-3 left-8 w-6 h-6 bg-white border-r-[3px] border-b-[3px] border-black rotate-45" />
                     </div>
                  </div>
                )}

                {frame.soundEffect && (
                   <div className="absolute top-[40%] right-[10%] z-10 rotate-[-15deg] pointer-events-none">
                      <span className="text-8xl font-black text-yellow-400 uppercase italic tracking-tighter drop-shadow-[8px_8px_0px_rgba(0,0,0,1)]" style={{ WebkitTextStroke: '4px black' }}>
                        {frame.soundEffect}
                      </span>
                   </div>
                )}
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
