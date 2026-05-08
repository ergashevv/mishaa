import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export type GuideSection = {
  eyebrow: string;
  title: string;
  body: string;
};

type GuideArticleShellProps = {
  badge: string;
  title: string;
  subtitle: string;
  icon?: ReactNode;
  sections: GuideSection[];
  footerNote: string;
};

export default function GuideArticleShell({
  badge,
  title,
  subtitle,
  icon,
  sections,
  footerNote,
}: GuideArticleShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white dark:bg-[#020202] dark:text-white dark:selection:text-white">
      <Navbar />

      <main className="container mx-auto px-4 pb-20 pt-24 sm:px-6 sm:pb-24 sm:pt-28 lg:px-8 lg:pb-28 lg:pt-32">
        <article className="mx-auto max-w-5xl space-y-12">
          <header className="rounded-[2rem] border border-neutral-200 bg-white/90 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] sm:p-8 md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100/90 px-4 py-2 dark:border-white/10 dark:bg-black/30">
              {icon ? (
                icon
              ) : (
                <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ff4d00]">Guide</span>
              )}
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/50">
                {badge}
              </span>
            </div>
            <h1 className="mt-6 text-balance text-4xl font-black uppercase leading-[0.95] tracking-tighter text-neutral-900 dark:text-white sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-white/45 md:text-base">
              {subtitle}
            </p>
          </header>

          <div className="space-y-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-[1.75rem] border border-neutral-200 bg-white/90 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] sm:p-6 md:p-8"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">{section.eyebrow}</p>
                <h2 className="mt-3 text-balance text-xl font-black uppercase tracking-tight text-neutral-900 dark:text-white sm:text-2xl md:text-3xl">
                  {section.title}
                </h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-neutral-600 dark:text-white/55 md:text-base">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <footer className="rounded-[1.75rem] border border-[#ff4d00]/20 bg-[#ff4d00]/10 p-5 sm:p-6 md:p-8">
            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#ff4d00]">Keep exploring</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-800 dark:text-white/70 md:text-base">
              {footerNote}
            </p>
          </footer>
        </article>
      </main>

      <Footer />
    </div>
  );
}
