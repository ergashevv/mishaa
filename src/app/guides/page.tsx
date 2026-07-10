import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { GUIDES_ORDER, guidesIndexMetadata } from '@/lib/guides/registry';
import { buildGuidesIndexItemListJsonLd } from '@/lib/seo/guide-jsonld';

export const metadata = guidesIndexMetadata();

export default function GuidesIndexPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <JsonLd data={buildGuidesIndexItemListJsonLd()} />
      <Navbar />

      <main className="pt-nav-catalog">
        <div className="wrap max-w-3xl space-y-12 py-14 sm:py-16 lg:py-20">
          <header>
            <div className="flex items-center gap-2 text-fg-muted">
              <BookOpen size={14} className="text-accent" />
              <span className="ic-eyebrow">Editorial</span>
            </div>
            <h1 className="ic-display mt-5 text-balance text-4xl text-fg sm:text-5xl md:text-6xl">
              Reading guides
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-fg-secondary md:text-base">
              Practical explainers for the icomics.wiki manga and comic wiki–style library — formats, reader safety, sources, and first visit. For naming confusion with other “iComics” or Fandom wikis, see{' '}
              <Link href="/icomics-wiki" className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
                /icomics-wiki
              </Link>
              .
            </p>
          </header>

          <ul className="grid gap-4 md:grid-cols-1">
            {GUIDES_ORDER.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guides/${g.slug}`}
                  className="group flex flex-col rounded-card border border-line bg-card p-6 transition-colors duration-150 hover:border-line-strong hover:bg-card-hov sm:p-8"
                >
                  <span className="ic-eyebrow text-accent-text">Guide</span>
                  <span className="ic-display mt-3 text-xl text-fg sm:text-2xl">
                    {g.title}
                  </span>
                  <span className="mt-3 text-sm leading-relaxed text-fg-secondary">{g.description}</span>
                  <span className="mt-5 text-sm font-medium text-fg-muted transition-colors group-hover:text-accent-text">
                    Read →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-center text-sm text-fg-muted">
            <Link href="/feed.xml" className="underline decoration-line underline-offset-4 hover:text-accent-text">
              RSS feed
            </Link>{' '}
            ·{' '}
            <Link href="/reading" className="underline decoration-line underline-offset-4 hover:text-accent-text">
              Reading hub
            </Link>{' '}
            ·{' '}
            <Link href="/library" className="underline decoration-line underline-offset-4 hover:text-accent-text">
              Open library
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
