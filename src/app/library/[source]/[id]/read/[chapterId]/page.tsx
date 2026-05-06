export const runtime = "edge";
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import ComicReaderClient from './ComicReaderClient';
import { getComicDetails, getChapters } from '@/actions/comic';

type RouteParams = {
  source: string;
  id: string;
  chapterId: string;
};

type MetadataProps = {
  params: Promise<RouteParams>;
};

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { source, id, chapterId: _chapterId } = await params;
  void _chapterId;
  const comic = await getComicDetails(source, id);
  
  const title = comic?.title ? `Reading ${comic.title}` : 'Reader';
  const description = `Read ${comic?.title || 'comics'} online.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
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
    getComicDetails(source, id),
    getChapters(source, id)
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
