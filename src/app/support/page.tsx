'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { MessageCircle, Send, LifeBuoy } from 'lucide-react';

function SupportPageContent() {
  const searchParams = useSearchParams();
  const [report, setReport] = useState(() => {
    const category = searchParams.get('category') || 'EXPORT_FAILURE';
    const comic = searchParams.get('comic');
    const source = searchParams.get('source');
    const chapter = searchParams.get('chapter');
    const details = searchParams.get('details') || '';

    return {
      email: searchParams.get('email') || '',
      category,
      details: [
        details,
        comic ? `Comic: ${comic}` : '',
        source ? `Source: ${source}` : '',
        chapter ? `Chapter: ${chapter}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  });

  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = encodeURIComponent(`[iComics] ${report.category}`);
    const body = encodeURIComponent(
      `Reporter: ${report.email || 'anonymous'}\nCategory: ${report.category}\n\n${report.details}`
    );

    window.location.href = `mailto:info@icomics.wiki?subject=${subject}&body=${body}`;
    trackEvent('report_submitted', {
      category: report.category,
      hasEmail: Boolean(report.email),
      detailsLength: report.details.length,
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white overflow-x-hidden dark:bg-[#020202] dark:text-white dark:selection:text-white">
      
      
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-20 sm:pb-28 lg:pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto space-y-16 sm:space-y-24"
        >
          {/* Header */}
          <div className="text-center space-y-6 sm:space-y-8">
            <div className="inline-block bg-black/[0.06] dark:bg-white/10 px-6 py-2 border border-neutral-200 dark:border-white/10 rounded-xl shadow-[6px_6px_0px_#000]">
              <span className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Dispatch Center</span>
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-9xl font-display uppercase tracking-tighter leading-none italic text-balance">
              SUPPORT <br /><span className="text-[#e63946]">PROTOCOLS.</span>
            </h1>
            <p className="text-base sm:text-xl md:text-2xl font-medium opacity-60 max-w-2xl mx-auto">
              Need assistance with your sequential production? Our dispatch team is standing by to help you with any system errors or creative hurdles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 sm:p-10 bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-3xl backdrop-blur-xl flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full border border-neutral-200 dark:border-white/10 rounded-xl bg-white flex items-center justify-center">
                <Send size={32} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Direct Comms</h3>
              <p className="text-sm opacity-60">Reach out directly via email for high-priority system issues.</p>
              <div className="pt-4 border-t-2 border-neutral-100 dark:border-white/5 w-full">
                <a href="mailto:info@icomics.wiki" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e63946] hover:underline">info@icomics.wiki</a>
              </div>
            </div>

            <div className="p-6 sm:p-10 bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-3xl backdrop-blur-xl flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full border border-neutral-200 dark:border-white/10 rounded-xl bg-white flex items-center justify-center">
                <MessageCircle size={32} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Telegram Hub</h3>
              <p className="text-sm opacity-60">Join our community dispatch for instant updates and peer support.</p>
              <div className="pt-4 border-t-2 border-neutral-100 dark:border-white/5 w-full">
                <a href="https://t.me/icomicsuz" target="_blank" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6] hover:underline">@icomicsuz</a>
              </div>
            </div>

            <div className="p-6 sm:p-10 bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-3xl flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full border-4 border-white bg-[#111111] flex items-center justify-center">
                <LifeBuoy size={32} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight">System FAQ</h3>
              <p className="text-sm opacity-40">Documentation on how to master the Identity Forge and Inking Engine.</p>
              <div className="pt-4 border-t-2 border-neutral-200 dark:border-white/10 w-full">
                <a href="/faq" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffca3a] hover:underline">Read Archives</a>
              </div>
            </div>
          </div>

          {/* Form placeholder or CTA */}
          <form onSubmit={submitReport} className="relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-black/[0.04] dark:bg-white/5 p-6 sm:p-10 md:p-16 backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff4d00] border-l-4 border-b-4 border-black  opacity-20" />
            <div className="space-y-8 relative z-10">
              <h2 className="text-3xl sm:text-5xl font-display uppercase tracking-tighter text-balance">System Diagnostic</h2>
              <p className="font-editorial italic text-xl border-l-8 border-neutral-200 dark:border-white/10 pl-8">&quot;Is your character forge experiencing misalignment? Describe the issue and our protocol agents will investigate.&quot;</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Artist ID / Email</label>
                  <input
                    type="text"
                    value={report.email}
                    onChange={(event) => setReport((current) => ({ ...current, email: event.target.value }))}
                    className="w-full bg-transparent border border-neutral-300 dark:border-white/20 rounded-xl px-6 text-white py-4 text-xs font-bold focus:outline-none"
                    placeholder="IDENTIFY_YOURSELF"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Category</label>
                  <select
                    value={report.category}
                    onChange={(event) => setReport((current) => ({ ...current, category: event.target.value }))}
                    className="w-full bg-transparent border border-neutral-300 dark:border-white/20 rounded-xl px-6 text-white py-4 text-xs font-bold focus:outline-none appearance-none"
                  >
                    <option value="CONTENT_ISSUE">CONTENT_ISSUE</option>
                    <option value="IDENTITY_FORGE_ERROR">IDENTITY_FORGE_ERROR</option>
                    <option value="INKING_ENGINE_LAG">INKING_ENGINE_LAG</option>
                    <option value="EXPORT_FAILURE">EXPORT_FAILURE</option>
                    <option value="ACCOUNT_ACCESS">ACCOUNT_ACCESS</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">The Incident Description</label>
                  <textarea
                    value={report.details}
                    onChange={(event) => setReport((current) => ({ ...current, details: event.target.value }))}
                    className="w-full bg-transparent border border-neutral-300 dark:border-white/20 rounded-xl px-6 text-white py-4 text-xs font-bold focus:outline-none min-h-[200px]"
                    placeholder="WHAT_HAPPENED_DURING_PRODUCTION?"
                  />
                </div>
              </div>
              <button type="submit" className="w-full rounded-lg bg-black px-8 py-4 uppercase font-black tracking-widest text-white transition-all sm:w-auto sm:px-16 sm:py-6">
                Submit Report
              </button>
            </div>
          </form>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}

export default function SupportPage() {
  return (
      <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-[#020202]" />}>
      <SupportPageContent />
    </Suspense>
  );
}
