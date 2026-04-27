'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Eye, Lock, FileText } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fcfaf2] text-[#111111] selection:bg-[#ffca3a] selection:text-black overflow-x-hidden halftone-bg">
      <div className="noise-overlay" />
      <div className="paper-grain" />
      <Navbar />

      <main className="container mx-auto px-8 pt-48 pb-32">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header Panel */}
          <div className="studio-panel p-16 bg-[#111111] text-white border-4 border-black shadow-[15px_15px_0px_#e63946] mb-24 relative overflow-hidden text-center">
             <div className="absolute inset-0 halftone-bg opacity-15" />
             <div className="relative z-10 space-y-6">
                <div className="w-24 h-24 bg-[#e63946] border-4 border-white mx-auto flex items-center justify-center rotate-12 shadow-[8px_8px_0px_#000]">
                   <Shield size={48} className="text-white" />
                </div>
                <h1 className="text-6xl md:text-8xl font-display uppercase tracking-tighter leading-none italic">
                   PRIVACY <br />PROTECTION.
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Classification: Top Secret // Artist Shield Protocol</p>
             </div>
          </div>

          <div className="space-y-16">
             <section className="space-y-8">
                <div className="flex items-center gap-6">
                   <div className="w-12 h-12 bg-[#ffca3a] border-3 border-black flex items-center justify-center shadow-[4px_4px_0px_#000]">
                      <Eye size={24} />
                   </div>
                   <h2 className="text-3xl font-black uppercase tracking-tight">01. OBSERVATION DATA</h2>
                </div>
                <p className="text-lg opacity-60 leading-relaxed font-medium pl-16">
                   We only monitor what is essential for the synthesis process. This includes your artist alias, identity reference files, and narrative session data. Your intellectual property—the stories you forge—remains exclusively yours.
                </p>
             </section>

             <section className="space-y-8">
                <div className="flex items-center gap-6">
                   <div className="w-12 h-12 bg-[#3b82f6] border-3 border-black text-white flex items-center justify-center shadow-[4px_4px_0px_#000]">
                      <Lock size={24} />
                   </div>
                   <h2 className="text-3xl font-black uppercase tracking-tight">02. CIPHER PROTECTION</h2>
                </div>
                <p className="text-lg opacity-60 leading-relaxed font-medium pl-16">
                   Every session on icomics.uz is encrypted via industry-level ciphers. Your Identity Forge files are stored in a secured digital bunker and are never shared with external third-party agencies.
                </p>
             </section>

             <section className="space-y-8">
                <div className="flex items-center gap-6">
                   <div className="w-12 h-12 bg-[#e63946] border-3 border-black text-white flex items-center justify-center shadow-[4px_4px_0px_#000]">
                      <FileText size={24} />
                   </div>
                   <h2 className="text-3xl font-black uppercase tracking-tight">03. PROTOCOL UPDATES</h2>
                </div>
                <p className="text-lg opacity-60 leading-relaxed font-medium pl-16">
                   As the iComics Synthesis Protocol evolves, so do our privacy shields. We will always notify our registered artists via their dispatch coordinates (email) before implementing any major data shifts.
                </p>
             </section>

             <div className="p-12 border-4 border-black border-dashed bg-white halftone-bg opacity-60 text-center space-y-4">
                <p className="text-sm font-black uppercase tracking-[0.3em]">Official iComics Privacy Registry v1.0.2</p>
                <div className="text-[9px] font-medium max-w-lg mx-auto">
                   By engaging with the synthesis engine at icomics.uz, you agree to these protective protocols. If you have concerns about your digital shadow, contact info@comics.uz.
                </div>
             </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
