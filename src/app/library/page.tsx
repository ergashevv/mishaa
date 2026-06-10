import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import ComicLibraryClient from '@/components/ComicLibraryClient';
import LibraryRouteLoading from '@/components/LibraryRouteLoading';
import JsonLd from '@/components/JsonLd';
import { searchComics } from '@/actions/comic';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';
import { Suspense } from 'react';
import { UI_LANG_COOKIE } from '@/lib/i18n/cookies';
import { translations } from '@/lib/translations';
import {
  hreflangAlternates,
  openGraphLocaleForUiLang,
  resolveUiLang,
  truncateMeta,
} from '@/lib/seo/ui-locale-public';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; ui?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const { tab, q, ui } = sp;
  const cookieStore = await cookies();
  const uiLang = resolveUiLang(cookieStore.get(UI_LANG_COOKIE)?.value, ui);
  const t = translations[uiLang];

  const siteUrl = getPublicSiteUrl().replace(/\/$/, '');
  const tabTrimmed = typeof tab === 'string' ? tab.trim() : '';
  const shelf = tabTrimmed || '';
  const queryTrimmed = typeof q === 'string' ? q.trim() : '';
  const queryLabel = queryTrimmed ? ` · ${queryTrimmed.slice(0, 80)}` : '';

  const baseLibraryTitle = `${t.nav.library} — ${t.hero.title}`;
  const title = shelf
    ? `${shelf} · manga, hentai & manhwa shelf${queryLabel}`
    : `${baseLibraryTitle}${queryLabel}`;

  const description = queryTrimmed
    ? `Search “${queryTrimmed.slice(0, 160)}” in this manga & hentai browser library (${shelf || 'all shelves'}). MangaDex-style matches, chapters, fullscreen reader on icomics.wiki.`
    : truncateMeta(t.hero.desc);

  /** One hub URL for indexing — shelf tabs are UI facets, not separate landing pages (avoids thin-index dilution). */
  const libraryHubUrl = `${siteUrl}/library`;

  const ogTwitter = openGraphTwitterFromLogo({
    origin: siteUrl,
    pageAbsoluteUrl: libraryHubUrl,
    openGraphTitle: title,
    description,
    openGraphLocale: openGraphLocaleForUiLang(uiLang),
  });

  const base: Metadata = {
    title,
    description,
    ...ogTwitter,
    alternates: {
      canonical: libraryHubUrl,
      languages: hreflangAlternates(siteUrl, '/library'),
    },
  };

  // Avoid indexing infinite search-parameter URLs; keep link equity to main library.
  if (queryTrimmed) {
    return {
      ...base,
      robots: { index: false, follow: true },
      alternates: {
        canonical: libraryHubUrl,
        languages: hreflangAlternates(siteUrl, '/library'),
      },
      openGraph: {
        ...base.openGraph,
        url: libraryHubUrl,
      },
    };
  }

  return base;
}

/** Catalog listing pages pulled server-side for the crawlable browse index. */
const BROWSE_INDEX_PAGES = 3;

/**
 * Server-rendered, crawlable index of popular titles. The interactive library
 * grid ({@link ComicLibraryClient}) fetches client-side, so without this Google
 * sees the hub as a dead end with zero links into the catalog. This passes link
 * equity down to detail pages (safe/suggestive only — searchComics default).
 */
async function loadBrowseTitles(): Promise<{ id: string; title: string }[]> {
  try {
    const pages = await Promise.allSettled(
      Array.from({ length: BROWSE_INDEX_PAGES }, (_, page) =>
        searchComics({ source: 'mangadex', page, query: '' }),
      ),
    );
    const byId = new Map<string, string>();
    for (const result of pages) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value.items) {
        if (item.title && !byId.has(item.id)) {
          byId.set(item.id, item.title);
        }
      }
    }
    return [...byId].map(([id, title]) => ({ id, title }));
  } catch {
    return [];
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const cookieStore = await cookies();
  const initialAgeVerified = cookieStore.get('age_verified')?.value === 'true';

  const siteUrl = getPublicSiteUrl().replace(/\/$/, '');
  const shelf = typeof tab === 'string' && tab.trim() ? tab.trim() : 'All shelves';
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${shelf} · iComics.wiki library`,
    description:
      'Online manga, manhwa & webtoon library hub (MangaDex-style discovery, NHentai & allied sources): searchable titles, age‑verified shelves, chapters, fullscreen browser reader, bookmarks — icomics.wiki.',
    url: `${siteUrl}/library`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Library',
          item: `${siteUrl}/library`,
        },
      ],
    },
  };

  const browseTitles = await loadBrowseTitles();

  return (
    <>
      <Suspense
        fallback={<LibraryRouteLoading />}
      >
        <JsonLd data={collectionSchema} />
        <ComicLibraryClient initialAgeVerified={initialAgeVerified} />
      </Suspense>
      {browseTitles.length > 0 && (
        <nav
          aria-label="Browse popular series"
          className="mx-auto max-w-6xl border-t border-neutral-200 px-4 py-10 dark:border-white/10"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-500 dark:text-zinc-400">
            Popular series
          </h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {browseTitles.map((item) => (
              <li key={item.id} className="truncate">
                <Link
                  href={`/library/mangadex/${item.id}`}
                  className="text-neutral-600 transition-colors hover:text-[#ff4d00] dark:text-zinc-400 dark:hover:text-[#ff4d00]"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
