import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Zap, RefreshCw } from 'lucide-react';

interface StoryArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyInput: string;
  setStoryInput: (val: string) => void;
  isSynthesizing: boolean;
  onSynthesize: () => void;
}

export function StoryArchitectModal({
  isOpen, onClose, storyInput, setStoryInput, isSynthesizing, onSynthesize
}: StoryArchitectModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-[var(--obsidian)]/90 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden"
          >
            <div className="p-10">
              <div className="flex items-center gap-6 mb-10 border-b border-white/10 pb-8">
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-2xl">
                  <Sparkles size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-black uppercase tracking-tight text-white">Story Architect</h3>
                  <p className="text-[10px] text-[var(--accent)] font-black uppercase tracking-[0.4em] mt-1">SENSE_MAKING_PROTOCOL_V2</p>
                </div>
                <button onClick={onClose}
                  className="ml-auto w-12 h-12 rounded-2xl hover:bg-white/10 flex items-center justify-center bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black mb-4">Production Script / Screenplay</p>
                  <textarea 
                    value={storyInput}
                    onChange={e => setStoryInput(e.target.value)}
                    placeholder="SCENE 1: AGENT X enters the neon alley.
[PANEL 1]: Close up on the cybernetic eye.
[PANEL 2]: Wide shot of the rainy street..."
                    rows={8}
                    className="w-full bg-black/40 border border-white/10 p-5 text-sm font-medium rounded-2xl outline-none focus:border-[var(--accent)] transition-all resize-none text-white leading-relaxed placeholder:text-white/5"
                  />
                </div>
                <button
                  onClick={onSynthesize}
                  disabled={isSynthesizing || !storyInput}
                  className="w-full py-6 bg-[var(--accent)] text-white font-display font-black text-lg uppercase tracking-[0.4em] rounded-2xl shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-20 flex items-center justify-center gap-4"
                >
                  {isSynthesizing ? <RefreshCw size={24} className="animate-spin" /> : <Zap size={24} />}
                  {isSynthesizing ? 'SYNTHESIZING...' : 'INITIALIZE_FOUNDRY'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
