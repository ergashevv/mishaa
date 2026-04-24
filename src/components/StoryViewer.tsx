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
  const [hasStarted, setHasStarted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const checkScreen = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    
    // Attempt to play audio on mount (might be blocked by browser)
    if (audioRef.current) {
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
    console.log("Audio toggle clicked, current paused state:", audioRef.current?.paused);
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch((err) => console.error("Play failed:", err));
      } else {
        audioRef.current.pause();
      }
    }
  };

  const nextSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Also try to start audio on first interaction if it was blocked
    if (!isPlaying && audioRef.current) {
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
          className="relative w-full h-full flex items-center justify-center cursor-pointer"
          onClick={() => nextSlide()}
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
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-950 via-purple-950 to-black flex items-center justify-center p-8">
               <motion.div 
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="max-w-md w-full bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[40px] p-10 text-center shadow-2xl"
               >
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8">
                    <Heart className="w-12 h-12 text-red-500 fill-red-500" />
                  </div>
                  <h2 className="text-5xl font-black mb-6 italic tracking-tight text-white">SEND HELP 🙏</h2>
                  <p className="text-white/60 mb-10 text-lg">Your support means everything. Thank you!</p>
                  
                  <div className="bg-white/5 rounded-3xl p-8 mb-10 border border-white/10 cursor-pointer hover:bg-white/10 transition-all active:scale-95"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText('5614 6816 0771 9857');
                        setShowCopied(true);
                        setTimeout(() => setShowCopied(false), 2000);
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                        <CreditCard className="w-6 h-6 text-white/50" />
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-black">Humo / UzCard</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-mono tracking-tighter mb-2 font-bold text-white whitespace-nowrap">5614 6816 0771 9857</p>
                    <p className="text-xs text-white/30 uppercase tracking-[0.3em]">Tap to copy</p>
                  </div>

                  <button className="w-full py-5 bg-white text-black font-black rounded-2xl hover:brightness-90 transition-all text-sm uppercase tracking-widest shadow-xl">
                    Share Story
                  </button>
               </motion.div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center opacity-0 md:hover:opacity-100 transition-opacity z-[100]">
        <button 
          onClick={prevSlide} 
          className="p-4 rounded-full bg-black/40 backdrop-blur-xl text-white border border-white/10"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center opacity-0 md:hover:opacity-100 transition-opacity z-[100]">
        <button 
          onClick={nextSlide} 
          className="p-4 rounded-full bg-black/40 backdrop-blur-xl text-white border border-white/10"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

    </div>
  );
}
