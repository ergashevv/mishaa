'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, BookOpen, UserPlus, Zap, ChevronRight, Check } from 'lucide-react';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCharacter: () => void;
  onStartPage: () => void;
  t: (key: string) => string;
}

export function OnboardingWizard({ isOpen, onClose, onStartCharacter, onStartPage, t }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to the comic studio',
      subtitle: 'XUSH KELIBSIZ! / ДОБРО ПОЖАЛОВАТЬ!',
      desc: 'This workspace helps you sketch pages and characters—no terminal jargon required. Take a minute to see where everything lives.',
      icon: Sparkles,
      action: () => setStep(1),
      btnText: 'Start tour',
    },
    {
      title: '1. Characters',
      subtitle: 'QAHRAMONLAR / ПЕРСОНАЖИ',
      desc: 'Add heroes and villains from the character library—or import looks from public reference catalogs—so panels always star the same cast.',
      icon: UserPlus,
      action: () => {
        onStartCharacter();
        setStep(2);
      },
      btnText: 'Open character builder',
    },
    {
      title: '2. Pages & layouts',
      subtitle: 'SAHIFA / СТРАНИЦА',
      desc: 'Add pages on the artboard; panels arrange in rows so reading order stays obvious on every screen.',
      icon: BookOpen,
      action: () => {
        onStartPage();
        setStep(3);
      },
      btnText: 'Add first page',
    },
    {
      title: '3. Panel art',
      subtitle: 'YARATISH / ГЕНЕРАЦИЯ',
      desc: 'Click a panel, describe the shot, and let the generator turn your script beat into usable comic art.',
      icon: Zap,
      action: () => onClose(),
      btnText: 'Start creating',
    },
  ];

  const current = steps[step];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white border-[12px] border-black shadow-[30px_30px_0_var(--accent)] overflow-hidden"
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-black/5">
              <motion.div 
                className="h-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>

            <div className="p-12 space-y-10">
              <div className="flex items-start justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-widest">
                    <current.icon size={14} />
                    <span>Quick tour</span>
                  </div>
                  <h2 className="text-5xl font-accent uppercase leading-none tracking-tighter text-black">{current.title}</h2>
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.5em]">{current.subtitle}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <X size={24} className="text-black/20 hover:text-black" />
                </button>
              </div>

              <div className="p-8 border-4 border-black/5 bg-black/[0.02] rounded-2xl">
                <p className="text-xl font-bold leading-relaxed text-black/70 italic">
                  "{current.desc}"
                </p>
              </div>

              <div className="flex items-center justify-between pt-8 border-t-2 border-black/5">
                <div className="flex gap-2">
                  {steps.map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full border-2 border-black transition-colors ${i === step ? 'bg-black' : 'bg-transparent opacity-20'}`} />
                  ))}
                </div>
                
                <button 
                  onClick={current.action}
                  className="group flex items-center gap-4 px-10 py-5 bg-black text-white font-accent uppercase tracking-widest text-lg hover:bg-[var(--accent)] transition-all shadow-[8px_8px_0_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  <span>{current.btnText}</span>
                  <ChevronRight size={20} className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>

            {/* Aesthetic Tech Overlay */}
            <div className="absolute bottom-4 left-4 text-[7px] font-black text-black/10 uppercase tracking-widest pointer-events-none">
              Guided tour · tips as you build
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
