'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { slides } from '@/lib/slides';
import { ChevronRight, ChevronLeft, CreditCard, Heart, Volume2, VolumeX, Play } from 'lucide-react';

export default function StoryViewer() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [manualMute, setManualMute] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pressTimerRef = useRef<number>(0);

  const nextSlide = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProgress(0); // Reset progress on manual move
    if (!isPlaying && audioRef.current && !manualMute) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
    }
    setCurrentIdx((idx) => (idx < slides.length - 1 ? idx + 1 : idx));
  }, [isPlaying, manualMute]);

  const prevSlide = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProgress(0); // Reset progress on manual move
    setCurrentIdx((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);

  // Audio lifecycle and Visibility management
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        audio.pause();
      } else if (!manualMute) {
        audio.play().catch(() => { });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial play on mount
    if (!manualMute) {
      audio.play().then(() => setIsPlaying(true)).catch(() => { });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      audio.pause(); // Cleanup on unmount
    };
  }, [manualMute]);

  useEffect(() => {
    const checkScreen = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };

    window.addEventListener('keydown', handleKeyDown);

    // Precise progress tracking
    let interval: NodeJS.Timeout;
    if (currentIdx < slides.length - 1 && !isPaused) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            nextSlide();
            return 0;
          }
          return prev + 1;
        });
      }, 50);
    }

    return () => {
      window.removeEventListener('resize', checkScreen);
      window.removeEventListener('keydown', handleKeyDown);
      if (interval) clearInterval(interval);
    };
  }, [currentIdx, isPaused, nextSlide, prevSlide]);

  const handlePressStart = () => {
    pressTimerRef.current = Date.now();
    setIsPaused(true);
  };

  const handlePressEnd = (direction: 'left' | 'right') => {
    const duration = Date.now() - pressTimerRef.current;
    setIsPaused(false);

    if (duration < 250) { // It's a short tap
      if (direction === 'left') prevSlide();
      else nextSlide();
    }
  };

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
      <div className="absolute top-12 left-0 right-0 z-[1100] flex gap-1 px-2 md:top-6 md:px-4">
        {slides.map((_, i) => (
          <div key={i} className="h-[2px] flex-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: i < currentIdx ? "100%" : i === currentIdx ? `${progress}%` : "0%"
              }}
              transition={{ duration: 0.05, ease: "linear" }}
              className="h-full bg-white"
            />
          </div>
        ))}
      </div>

      {/* Audio Toggle Button */}
      <div className="absolute top-20 right-4 z-[1200] md:top-12 md:right-8">
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
          ) : currentSlide.type === 'title' ? (
            <div className="absolute inset-0 w-full h-full bg-black flex flex-col items-center justify-center p-8 pt-24 z-[50] overflow-hidden pointer-events-none">
              {/* Atmospheric Cinematic Glows */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[50%] bg-white/5 blur-[120px] rounded-full pointer-events-none" />

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                className="text-center relative z-10"
              >
                <motion.span
                  initial={{ opacity: 0, letterSpacing: "0.2em" }}
                  animate={{ opacity: 1, letterSpacing: "0.6em" }}
                  transition={{ delay: 0.5, duration: 1.5 }}
                  className="text-white/40 text-sm md:text-base uppercase font-black mb-6 block tracking-[0.6em]"
                >
                  {currentSlide.subtitleText}
                </motion.span>

                <h1 className="text-7xl md:text-[12rem] font-black text-white italic tracking-tighter leading-none relative">
                  <span className="relative z-10">{currentSlide.titleText}</span>
                  {/* Dramatic Shadow/Glow */}
                  <span className="absolute inset-0 text-white/20 blur-2xl z-0 scale-110 pointer-events-none italic">
                    {currentSlide.titleText}
                  </span>
                </h1>

                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                  className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent mt-8"
                />
              </motion.div>
            </div>
          ) : (
            <div className="absolute inset-0 w-full h-full bg-[#050505] flex items-center justify-center p-6 md:p-12 pt-24 z-[999] pointer-events-none overflow-hidden text-white">
              {/* Ambient Background Glows */}
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/10 blur-[120px] rounded-full" />

              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative z-[1000] max-w-4xl w-full flex flex-col md:flex-row items-center gap-12 md:gap-20 pointer-events-auto"
              >
                {/* Left Side: Illustration/Brand */}
                <div className="flex-1 text-center md:text-left">
                  <motion.div
                    initial={{ scale: 0.8, rotate: -5 }}
                    animate={{ scale: 1, rotate: 3 }}
                    transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                    className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-tr from-rose-500 via-orange-500 to-yellow-500 rounded-[2rem] flex items-center justify-center mx-auto md:mx-0 mb-8 shadow-[0_20px_40px_rgba(244,63,94,0.3)]"
                  >
                    <Heart className="w-12 h-12 md:w-16 md:h-16 text-white fill-white" />
                  </motion.div>
                  <h2 className="text-5xl md:text-8xl font-black mb-6 italic tracking-tight text-white uppercase leading-[0.9]">
                    SEND <br className="hidden md:block" /> HELP 🙏
                  </h2>
                  <p className="text-white/40 text-lg md:text-xl max-w-md leading-relaxed">
                    Every contribution helps a brother get through these tough times. Your support means everything.
                  </p>
                </div>

                {/* Right Side: Card & Actions */}
                <div className="w-full max-w-sm">
                  <div className="relative bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-8 md:p-10 shadow-2xl overflow-hidden group">
                    {/* Card Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                    <div className="flex items-center justify-between mb-8">
                      <CreditCard className="w-8 h-8 text-white/40" />
                      <div className="flex gap-1">
                        <div className="w-8 h-5 bg-white/10 rounded-sm" />
                        <div className="w-8 h-5 bg-white/5 rounded-sm" />
                      </div>
                    </div>

                    <div className="mb-10">
                      <span className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-black mb-3 block">Card Number</span>
                      <p className="text-2xl md:text-3xl font-mono tracking-tighter text-white font-black whitespace-nowrap">
                        5614 6816 0771 9857
                      </p>
                    </div>

                    <div className="space-y-4">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const text = '5614 6816 0771 9857';
                          try {
                            await navigator.clipboard.writeText(text);
                          } catch (err) {
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
                        className="w-full py-5 bg-white text-black text-xs font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 transition-all shadow-[0_15px_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 hover:bg-zinc-200"
                      >
                        Copy Card Number
                      </button>

                      <button className="w-full py-5 bg-white/5 text-white/40 font-black rounded-2xl hover:bg-white/10 hover:text-white transition-all text-[10px] uppercase tracking-[0.3em] border border-white/5">
                        Share Story
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Instagram-style Navigation Zones (Invisible) */}
      <div className="absolute inset-0 z-[10] flex pointer-events-none touch-none" onContextMenu={(e) => e.preventDefault()}>
        <div
          className="w-[30%] h-full pointer-events-auto cursor-auto"
          onMouseDown={handlePressStart}
          onMouseUp={() => handlePressEnd('left')}
          onTouchStart={handlePressStart}
          onTouchEnd={() => handlePressEnd('left')}
        />
        <div
          className="w-[70%] h-full pointer-events-auto cursor-auto"
          onMouseDown={handlePressStart}
          onMouseUp={() => handlePressEnd('right')}
          onTouchStart={handlePressStart}
          onTouchEnd={() => handlePressEnd('right')}
        />
      </div>

      {/* Navigation Indicators (Only Desktop Buttons) */}
      <div className="hidden md:flex absolute inset-y-0 left-0 w-20 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none">
        <button
          onClick={(e) => { e.stopPropagation(); prevSlide(); }}
          className="p-4 rounded-full bg-black/40 backdrop-blur-xl text-white border border-white/10 pointer-events-auto"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      </div>
      <div className="hidden md:flex absolute inset-y-0 right-0 w-20 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none">
        <button
          onClick={(e) => { e.stopPropagation(); nextSlide(); }}
          className="p-4 rounded-full bg-black/40 backdrop-blur-xl text-white border border-white/10 pointer-events-auto"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

    </div>
  );
}
