import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import JsonLd from '@/components/JsonLd';
import { GUIDES_ORDER, guidesIndexMetadata } from '@/lib/guides/registry';
import { buildGuidesIndexItemListJsonLd } from '@/lib/seo/guide-jsonld';

export const metadata = guidesIndexMetadata();

const CHIP = ['var(--z-blue)', 'var(--z-red)', 'var(--z-green)', 'var(--z-purple)', 'var(--z-orange)', 'var(--z-pink)'];

export default function GuidesIndexPage() {
  return (
    <div className="zine min-h-dvh">
      <JsonLd data={buildGuidesIndexItemListJsonLd()} />
      <ZineNav />

      <main id="main-content" tabIndex={-1} className="z-wrap max-w-3xl py-14">
        <header className="mb-12">
          <span className="z-tag z-tag--green inline-flex items-center gap-1.5"><BookOpen size={13} strokeWidth={2.5} /> Editorial</span>
          <h1 className="z-display mt-4 text-[clamp(2.8rem,7vw,5rem)] leading-[0.8]">Reading guides</h1>
          <p className="mt-5 max-w-2xl text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)]">
            Practical explainers for the icomics.wiki library — formats, reader safety, sources, and first visit. For naming confusion with other &ldquo;iComics&rdquo; wikis, see{' '}
            <Link href="/icomics-wiki" className="font-black text-[var(--z-red)] underline underline-offset-4">/icomics-wiki</Link>.
          </p>
        </header>

        <ul className="grid gap-4">
          {GUIDES_ORDER.map((g, i) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="z-box z-pop group flex flex-col p-6 sm:p-7">
                <span className="z-tag w-fit" style={{ background: CHIP[i % CHIP.length], color: '#fff' }}>Guide</span>
                <span className="z-display mt-4 text-[clamp(1.4rem,3vw,2rem)] leading-[0.9]">{g.title}</span>
                <span className="mt-3 text-[14px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{g.description}</span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-extrabold uppercase text-[var(--z-ink)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>Read <ArrowRight size={14} strokeWidth={3} className="transition-transform group-hover:translate-x-1" /></span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-[14px] font-bold text-[var(--z-ink-2)]">
          <Link href="/feed.xml" className="underline underline-offset-4 hover:text-[var(--z-red)]">RSS feed</Link>{' · '}
          <Link href="/reading" className="underline underline-offset-4 hover:text-[var(--z-red)]">Reading hub</Link>{' · '}
          <Link href="/library" className="underline underline-offset-4 hover:text-[var(--z-red)]">Open library</Link>
        </p>
      </main>

      <ZineFooter />
    </div>
  );
}
