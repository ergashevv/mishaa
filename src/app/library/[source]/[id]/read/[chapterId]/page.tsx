import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { cache } from 'react';
import JsonLd from '@/components/JsonLd';
import ComicReaderClient from './ComicReaderClient';
import { getComicDetails, getChapters } from '@/actions/comic';
import { buildComicOpenGraphImage, getPublicSiteUrl } from '@/lib/og-metadata';
import { ICS_SITE_DISPLAY_NAME } from '@/lib/seo/page-metadata';

/** Node.js runtime avoids Edge bundle limits for heavy comic imports. */
export const runtime = 'nodejs';

const getComicDetailsCached = cache(getComicDetails);
const getChaptersCached = cache(getChapters);

type RouteParams = {
  source: string;
  id: string;
  chapterId: string;
};

type MetadataProps = {
  params: Promise<RouteParams>;
};

type ChapterRow = { id: string; title?: string; chapterNum?: string };

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { source, id, chapterId } = await params;
  const siteUrl = getPublicSiteUrl();
  const canonicalUrl = `${siteUrl}/library/${source}/${id}/read/${chapterId}`;

  const [comic, chapters] = await Promise.all([
    getComicDetailsCached(source, id),
    getChaptersCached(source, id),
  ]);

  const chapter = (chapters as ChapterRow[] | null)?.find((c) => c.id === chapterId);
  const chLabel = chapter?.chapterNum || chapter?.title;

  const type = source === 'mangadex' ? 'manga' : source === 'marvel' ? 'comic' : 'series';
  const baseTitle = comic?.title || 'Comic';

  const title = chLabel
    ? `Read ${baseTitle} — Ch. ${chLabel}`
    : `Read ${baseTitle} online`;

  const rawDesc = typeof comic?.description === 'string' ? comic.description : '';
  const description =
    rawDesc.replace(/<[^>]*>/g, '').trim().slice(0, 160) ||
    `Read ${baseTitle} (${type}) online on ${ICS_SITE_DISPLAY_NAME} — full-page reader.`;

  const ogImage = buildComicOpenGraphImage(comic?.coverUrl, siteUrl, comic?.title);

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: ICS_SITE_DISPLAY_NAME,
      locale: 'en_US',
      type: 'article',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage.url],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { source, id, chapterId: currentChapterId } = await params;
  const cookieStore = await cookies();
  const initialAgeVerified = cookieStore.get('age_verified')?.value === 'true';
  
  // Fetch initial data on server in parallel
  const [initialComic, initialChapters] = await Promise.all([
    getComicDetailsCached(source, id),
    getChaptersCached(source, id),
  ]);

  const siteOrigin = getPublicSiteUrl().replace(/\/$/, '');
  const canonicalChapterUrl = `${siteOrigin}/library/${source}/${id}/read/${currentChapterId}`;
  const workUrl = `${siteOrigin}/library/${source}/${id}`;
  const chapterRow = (initialChapters as ChapterRow[] | null)?.find((c) => c.id === currentChapterId);
  const chLabel = chapterRow?.chapterNum || chapterRow?.title;
  const comicTitle = initialComic?.title || 'Comic';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteOrigin },
      { '@type': 'ListItem', position: 2, name: 'Library', item: `${siteOrigin}/library` },
      { '@type': 'ListItem', position: 3, name: comicTitle, item: workUrl },
      {
        '@type': 'ListItem',
        position: 4,
        name: chLabel ? `Chapter ${chLabel}` : 'Chapter',
        item: canonicalChapterUrl,
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <ComicReaderClient
        initialComic={initialComic}
        initialChapters={initialChapters}
        source={source}
        id={id}
        chapterId={currentChapterId}
        initialAgeVerified={initialAgeVerified}
      />
    </>
  );
}
