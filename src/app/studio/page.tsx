import type { Metadata } from "next";
import Link from "next/link";
import Navbar from '@/components/Navbar';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const runtime = "nodejs";

export const metadata: Metadata = staticPageMetadata({
  title: 'Creative Studio',
  description:
    'Creative Studio is not available yet — browse the library and reading hub in the meantime.',
  path: '/studio',
  robots: { index: false, follow: true },
});

/** Archived route: full `ComicCreator` UI is disabled until a future release (see file-end comment block). */
export default function StudioPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#111111]">
      <Navbar />
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-6 px-4 pb-20 pt-28 text-center sm:pt-32">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-neutral-500 dark:text-white/40">
          Coming later
        </p>
        <h1 className="max-w-lg text-xl font-black uppercase tracking-tight text-neutral-900 dark:text-white sm:text-2xl md:text-3xl">
          Creative Studio is planned for a future release.
        </h1>
        <p className="max-w-md text-sm text-neutral-600 dark:text-white/55">
          Heavy creation tools stay out of production builds until we ship them.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/library"
            className="rounded-2xl border border-neutral-200 bg-white px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-900 transition-colors hover:border-[#ff4d00] hover:text-[#ff4d00] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-[#ff4d00]"
          >
            Browse library
          </Link>
          <Link
            href="/reading"
            className="rounded-2xl border border-neutral-200 bg-transparent px-6 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-700 transition-colors hover:border-[#ff4d00] hover:text-[#ff4d00] dark:border-white/15 dark:text-white/80 dark:hover:border-[#ff4d00]"
          >
            Reading hub
          </Link>
        </div>
      </div>
    </div>
  );
}

/*
 * FUTURE — re-enable full Studio (restore imports + default below, remove placeholder above):
 *
 * import ComicCreator from '@/components/ComicCreator';
 *
 * export default function StudioPage() {
 *   return (
 *     <div className="min-h-screen bg-zinc-100 dark:bg-[#111111]">
 *       <Navbar />
 *       <div className="pt-16 sm:pt-20 pb-20">
 *         <ComicCreator />
 *       </div>
 *     </div>
 *   );
 * }
 *
 * Also re-link /studio from Navbar, Footer, gallery CTA, not-found, ComicDetailsClient (superhero), and sitemap staticPaths.
 */
