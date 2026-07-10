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
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main className="pt-nav-catalog">
        <article className="wrap max-w-3xl py-14 sm:py-16 lg:py-20">
          <header>
            <div className="flex items-center gap-2 text-fg-muted">
              {icon ? icon : null}
              <span className="ic-eyebrow">{badge}</span>
            </div>
            <h1 className="ic-display mt-5 text-balance text-4xl text-fg sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-fg-secondary md:text-base">
              {subtitle}
            </p>
          </header>

          <hr className="ic-rule mt-10" />

          <div>
            {sections.map((section) => (
              <section
                key={section.title}
                className="border-b border-line-subtle py-8 last:border-b-0 md:py-10"
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
              {footerNote}
            </p>
          </footer>
        </article>
      </main>

      <Footer />
    </div>
  );
}
