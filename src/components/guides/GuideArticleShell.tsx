import type { ReactNode } from 'react';
import Link from 'next/link';
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
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <article className="wrap max-w-5xl py-14 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-16">
            {/* Statement + table of contents, pinned alongside the read */}
            <aside className="rise-in space-y-8 border-b border-line-subtle pb-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start lg:border-b-0 lg:pb-0">
              <header className="space-y-5">
                <div className="flex items-center gap-2 text-fg-muted">
                  {icon ? icon : null}
                  <span className="ic-eyebrow">{badge}</span>
                </div>
                <h1 className="ic-display text-balance text-4xl text-fg sm:text-5xl lg:text-5xl">
                  {title}
                </h1>
                <p className="max-w-md text-sm leading-relaxed text-fg-secondary md:text-base">
                  {subtitle}
                </p>
              </header>

              {sections.length > 1 && (
                <nav aria-label={badge} className="hidden lg:flex lg:flex-col lg:gap-0.5 lg:border-t lg:border-line-subtle lg:pt-6">
                  {sections.map((section, i) => (
                    <a
                      key={section.title}
                      href={`#guide-section-${i}`}
                      className="group -mx-3 flex items-baseline gap-3 rounded-md px-3 py-2 transition-colors duration-150 hover:bg-card-hov"
                    >
                      <span className="font-mono text-[11px] text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                      <span className="line-clamp-1 text-sm text-fg-secondary group-hover:text-fg">{section.title}</span>
                    </a>
                  ))}
                </nav>
              )}
            </aside>

            <div className="rise-in rise-in--late">
              <div>
                {sections.map((section, i) => (
                  <section
                    key={section.title}
                    id={`guide-section-${i}`}
                    className="scroll-mt-28 border-b border-line-subtle py-8 last:border-b-0 md:py-10"
                  >
                    <p className="ic-eyebrow">{section.eyebrow}</p>
                    <h2 className="ic-display mt-3 text-balance text-xl text-fg sm:text-2xl">
                      {section.title}
                    </h2>
                    <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-fg-secondary md:text-base">
                      {section.body}
                    </p>
                  </section>
                ))}
              </div>

              <footer className="mt-10 rounded-card border border-line bg-card p-5 sm:p-6 md:p-8">
                <p className="ic-eyebrow text-accent-text">Keep exploring</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-secondary md:text-base">
                  {/* Route paths in the note ("→ /guides/…") used to print as inert text — linkify them. */}
                  {footerNote.split(/(\/(?:guides|library|reading|faq)(?:\/[\w-]+)*)/g).map((part, i) =>
                    part.startsWith('/') ? (
                      <Link key={i} href={part} className="font-medium text-accent-text underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent">
                        {part}
                      </Link>
                    ) : (
                      part
                    )
                  )}
                </p>
              </footer>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
