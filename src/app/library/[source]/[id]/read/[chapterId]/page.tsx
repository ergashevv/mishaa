export const runtime = "edge";
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { cache } from 'react';
import ComicReaderClient from './ComicReaderClient';
import { getComicDetails, getChapters } from '@/actions/comic';
import { buildComicOpenGraphImage, getPublicSiteUrl } from '@/lib/og-metadata';

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
    `Read ${baseTitle} (${type}) online on iComics.wiki — full-page reader.`;

  const ogImage = buildComicOpenGraphImage(comic?.coverUrl, siteUrl, comic?.title);

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'iComics.wiki',
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
  
  return (
    <ComicReaderClient 
      initialComic={initialComic} 
      initialChapters={initialChapters}
      source={source} 
      id={id}
      chapterId={currentChapterId}
      initialAgeVerified={initialAgeVerified}
    />
  );
}
