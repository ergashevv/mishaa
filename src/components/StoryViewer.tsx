'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { slides } from '@/lib/slides';
import { ChevronRight, ChevronLeft, CreditCard, Heart, Volume2, VolumeX, Play } from 'lucide-react';

export default function StoryViewer() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [manualMute, setManualMute] = useState(false);
  const [hasStarted, setHasStarted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const checkScreen = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    
    // Only attempt auto-play if the user hasn't manually muted
    if (audioRef.current && !manualMute) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };

    window.addEventListener('keydown', handleKeyDown);

    // Auto-play logic: Go to next slide every 5 seconds
    let timer: NodeJS.Timeout;
    if (currentIdx < slides.length - 1) {
      timer = setTimeout(() => {
        nextSlide();
      }, 5000);
    }

    return () => {
      window.removeEventListener('resize', checkScreen);
      window.removeEventListener('keydown', handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [currentIdx]); 

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch((err) => console.error("Play failed:", err));
        setManualMute(false);
      } else {
        audioRef.current.pause();
        setManualMute(true);
      }
    }
  };

  const nextSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Only try to start audio on interaction if it wasn't manually muted
    if (!isPlaying && audioRef.current && !manualMute) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    if (currentIdx < slides.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const prevSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const currentSlide = slides[currentIdx];

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none text-white">
      {/* Audio Element */}
      <audio 
        ref={audioRef} 
        src="/music.mp3" 
        loop 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Copied Success Modal */}
      <AnimatePresence>
        {showCopied && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-1/2 left-1/2 -ms-center z-[1000] bg-white text-black px-12 py-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(255,255,255,0.2)] font-black text-xl italic tracking-tight -translate-x-1/2 -translate-y-1/2"
          >
            COPIED! 🙏
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bars */}
      <div className="absolute top-4 left-0 right-0 z-[60] flex gap-1 px-4">
        {slides.map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: i < currentIdx ? '100%' : i === currentIdx ? '100%' : '0%' }}
              className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            />
          </div>
        ))}
      </div>

      {/* Audio Toggle Button */}
      <div className="absolute top-8 right-8 z-[999]">
        <button 
          onClick={toggleAudio}
          className="p-4 rounded-full bg-black/50 backdrop-blur-2xl border border-white/20 text-white hover:bg-black/80 transition-all active:scale-90 shadow-2xl"
        >
          {isPlaying ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
        </button>

      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full h-full flex items-center justify-center cursor-default"
        >
          {currentSlide.type === 'image' ? (
            <div className="relative w-full h-full overflow-hidden bg-zinc-900">
                 <img
                   src={isMobile ? currentSlide.mobileImage : currentSlide.desktopImage}
                   alt="Story slide"
                   className="w-full h-full object-cover animate-ken-burns"
                   onError={(e) => {
                     const target = e.target as HTMLImageElement;
                     target.src = `https://via.placeholder.com/${isMobile ? '1080x1920' : '1920x1080'}/222/FFF?text=Rasm+yuklanmadi`;
                   }}
                 />
               <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 z-10" />
            </div>
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#0c0c0e] via-[#1a1a1e] to-black flex items-center justify-center p-6 md:p-8 z-[50] pointer-events-none">
                <motion.div 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 className="relative z-[110] max-w-sm w-full bg-[#1c1c21]/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 md:p-10 text-center shadow-[0_40px_100px_rgba(0,0,0,0.8)] pointer-events-auto"
               >
                  <div className="w-20 h-20 bg-gradient-to-tr from-rose-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3">
                    <Heart className="w-10 h-10 text-white fill-white" />
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black mb-4 italic tracking-tight text-white uppercase">SEND HELP 🙏</h2>
                  <p className="text-white/40 mb-10 text-sm md:text-base leading-relaxed text-balance">
                    Times are tough, but we keep pushing. Your support keeps me alive. Thank you, bro!
                  </p>
                  
                  <div className="relative bg-gradient-to-br from-white/10 to-white/5 rounded-[2.5rem] p-8 mb-8 border border-white/10 shadow-inner group">
                    <div className="flex items-center justify-between mb-6">
                        <CreditCard className="w-6 h-6 text-white/40" />
                        <span className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-black">Humo / UzCard</span>
                    </div>
                    
                    <div className="mb-8">
                        <p className="text-xl md:text-2xl lg:text-3xl font-mono tracking-tighter text-white font-black whitespace-nowrap">5614 6816 0771 9857</p>
                    </div>

                    <button 
                         onClick={async (e) => {
                             e.stopPropagation();
                             const text = '5614 6816 0771 9857';
                             try {
                                 await navigator.clipboard.writeText(text);
                             } catch (err) {
                                 // Fallback for older/insecure mobile browsers
                                 const textArea = document.createElement("textarea");
                                 textArea.value = text;
                                 document.body.appendChild(textArea);
                                 textArea.select();
                                 document.execCommand("copy");
                                 document.body.removeChild(textArea);
                             }
                             setShowCopied(true);
                             setTimeout(() => setShowCopied(false), 2000);
                         }}
                         className="w-full py-4 bg-white text-black text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                        Copy Card Number
                    </button>
                  </div>

                  <button className="w-full py-5 bg-[#2c2c31] text-white/60 font-bold rounded-2xl hover:text-white transition-all text-xs uppercase tracking-widest">
                    Share Story
                  </button>
               </motion.div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Instagram-style Navigation Zones (Invisible) */}
      <div className="absolute inset-0 z-[80] flex pointer-events-none">
        {/* Left Side (30% for Back) */}
        <div 
          className="w-[30%] h-full pointer-events-auto cursor-w-resize"
          onClick={(e) => prevSlide(e)}
        />
        {/* Right Side (70% for Forward) */}
        <div 
          className="w-[70%] h-full pointer-events-auto cursor-e-resize"
          onClick={(e) => nextSlide(e)}
        />
      </div>

      {/* Navigation Indicators (Only Desktop Buttons) */}
      <div className="hidden md:flex absolute inset-y-0 left-0 w-20 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none">
        <button 
          onClick={prevSlide} 
          className="p-4 rounded-full bg-black/40 backdrop-blur-xl text-white border border-white/10 pointer-events-auto"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      </div>
      <div className="hidden md:flex absolute inset-y-0 right-0 w-20 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none">
        <button 
          onClick={nextSlide} 
          className="p-4 rounded-full bg-black/40 backdrop-blur-xl text-white border border-white/10 pointer-events-auto"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

    </div>
  );
}
