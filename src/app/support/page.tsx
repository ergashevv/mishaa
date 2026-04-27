'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { MessageCircle, Send, LifeBuoy } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#fcfaf2] text-[#111111] selection:bg-[#ffca3a] selection:text-black overflow-x-hidden halftone-bg">
      <div className="noise-overlay" />
      <div className="paper-grain" />
      <Navbar />

      <main className="container mx-auto px-8 pt-48 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto space-y-24"
        >
          {/* Header */}
          <div className="text-center space-y-8">
            <div className="inline-block bg-[#3b82f6] px-6 py-2 border-3 border-black shadow-[6px_6px_0px_#000]">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Dispatch Center</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-display uppercase tracking-tighter leading-none italic">
              SUPPORT <br /><span className="text-[#e63946]">PROTOCOLS.</span>
            </h1>
            <p className="text-xl md:text-2xl font-medium opacity-60 max-w-2xl mx-auto">
              Need assistance with your sequential production? Our dispatch team is standing by to help you with any system errors or creative hurdles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="studio-panel p-10 bg-white border-4 border-black shadow-[10px_10px_0px_#ffca3a] flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full border-4 border-black bg-white flex items-center justify-center">
                <Send size={32} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Direct Comms</h3>
              <p className="text-sm opacity-60">Reach out directly via email for high-priority system issues.</p>
              <div className="pt-4 border-t-2 border-black/5 w-full">
                <a href="mailto:info@comics.uz" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e63946] hover:underline">info@comics.uz</a>
              </div>
            </div>

            <div className="studio-panel p-10 bg-white border-4 border-black shadow-[10px_10px_0px_#3b82f6] flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full border-4 border-black bg-white flex items-center justify-center">
                <MessageCircle size={32} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Telegram Hub</h3>
              <p className="text-sm opacity-60">Join our community dispatch for instant updates and peer support.</p>
              <div className="pt-4 border-t-2 border-black/5 w-full">
                <a href="https://t.me/icomicsuz" target="_blank" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6] hover:underline">@icomicsuz</a>
              </div>
            </div>

            <div className="studio-panel p-10 bg-[#111111] text-white border-4 border-black shadow-[10px_10px_0px_#e63946] flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full border-4 border-white bg-[#111111] flex items-center justify-center">
                <LifeBuoy size={32} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight">System FAQ</h3>
              <p className="text-sm opacity-40">Documentation on how to master the Identity Forge and Inking Engine.</p>
              <div className="pt-4 border-t-2 border-white/10 w-full">
                <a href="/faq" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffca3a] hover:underline">Read Archives</a>
              </div>
            </div>
          </div>

          {/* Form placeholder or CTA */}
          <div className="studio-panel p-16 bg-white border-4 border-black shadow-[20px_20px_0px_#000] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffca3a] border-l-4 border-b-4 border-black halftone-bg opacity-20" />
            <div className="space-y-8 relative z-10">
              <h2 className="text-5xl font-display uppercase tracking-tighter">System Diagnostic</h2>
              <p className="font-editorial italic text-xl border-l-8 border-black/10 pl-8">&quot;Is your character forge experiencing misalignment? Describe the issue and our protocol agents will investigate.&quot;</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Artist ID / Email</label>
                  <input type="text" className="w-full bg-white border-3 border-black px-6 py-4 text-xs font-bold focus:outline-none" placeholder="IDENTIFY_YOURSELF" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Category</label>
                  <select className="w-full bg-white border-3 border-black px-6 py-4 text-xs font-bold focus:outline-none appearance-none">
                    <option>IDENTITY_FORGE_ERROR</option>
                    <option>INKING_ENGINE_LAG</option>
                    <option>EXPORT_FAILURE</option>
                    <option>ACCOUNT_ACCESS</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">The Incident Description</label>
                  <textarea className="w-full bg-white border-3 border-black px-6 py-4 text-xs font-bold focus:outline-none min-h-[200px]" placeholder="WHAT_HAPPENED_DURING_PRODUCTION?" />
                </div>
              </div>
              <button className="brutalist-button w-full sm:w-auto px-16 py-6 bg-black text-white">
                Submit Report
              </button>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
