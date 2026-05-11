import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import ComicLibraryClient from '@/components/ComicLibraryClient';
import LibraryRouteLoading from '@/components/LibraryRouteLoading';
import JsonLd from '@/components/JsonLd';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';
import { Suspense } from 'react';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}): Promise<Metadata> {
  const { tab, q } = await searchParams;
  const siteUrl = getPublicSiteUrl().replace(/\/$/, '');
  const tabTrimmed = typeof tab === 'string' ? tab.trim() : '';
  const shelf = tabTrimmed || '';
  const queryTrimmed = typeof q === 'string' ? q.trim() : '';
  const queryLabel = queryTrimmed ? ` · ${queryTrimmed.slice(0, 80)}` : '';

  const baseLibraryTitle = 'Manga, hentai & manhwa — MangaDex-style library (browser)';
  const title = shelf
    ? `${shelf} · manga, hentai & manhwa shelf${queryLabel}`
    : `${baseLibraryTitle}${queryLabel}`;

  const description = queryTrimmed
    ? `Search “${queryTrimmed.slice(0, 160)}” in this manga & hentai browser library (${shelf || 'all shelves'}). MangaDex-style matches, chapters, fullscreen reader on icomics.wiki.`
    : `Browse manga, hentai & manhwa online—MangaDex-style discovery, vertical webtoons, age‑verified adult / hentai‑oriented shelves, NHentai & allied sources: covers, genres, chapter list, bookmarks. Independent reader at icomics.wiki—not MangaDex.org.`;

  /** One hub URL for indexing — shelf tabs are UI facets, not separate landing pages (avoids thin-index dilution). */
  const libraryHubUrl = `${siteUrl}/library`;

  const ogTwitter = openGraphTwitterFromLogo({
    origin: siteUrl,
    pageAbsoluteUrl: libraryHubUrl,
    openGraphTitle: title,
    description,
  });

  const base: Metadata = {
    title,
    description,
    ...ogTwitter,
    alternates: {
      canonical: libraryHubUrl,
    },
  };

  // Avoid indexing infinite search-parameter URLs; keep link equity to main library.
  if (queryTrimmed) {
    return {
      ...base,
      robots: { index: false, follow: true },
      alternates: { canonical: libraryHubUrl },
      openGraph: {
        ...base.openGraph,
        url: libraryHubUrl,
      },
    };
  }

  return base;
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
    <Suspense
      fallback={<LibraryRouteLoading />}
    >
      <JsonLd data={collectionSchema} />
      <ComicLibraryClient initialAgeVerified={initialAgeVerified} />
    </Suspense>
  );
}
