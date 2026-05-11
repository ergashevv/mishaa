'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface AgeGateOverlayProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmAction: () => void;
  cancelAction: () => void;
  zIndex?: number;
}

const renderTitle = (title: string) => {
  const words = title.trim().split(/\s+/);
  const firstWord = words[0] || title;
  const restWords = words.slice(1).join(' ');

  return (
    <>
      {firstWord}
      <br />
      <span className="text-red-600">{restWords || 'RESTRICTED'}</span>
    </>
  );
};

export default function AgeGateOverlay({
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmAction,
  cancelAction,
  zIndex = 20000,
}: AgeGateOverlayProps) {
  return (
    <LazyMotion features={domAnimation} strict>
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-3xl dark:bg-black/95 max-md:p-4"
      style={{ zIndex }}
    >
      <m.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative max-w-md w-full overflow-hidden border border-red-600/35 bg-white p-12 text-center shadow-[0_0_80px_rgba(220,38,38,0.12)] dark:border-red-900/40 dark:bg-[#0a0a0a] dark:shadow-[0_0_100px_rgba(255,0,0,0.2)] max-md:p-6"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse" />

        <AlertTriangle className="w-20 h-20 text-red-600 mx-auto mb-8 animate-bounce max-md:w-14 max-md:h-14 max-md:mb-5" />
        <h2 className="mb-4 text-5xl font-black uppercase leading-none tracking-tighter text-neutral-900 italic dark:text-white max-md:text-3xl">
          {renderTitle(title)}
        </h2>
        <p className="mb-10 whitespace-pre-line text-[10px] uppercase leading-relaxed tracking-[0.3em] text-neutral-600 dark:text-white/55 max-md:mb-6">
          {description}
        </p>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={confirmAction}
            className="w-full py-6 bg-red-600 text-white font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white hover:text-black transition-all duration-500 shadow-lg hover:shadow-red-600/20"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={cancelAction}
            className="w-full bg-neutral-100 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-700 transition-all duration-500 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {cancelLabel}
          </button>
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-8 dark:border-white/5">
          <div className="text-[8px] font-black uppercase tracking-[0.5em] text-neutral-300 dark:text-white/10">
            Age verification required
          </div>
        </div>
      </m.div>
    </m.div>
    </LazyMotion>
  );
}
