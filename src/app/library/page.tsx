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
  const shelf = typeof tab === 'string' && tab.trim() ? tab.trim() : 'All shelves';
  const queryTrimmed = typeof q === 'string' ? q.trim() : '';
  const queryLabel = queryTrimmed ? ` · ${queryTrimmed.slice(0, 80)}` : '';

  const title = `${shelf}${queryLabel}`;
  const description = queryTrimmed
    ? `Search “${queryTrimmed.slice(0, 160)}” in the iComics.wiki library (${shelf}). Open any title for chapters, synopsis, and the fullscreen reader.`
    : `Browse “${shelf}” with covers, genres, chapters, synced reading progress — manga hub, Marvel, NHentai catalogs, galleries, reader-first UX on iComics.wiki.`;

  const libraryCanonical =
    tab && !queryTrimmed
      ? `${siteUrl}/library?tab=${encodeURIComponent(tab)}`
      : `${siteUrl}/library`;

  const ogTwitter = openGraphTwitterFromLogo({
    origin: siteUrl,
    pageAbsoluteUrl: libraryCanonical,
    openGraphTitle: title,
    description,
  });

  const base: Metadata = {
    title,
    description,
    ...ogTwitter,
    alternates: {
      canonical: libraryCanonical,
    },
  };

  // Avoid indexing infinite search-parameter URLs; keep link equity to main library.
  if (queryTrimmed) {
    return {
      ...base,
      robots: { index: false, follow: true },
      alternates: { canonical: `${siteUrl}/library` },
      openGraph: {
        ...base.openGraph,
        url: `${siteUrl}/library`,
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
      'Searchable manga, manhwa, Marvel comics, and saved titles — metadata, chapters, and a fullscreen reader with progress syncing on iComics.wiki.',
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
