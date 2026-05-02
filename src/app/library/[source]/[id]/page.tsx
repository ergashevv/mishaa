export const runtime = "edge";
import type { Metadata } from 'next';
import ComicDetailsClient from './ComicDetailsClient';
import { getComicDetails, getChapters } from '@/actions/comic';
import { MangaLanguage } from '@/lib/manga-language';

type RouteParams = {
  source: string;
  id: string;
};

type MetadataProps = {
  params: Promise<RouteParams>;
};

const SITE_NAME = 'iComics Studio';
const DEFAULT_DESCRIPTION = 'The ultimate synthesis environment for independent comic creators.';

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { source, id } = await params;
  const comic = await getComicDetails(source, id);
  
  const title = comic?.title ? `${comic.title} | ${SITE_NAME}` : `${SITE_NAME} | Library`;
  const description = comic?.description || DEFAULT_DESCRIPTION;
  const image = comic?.coverUrl || '/logo.png';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { source, id } = await params;
  
  // Fetch initial data on server in parallel
  const [initialComic, initialChapters] = await Promise.all([
    getComicDetails(source, id),
    getChapters(source, id)
  ]);
  
  return (
    <ComicDetailsClient 
      initialComic={initialComic} 
      initialChapters={initialChapters}
      source={source} 
      id={id} 
    />
  );
}


