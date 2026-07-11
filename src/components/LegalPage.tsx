'use client';

/**
 * LegalPage — shared shell for terms / privacy / dmca / content-policy, rebuilt in the Bold Pop
 * Zine language. Prop-driven, so every legal page flips at once. Content (the clauses) is passed
 * in by each page and preserved verbatim.
 */

import type { ReactNode } from 'react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';

export type LegalSection = { eyebrow: string; title: string; body: string };

type LegalPageProps = {
  badge: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  sections: LegalSection[];
  footerNote: string;
};

export default function LegalPage({ badge, title, subtitle, icon, sections, footerNote }: LegalPageProps) {
  return (
    <div className="zine min-h-dvh">
      <ZineNav />

      <main id="main-content" tabIndex={-1} className="z-wrap max-w-5xl py-14">
        <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-14">
          {/* Statement + TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <span className="z-tag z-tag--ink inline-flex items-center gap-1.5">{icon}{badge}</span>
            <h1 className="z-display mt-4 text-[clamp(2.4rem,5vw,3.6rem)] leading-[0.82]">{title}</h1>
            <p className="mt-4 max-w-md text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{subtitle}</p>

            <nav aria-label={badge} className="mt-7 hidden border-t-[2.5px] border-[var(--z-ink)] pt-5 lg:block">
              {sections.map((s, i) => (
                <a key={s.title} href={`#legal-section-${i}`} className="group flex items-baseline gap-3 py-1.5">
                  <span className="text-[12px] font-black text-[var(--z-red)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="line-clamp-1 text-[14px] font-bold text-[var(--z-ink-2)] group-hover:text-[var(--z-ink)]">{s.title}</span>
                </a>
              ))}
            </nav>
          </aside>

          <div>
            {sections.map((s, i) => (
              <section key={s.title} id={`legal-section-${i}`} className="scroll-mt-28 border-b-[2.5px] border-[var(--z-ink)] py-8 last:border-b-0">
                <span className="z-kicker text-[var(--z-ink-2)]">{s.eyebrow}</span>
                <h2 className="z-display mt-2 text-[clamp(1.4rem,3vw,2rem)] leading-[0.9]">{s.title}</h2>
                <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-[var(--z-ink-2)]">{s.body}</p>
              </section>
            ))}

            <section className="z-box mt-10 p-6" style={{ background: 'var(--z-yellow)' }}>
              <span className="z-kicker text-[var(--z-ink)]">Final note</span>
              <p className="mt-3 whitespace-pre-line text-[15px] font-semibold leading-relaxed text-[var(--z-ink)]">{footerNote}</p>
            </section>
          </div>
        </div>
      </main>

      <ZineFooter />
    </div>
  );
}
