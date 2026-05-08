export const runtime = "edge";
import { NextResponse } from "next/server";
import { getHomeData, getHomeFeed, dedupeHomeShelvesForRows } from "@/lib/home-data";
import { AGE_VERIFICATION_COOKIE } from "@/lib/age-verification";
import { fetchTrendingAniListManga } from "@/lib/anilist";
import type { MangaLanguage } from "@/lib/manga-language";
import { fetchMarvelShelfItems } from "@/lib/marvel/shelf";
import { isTruthyCookieFromHeader } from "@/lib/http/cookie-header";

const normalizeLanguage = (value: string | null): MangaLanguage => {
  return value === 'en' || value === 'ru' || value === 'es' || value === 'fr'
    ? value
    : 'en';
};

const parseNumberParam = (value: string | null, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lang = normalizeLanguage(searchParams.get("lang"));
  const cookieHeader = req.headers.get('cookie');
  const includeAdultContent = isTruthyCookieFromHeader(cookieHeader, AGE_VERIFICATION_COOKIE, 'true');

  if (searchParams.get('mode') === 'feed') {
    const items = await getHomeFeed(lang, {
      includeAdultContent,
      page: parseNumberParam(searchParams.get('page'), 0),
      seed: parseNumberParam(searchParams.get('seed'), 0),
    });

    return NextResponse.json({ items }, {
      headers: {
        'Cache-Control': includeAdultContent
          ? 'private, max-age=120'
          : 'public, s-maxage=600, stale-while-revalidate=3600',
      }
    });
  }

  const baseShelves = await getHomeData(lang, { includeAdultContent });

  try {
    const marvelPromise = fetchMarvelShelfItems({ limit: 12, offset: 0 }).catch(() => []);

    const trendingPromise = fetchTrendingAniListManga(12)
      .then((items) => items.map((item, index) => ({
        id: item.id.toString(),
        title: item.title.userPreferred || item.title.english || item.title.romaji,
        description: item.description?.replace(/<[^>]*>?/gm, '').substring(0, 150) || 'Global trending pick',
        coverUrl: item.coverImage.extraLarge || item.coverImage.large,
        source: 'mangadex',
        href: item.siteUrl || '/library',
        meta: `TRENDING #${index + 1}`,
        rating: (item.averageScore / 10).toFixed(1) || '8.5',
      })))
      .catch(() => []);

    const [marvel, trending] = await Promise.all([marvelPromise, trendingPromise]);

    const shelvesMerged = {
      ...baseShelves,
      trending: trending || baseShelves.trending || [],
      marvel: marvel || [],
    };

    return NextResponse.json({
      shelves: dedupeHomeShelvesForRows(shelvesMerged),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch {
    return NextResponse.json({ shelves: baseShelves }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  }
}
