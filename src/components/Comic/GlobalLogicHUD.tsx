import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Sparkles, X, ChevronUp, ChevronDown } from 'lucide-react';

interface GlobalLogicHUDProps {
  t: (key: string) => string;
}

export function GlobalLogicHUD({ t }: GlobalLogicHUDProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  const [message, setMessage] = React.useState("Foundry Logic is calibrated. Awaiting your narrative sequence.");

  return (
    <div className="fixed bottom-32 left-10 z-[600] w-80 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            className="pointer-events-auto bg-black/60 backdrop-blur-3xl border border-[var(--accent)]/40 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(255,77,0,0.2)]"
          >
            <div className="p-5 flex items-center gap-4 border-b border-white/5 bg-gradient-to-r from-[var(--accent)]/10 to-transparent">
               <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-[0_0_15px_rgba(255,77,0,0.5)]">
                  <BrainCircuit size={16} className="text-white" />
               </div>
               <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Logic_Assistant</span>
                  <span className="text-[6px] font-black uppercase text-[var(--accent)] tracking-widest animate-pulse">Neural_Sync_Active</span>
               </div>
               <button onClick={() => setIsOpen(false)} className="ml-auto text-white/20 hover:text-white transition-colors">
                  <X size={14} />
               </button>
            </div>
            <div className="p-6">
               <p className="text-[10px] font-medium leading-relaxed text-white/80">
                  {message}
               </p>
               <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                     <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                     <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                  </div>
                  <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.3em]">Module_04_Active</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!isOpen && (
         <motion.button 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto w-12 h-12 bg-black/80 backdrop-blur-xl border border-[var(--accent)]/40 rounded-2xl flex items-center justify-center text-[var(--accent)] shadow-2xl hover:bg-[var(--accent)] hover:text-white transition-all"
         >
            <BrainCircuit size={20} />
         </motion.button>
      )}
    </div>
  );
}
