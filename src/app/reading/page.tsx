import Link from 'next/link';
import { BookMarked, Rss, Library } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata = staticPageMetadata({
  title: 'Reading hub — guides, RSS & library',
  description:
    'Central index for reading manga and comics on iComics.wiki: editorial guides, RSS updates, FAQ, and the multi-source library.',
  path: '/reading',
  keywords: [
    'reading hub manga',
    'icomics wiki RSS',
    'manga library index',
    'comic guides',
    'read manga online',
    'manhwa resources',
    'FAQ comics',
    'how to find manga chapters',
  ],
});

export default function ReadingHubPage() {
  const cards = [
    {
      href: '/guides',
      title: 'Guides',
      body: 'Step-by-step explainers for formats, sources, age settings, and first-time reader setup.',
      icon: BookMarked,
    },
    {
      href: '/feed.xml',
      title: 'RSS feed',
      body: 'Subscribe in any reader — highlights when guides and hub pages refresh (/feed mirrors the same payload).',
      icon: Rss,
    },
    {
      href: '/library',
      title: 'Library',
      body: 'Browse MangaDex titles, Marvel issues, and additional catalogs from one reader-focused grid.',
      icon: Library,
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-neutral-900 selection:bg-[#ff4d00] selection:text-white dark:bg-[#020202] dark:text-white dark:selection:text-white">
      <Navbar />

      <main className="container mx-auto px-4 pb-20 pt-24 sm:px-6 sm:pb-28 sm:pt-28 lg:px-8 lg:pb-32 lg:pt-36">
        <header className="mx-auto max-w-4xl space-y-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.45em] text-[#ff4d00]">Discovery</p>
          <h1 className="text-balance text-4xl font-black uppercase tracking-tighter text-neutral-900 dark:text-white sm:text-5xl md:text-6xl">
            Reading hub
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-white/55 md:text-base">
            This page bundles the editorial URLs we want search engines and readers to discover together: structured guides,
            syndicated updates, and the catalog entry points that power long-tail queries such as &quot;how to read manga
            online&quot; or &quot;manga vs webtoon&quot;.
          </p>
        </header>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {cards.map(({ href, title, body, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-[1.75rem] border border-neutral-200 bg-white/90 p-6 backdrop-blur-xl transition-all hover:border-[#ff5a1f]/45 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#ff5a1f]/35 sm:p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-[#ff5a1f] dark:border-white/10 dark:bg-black/40">
                <Icon size={22} strokeWidth={2} />
              </div>
              <h2 className="mt-5 text-lg font-black uppercase tracking-tight text-neutral-900 transition-colors group-hover:text-[#ff5a1f] dark:text-white dark:group-hover:text-white">
                {title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-600 dark:text-white/55">{body}</p>
              <span className="mt-6 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-400 dark:text-white/35">
                Open →
              </span>
            </Link>
          ))}
        </div>

        <section className="mx-auto mt-16 max-w-3xl rounded-[1.75rem] border border-neutral-200 bg-white/90 p-8 text-sm leading-relaxed text-neutral-700 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65 md:p-10">
          <h2 className="text-[10px] font-black uppercase tracking-[0.45em] text-[#ff4d00]">Internal discovery</h2>
          <p className="mt-4">
            Pair this hub with{' '}
            <Link href="/faq" className="font-semibold text-[#ff5a1f] underline decoration-[#ff5a1f]/40 underline-offset-4">
              FAQ
            </Link>{' '}
            for policy questions and{' '}
            <Link href="/support" className="font-semibold text-[#ff5a1f] underline decoration-[#ff5a1f]/40 underline-offset-4">
              Support
            </Link>{' '}
            when chapters fail to load. Editorial guides stay evergreen; RSS picks up structural updates automatically.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
