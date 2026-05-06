export const runtime = "edge";
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { cache } from 'react';
import ComicDetailsClient from './ComicDetailsClient';
import { getComicDetails as getComicDetailsAction, getChapters } from '@/actions/comic';

const getComicDetails = cache(getComicDetailsAction);

type RouteParams = {
  source: string;
  id: string;
};

type MetadataProps = {
  params: Promise<RouteParams>;
};

type ComicSeoData = {
  title?: string;
  description?: string;
  coverUrl?: string;
  author?: string;
  genres?: string[];
  aniListData?: {
    averageScore?: number;
    status?: string;
    description?: string;
    genres?: string[];
    popularity?: number;
  };
  jikanData?: {
    score?: number;
    status?: string;
    authors?: Array<{ name?: string }>;
    genres?: Array<{ name?: string }>;
    members?: number;
  };
};

const DEFAULT_DESCRIPTION = 'The ultimate synthesis environment for independent comic creators.';

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { source, id } = await params;
  const comic = (await getComicDetails(source, id)) as ComicSeoData | null;
  
  const type = source === 'mangadex' ? 'Manga' : source === 'marvel' ? 'Comic' : 'Webtoon';
  
  // Big Data Enrichment for SEO
  const aniList = comic?.aniListData;
  const jikan = comic?.jikanData;
  
  const ratingText = aniList?.averageScore ? `Rated ${aniList.averageScore}/100` : jikan?.score ? `Rated ${jikan.score}/10` : '';
  const title = comic?.title 
    ? `Read ${comic.title} ${type} Online ${ratingText ? `- ${ratingText}` : ''}` 
    : 'Digital Comic Archive';
    
  // Combine descriptions for maximum SEO density
  const baseDescription = comic?.description || '';
  const aniDescription = aniList?.description?.replace(/<[^>]*>/g, '') || '';
  const finalDescription = `${baseDescription} ${aniDescription}`.slice(0, 160).trim() || DEFAULT_DESCRIPTION;

  const image = comic?.coverUrl || '/logo.png';

  return {
    title,
    description: finalDescription,
    openGraph: {
      title,
      description: finalDescription,
      type: 'article',
      images: [{ url: image }],
      section: type,
      tags: comic?.genres || [type, 'Comics', 'Reading'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: finalDescription,
      images: [image],
    },
    alternates: {
      canonical: `https://icomics.wiki/library/${source}/${id}`,
    }
  };
}

import JsonLd from '@/components/JsonLd';

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { source, id } = await params;
  const cookieStore = await cookies();
  const initialAgeVerified = cookieStore.get('age_verified')?.value === 'true';
  
  const [initialComic, initialChapters] = await Promise.all([
    getComicDetails(source, id),
    getChapters(source, id)
  ]);
  const comicData = initialComic as ComicSeoData | null;

  const comicSchema = comicData ? {
    "@context": "https://schema.org",
    "@type": "Book",
    "name": comicData.title,
    "description": comicData.description,
    "image": comicData.coverUrl,
    "author": {
      "@type": "Person",
      "name": comicData.author || comicData.jikanData?.authors?.[0]?.name || "iComics.wiki Creator"
    },
    "genre": Array.from(new Set([
      ...(comicData.genres || []),
      ...(comicData.aniListData?.genres || []),
      ...(comicData.jikanData?.genres?.map((genre) => genre.name).filter((name): name is string => Boolean(name)) || [])
    ])).join(', '),
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": comicData.aniListData?.averageScore 
        ? (comicData.aniListData.averageScore / 10).toFixed(1)
        : comicData.jikanData?.score 
          ? comicData.jikanData.score.toString()
          : "4.8",
      "bestRating": "10",
      "ratingCount": comicData.aniListData?.popularity || comicData.jikanData?.members || "1000"
    }
  } : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://icomics.wiki"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Library",
        "item": "https://icomics.wiki/library"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": comicData?.title || "Comic",
        "item": `https://icomics.wiki/library/${source}/${id}`
      }
    ]
  };
  
  return (
    <article>
      {comicSchema && <JsonLd data={comicSchema} />}
      {breadcrumbSchema && <JsonLd data={breadcrumbSchema} />}
      <ComicDetailsClient 
      initialComic={initialComic} 
      initialChapters={initialChapters}
      source={source} 
      id={id} 
      initialAgeVerified={initialAgeVerified}
    />
  </article>
  );
}
