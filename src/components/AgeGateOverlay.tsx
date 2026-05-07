'use client';

import { motion } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 max-md:p-4"
      style={{ zIndex }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#0a0a0a] border border-red-900/40 p-12 text-center shadow-[0_0_100px_rgba(255,0,0,0.2)] relative overflow-hidden max-md:p-6"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse" />

        <AlertTriangle className="w-20 h-20 text-red-600 mx-auto mb-8 animate-bounce max-md:w-14 max-md:h-14 max-md:mb-5" />
        <h2 className="text-5xl font-black italic uppercase mb-4 tracking-tighter leading-none max-md:text-3xl">
          {renderTitle(title)}
        </h2>
        <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mb-10 leading-relaxed max-md:mb-6">
          {description}
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={confirmAction}
            className="w-full py-6 bg-red-600 text-white font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white hover:text-black transition-all duration-500 shadow-lg hover:shadow-red-600/20"
          >
            {confirmLabel}
          </button>
          <button
            onClick={cancelAction}
            className="w-full py-6 bg-white/5 text-white/40 font-black uppercase tracking-[0.2em] text-[11px] hover:text-white hover:bg-white/10 transition-all duration-500"
          >
            {cancelLabel}
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5">
          <div className="text-[8px] font-black uppercase tracking-[0.5em] text-white/10">
            Age verification required
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
