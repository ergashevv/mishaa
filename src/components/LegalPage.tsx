'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export type LegalSection = {
  eyebrow: string;
  title: string;
  body: string;
};

type LegalPageProps = {
  badge: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  sections: LegalSection[];
  footerNote: string;
};

export default function LegalPage({
  badge,
  title,
  subtitle,
  icon,
  sections,
  footerNote,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white overflow-x-hidden dark:bg-[#020202] dark:text-white dark:selection:text-white">
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-20 sm:pb-24 lg:pb-28">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-12">
          <section className="rounded-[2rem] border border-neutral-200 bg-white/90 p-6 sm:p-8 md:p-12 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100/90 px-4 py-2 dark:border-white/10 dark:bg-black/30">
              {icon}
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/50">{badge}</span>
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] text-balance text-neutral-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-neutral-600 leading-relaxed md:text-base dark:text-white/45">{subtitle}</p>
          </section>

          <section className="space-y-4">
            {sections.map((section) => (
              <div key={section.title} className="rounded-[1.75rem] border border-neutral-200 bg-white/90 p-5 sm:p-6 md:p-8 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">{section.eyebrow}</p>
                <h2 className="mt-3 text-xl font-black uppercase tracking-tight text-balance text-neutral-900 sm:text-2xl md:text-3xl dark:text-white">{section.title}</h2>
                <p className="mt-4 text-sm text-neutral-600 leading-relaxed whitespace-pre-line md:text-base dark:text-white/55">{section.body}</p>
              </div>
            ))}
          </section>

          <section className="rounded-[1.75rem] border border-[#ff4d00]/20 bg-[#ff4d00]/10 p-5 sm:p-6 md:p-8">
            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">Final Note</p>
            <p className="mt-3 text-sm text-neutral-800 leading-relaxed whitespace-pre-line md:text-base dark:text-white/70">{footerNote}</p>
          </section>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
