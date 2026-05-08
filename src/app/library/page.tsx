import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import ComicLibraryClient from '@/components/ComicLibraryClient';
import JsonLd from '@/components/JsonLd';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { Suspense } from 'react';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}): Promise<Metadata> {
  const { tab, q } = await searchParams;
  const siteUrl = getPublicSiteUrl().replace(/\/$/, '');
  const category = tab || 'Comics';
  const queryTrimmed = typeof q === 'string' ? q.trim() : '';
  const queryLabel = queryTrimmed ? ` — search: ${queryTrimmed.slice(0, 80)}` : '';

  const title = `${category}${queryLabel}`;
  const description = `Browse our extensive collection of ${category}. Find manga, manhwa, and Marvel comics in the iComics.wiki library.`;

  const libraryCanonical =
    tab && !queryTrimmed
      ? `${siteUrl}/library?tab=${encodeURIComponent(tab)}`
      : `${siteUrl}/library`;

  const base: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      url: libraryCanonical,
      siteName: 'iComics.wiki',
    },
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
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${tab || 'Comic'} Collection | iComics.wiki`,
    description: 'A curated collection of digital comics, manga, and graphic novels.',
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
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-black uppercase tracking-[0.5em] text-neutral-300 dark:bg-black dark:text-white/20">
          Loading library
        </div>
      }
    >
      <JsonLd data={collectionSchema} />
      <ComicLibraryClient initialAgeVerified={initialAgeVerified} />
    </Suspense>
  );
}
