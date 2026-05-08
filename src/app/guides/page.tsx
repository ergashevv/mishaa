import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { GUIDES_ORDER, guidesIndexMetadata } from '@/lib/guides/registry';

export const metadata = guidesIndexMetadata();

export default function GuidesIndexPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white dark:bg-[#020202] dark:text-white dark:selection:text-white">
      <Navbar />

      <main className="container mx-auto px-4 pb-20 pt-24 sm:px-6 sm:pb-24 sm:pt-28 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="mx-auto max-w-5xl space-y-12">
          <header className="rounded-[2rem] border border-neutral-200 bg-white/90 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] sm:p-8 md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100/90 px-4 py-2 dark:border-white/10 dark:bg-black/30">
              <BookOpen size={14} className="text-[#ff4d00]" />
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/50">
                Editorial
              </span>
            </div>
            <h1 className="mt-6 text-balance text-4xl font-black uppercase leading-[0.95] tracking-tighter text-neutral-900 dark:text-white sm:text-5xl md:text-6xl">
              Reading guides
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-white/45 md:text-base">
              Practical explainers for using the library, understanding comic formats, and configuring reader safety
              settings. Written for new readers and search-friendly discovery.
            </p>
          </header>

          <ul className="grid gap-4 md:grid-cols-1 md:gap-5">
            {GUIDES_ORDER.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guides/${g.slug}`}
                  className="group flex flex-col rounded-[1.75rem] border border-neutral-200 bg-white/90 p-6 backdrop-blur-xl transition-all hover:border-[#ff5a1f]/40 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#ff5a1f]/35 sm:p-8"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.45em] text-[#ff4d00]">Guide</span>
                  <span className="mt-3 text-xl font-black uppercase tracking-tight text-neutral-900 transition-colors group-hover:text-[#ff5a1f] dark:text-white dark:group-hover:text-white">
                    {g.title}
                  </span>
                  <span className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-white/55">{g.description}</span>
                  <span className="mt-5 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-400 dark:text-white/35">
                    Read →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-center text-[10px] font-black uppercase tracking-[0.35em] text-neutral-400 dark:text-white/30">
            <Link href="/feed.xml" className="underline decoration-[#ff5a1f]/50 underline-offset-4 hover:text-[#ff5a1f]">
              RSS feed
            </Link>{' '}
            ·{' '}
            <Link href="/library" className="underline decoration-[#ff5a1f]/50 underline-offset-4 hover:text-[#ff5a1f]">
              Open library
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
