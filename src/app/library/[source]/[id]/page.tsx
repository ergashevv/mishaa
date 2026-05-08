import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { cache } from 'react';
import JsonLd from '@/components/JsonLd';
import ComicDetailsClient from './ComicDetailsClient';
import MangaDexUnresolvedPanel from '@/components/MangaDexUnresolvedPanel';
import { getComicDetails as getComicDetailsAction, getChapters } from '@/actions/comic';
import { fetchAniListManga } from '@/lib/anilist';
import {
  cacheMangaDexIdResolution,
  getCachedMangaDexIdResolution,
  isMangaDexUuid,
  resolveMangaDexIdFromTitle,
} from '@/lib/mangadex';
import { buildComicOpenGraphImage, getPublicSiteUrl, toAbsoluteAssetUrl } from '@/lib/og-metadata';
import { ICS_SITE_DISPLAY_NAME, openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';

export const runtime = 'nodejs';

const getComicDetails = cache(getComicDetailsAction);

async function resolveMangaDexRouteId(source: string, id: string) {
  if (source !== 'mangadex' || isMangaDexUuid(id)) {
    return id;
  }

  const cached = getCachedMangaDexIdResolution(id);
  if (cached) {
    return cached;
  }

  const aniList = await fetchAniListManga(id);
  const title = aniList?.title.userPreferred || aniList?.title.english || aniList?.title.romaji;
  if (!title) {
    return id;
  }

  const resolved = (await resolveMangaDexIdFromTitle(title)) || id;
  cacheMangaDexIdResolution(id, resolved);
  return resolved;
}

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

function buildAggregateRating(comicData: ComicSeoData): Record<string, unknown> | null {
  const aniAvg = comicData.aniListData?.averageScore;
  const jScore = comicData.jikanData?.score;

  if (typeof aniAvg === 'number' && aniAvg > 0) {
    const row: Record<string, unknown> = {
      '@type': 'AggregateRating',
      ratingValue: (aniAvg / 10).toFixed(1),
      bestRating: '10',
      worstRating: '1',
    };
    const pop = comicData.aniListData?.popularity;
    if (typeof pop === 'number' && pop > 0) {
      row.ratingCount = Math.min(Math.max(Math.round(pop), 1), 1_000_000);
    }
    return row;
  }

  if (typeof jScore === 'number' && jScore > 0) {
    const row: Record<string, unknown> = {
      '@type': 'AggregateRating',
      ratingValue: String(jScore),
      bestRating: '10',
      worstRating: '1',
    };
    const members = comicData.jikanData?.members;
    if (typeof members === 'number' && members > 0) {
      row.ratingCount = Math.min(Math.max(members, 1), 1_000_000);
    }
    return row;
  }

  return null;
}

const DEFAULT_DESCRIPTION =
  'Read this series online on iComics.wiki — synopsis, chapter list, community scores, fullscreen reader, synced progress.';

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { source, id } = await params;
  const resolvedId = await resolveMangaDexRouteId(source, id);
  const resolved = source !== 'mangadex' || isMangaDexUuid(id) || resolvedId !== id;

  if (source === 'mangadex' && !resolved) {
    const origin = getPublicSiteUrl().replace(/\/$/, '');
    const staleUrl = `${origin}/library/${source}/${id}`;
    const headDescription =
      'This bookmark used an older MangaDex ID. Discover the series again via the manga library search or catalogue on iComics.wiki.';
    return {
      metadataBase: new URL(origin),
      title: `Outdated manga link · ${ICS_SITE_DISPLAY_NAME}`,
      description: headDescription,
      ...openGraphTwitterFromLogo({
        origin,
        pageAbsoluteUrl: staleUrl,
        openGraphTitle: 'Outdated manga link',
        twitterTitle: `Outdated manga link | ${ICS_SITE_DISPLAY_NAME}`,
        openGraphDescription:
          `Open ${ICS_SITE_DISPLAY_NAME} to browse manga, manhwa, and comics this URL no longer resolves.`,
        twitterDescription:
          'This URL no longer resolves. Browse the manga and comics library for current catalog links.',
      }),
      alternates: {
        canonical: staleUrl,
      },
      robots: { index: false, follow: true },
    };
  }

  const comic = (await getComicDetails(source, resolvedId)) as ComicSeoData | null;

  const siteUrl = getPublicSiteUrl();
  const canonicalUrl = `${siteUrl}/library/${source}/${resolvedId}`;

  const type = source === 'mangadex' ? 'Manga' : source === 'marvel' ? 'Comic' : 'Webtoon';

  // Big Data Enrichment for SEO
  const aniList = comic?.aniListData;
  const jikan = comic?.jikanData;

  const ratingText = aniList?.averageScore
    ? `Rated ${aniList.averageScore}/100`
    : jikan?.score
      ? `Rated ${jikan.score}/10`
      : '';
  const title = comic?.title
    ? `Read ${comic.title} ${type} Online ${ratingText ? `- ${ratingText}` : ''}`
    : 'Digital Comic Archive';

  // Combine descriptions for maximum SEO density
  const baseDescription = comic?.description || '';
  const aniDescription = aniList?.description?.replace(/<[^>]*>/g, '') || '';
  const finalDescription =
    `${baseDescription} ${aniDescription}`.slice(0, 160).trim() || DEFAULT_DESCRIPTION;

  const ogImage = buildComicOpenGraphImage(comic?.coverUrl, siteUrl, comic?.title);

  return {
    metadataBase: new URL(siteUrl),
    title,
    description: finalDescription,
    openGraph: {
      title,
      description: finalDescription,
      url: canonicalUrl,
      siteName: ICS_SITE_DISPLAY_NAME,
      locale: 'en_US',
      type: 'article',
      images: [ogImage],
      section: type,
      tags: comic?.genres || [type, 'Comics', 'Reading'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: finalDescription,
      images: [ogImage.url],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { source, id } = await params;
  const resolvedId = await resolveMangaDexRouteId(source, id);
  const resolved = source !== 'mangadex' || isMangaDexUuid(id) || resolvedId !== id;

  if (source === 'mangadex' && resolvedId !== id && isMangaDexUuid(resolvedId)) {
    redirect(`/library/${source}/${resolvedId}`);
  }

  if (source === 'mangadex' && !resolved) {
    return <MangaDexUnresolvedPanel />;
  }

  const cookieStore = await cookies();
  const initialAgeVerified = cookieStore.get('age_verified')?.value === 'true';
  
  const [initialComic, initialChapters] = await Promise.all([
    getComicDetails(source, resolvedId),
    getChapters(source, resolvedId)
  ]);
  const comicData = initialComic as ComicSeoData | null;
  const siteOrigin = getPublicSiteUrl().replace(/\/$/, '');
  const canonicalWorkUrl = `${siteOrigin}/library/${source}/${resolvedId}`;

  const genreLine = Array.from(
    new Set([
      ...(comicData?.genres || []),
      ...(comicData?.aniListData?.genres || []),
      ...(comicData?.jikanData?.genres?.map((genre) => genre.name).filter((name): name is string => Boolean(name)) ||
        []),
    ]),
  ).join(', ');

  const aggregateRating = comicData ? buildAggregateRating(comicData) : null;

  const comicSchema = comicData
    ? {
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: comicData.title,
        url: canonicalWorkUrl,
        description:
          typeof comicData.description === 'string'
            ? comicData.description.replace(/<[^>]*>/g, '').trim().slice(0, 5000)
            : undefined,
        ...(comicData.coverUrl
          ? { image: toAbsoluteAssetUrl(comicData.coverUrl, siteOrigin) }
          : {}),
        author: {
          '@type': 'Person',
          name:
            comicData.author ||
            comicData.jikanData?.authors?.[0]?.name ||
            'Various',
        },
        publisher: {
          '@type': 'Organization',
          name: ICS_SITE_DISPLAY_NAME,
          url: siteOrigin,
        },
        ...(genreLine ? { genre: genreLine } : {}),
        ...(aggregateRating ? { aggregateRating } : {}),
      }
    : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteOrigin,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Library',
        item: `${siteOrigin}/library`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: comicData?.title || 'Comic',
        item: canonicalWorkUrl,
      },
    ],
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
