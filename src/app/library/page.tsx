import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import ZineLibrary from '@/components/zine/ZineLibrary';
import ZineFooter from '@/components/zine/ZineFooter';
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

/** Streams below the interactive grid so the catalog fetches never block first paint. */
async function BrowseTitlesNav() {
  const browseTitles = await loadBrowseTitles();
  if (browseTitles.length === 0) return null;
  return (
    <nav
      aria-label="Browse popular series"
      className="z-wrap border-t-[3px] border-[var(--z-ink)] py-10"
    >
      <h2 className="z-display mb-5 inline-block -rotate-1 border-[3px] border-[var(--z-ink)] bg-[var(--z-yellow)] px-3 py-1 text-[1.6rem] leading-[0.82] shadow-[4px_4px_0_var(--z-ink)]">
        Popular series
      </h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[14px] sm:grid-cols-3 lg:grid-cols-4">
        {browseTitles.map((item) => (
          <li key={item.id} className="truncate">
            <Link
              href={`/library/mangadex/${item.id}`}
              className="font-bold text-[var(--z-ink-2)] underline-offset-4 transition-colors hover:text-[var(--z-red)] hover:underline"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
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

  return (
    <div className="zine min-h-dvh">
      <Suspense
        fallback={<LibraryRouteLoading />}
      >
        <JsonLd data={collectionSchema} />
        <ZineLibrary initialAgeVerified={initialAgeVerified} />
      </Suspense>
      <Suspense fallback={null}>
        <BrowseTitlesNav />
      </Suspense>
      <ZineFooter />
    </div>
  );
}
