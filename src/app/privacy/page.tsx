'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Eye, Lock, FileText } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white overflow-x-hidden dark:bg-[#020202] dark:text-white dark:selection:text-white">
      
      
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-20 sm:pb-28 lg:pb-32">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header Panel */}
          <div className="relative mb-16 overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-[#0a0a0a] p-6 sm:p-10 md:p-16 text-center">
             <div className="absolute inset-0  opacity-15" />
             <div className="relative z-10 space-y-6">
                <div className="w-24 h-24 bg-[#ff4d00] border-4 border-neutral-900 mx-auto dark:border-white flex items-center justify-center rotate-12 shadow-[8px_8px_0px_#000]">
                   <Shield size={48} className="text-white" />
                </div>
                <h1 className="text-balance text-4xl font-display uppercase italic leading-none tracking-tighter text-neutral-900 sm:text-6xl md:text-8xl dark:text-white">
                   PRIVACY <br />PROTECTION.
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-500 opacity-90 dark:opacity-40">Classification: Top Secret // Artist Shield Protocol</p>
             </div>
          </div>

          <div className="space-y-12 sm:space-y-16">
             <section className="space-y-6 sm:space-y-8">
                <div className="flex items-center gap-4 sm:gap-6">
                   <div className="w-12 h-12 bg-[#ff4d00] border border-neutral-200 dark:border-white/10 rounded-xl flex items-center justify-center text-white shadow-[4px_4px_0px_#000]">
                      <Eye size={24} className="text-white" />
                   </div>
                   <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-balance text-neutral-900 dark:text-white">01. OBSERVATION DATA</h2>
                </div>
                <p className="text-sm sm:text-lg text-neutral-600 dark:text-white/60 leading-relaxed font-medium pl-0 sm:pl-16">
                   We only monitor what is essential for the synthesis process. This includes your artist alias, identity reference files, and narrative session data. Your intellectual property—the stories you forge—remains exclusively yours.
                </p>
             </section>

             <section className="space-y-6 sm:space-y-8">
                <div className="flex items-center gap-4 sm:gap-6">
                   <div className="w-12 h-12 rounded-xl border border-neutral-200 bg-neutral-200/80 flex items-center justify-center text-neutral-900 shadow-[4px_4px_0px_#000] dark:border-white/10 dark:bg-white/10 dark:text-white">
                      <Lock size={24} />
                   </div>
                   <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-balance text-neutral-900 dark:text-white">02. CIPHER PROTECTION</h2>
                </div>
                <p className="text-sm sm:text-lg text-neutral-600 dark:text-white/60 leading-relaxed font-medium pl-0 sm:pl-16">
                   Every session on icomics.wiki is encrypted via industry-level ciphers. Your Identity Forge files are stored in a secured digital bunker and are never shared with external third-party agencies.
                </p>
             </section>

             <section className="space-y-6 sm:space-y-8">
                <div className="flex items-center gap-4 sm:gap-6">
                   <div className="w-12 h-12 bg-[#ff4d00] border border-neutral-200 dark:border-white/10 rounded-xl flex items-center justify-center text-white shadow-[4px_4px_0px_#000]">
                      <FileText size={24} className="text-white" />
                   </div>
                   <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-balance text-neutral-900 dark:text-white">03. PROTOCOL UPDATES</h2>
                </div>
                <p className="text-sm sm:text-lg text-neutral-600 dark:text-white/60 leading-relaxed font-medium pl-0 sm:pl-16">
                   As the iComics.wiki Synthesis Protocol evolves, so do our privacy shields. We will always notify our registered artists via their dispatch coordinates (email) before implementing any major data shifts.
                </p>
             </section>

             <div className="rounded-xl border border-dashed border-neutral-200 dark:border-white/10 bg-white p-6 sm:p-12 text-center space-y-4 text-neutral-600 dark:text-white/60">
                <p className="text-sm font-black uppercase tracking-[0.3em]">Official iComics.wiki Privacy Registry v1.0.2</p>
                <div className="text-[9px] font-medium max-w-lg mx-auto">
                   By engaging with the synthesis engine at icomics.wiki, you agree to these protective protocols. If you have concerns about your digital shadow, contact info@icomics.wiki.
                </div>
             </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
