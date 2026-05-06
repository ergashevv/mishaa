export const runtime = "edge";
import { NextResponse } from "next/server";
import { getHomeData } from "@/lib/home-data";
import { AGE_VERIFICATION_COOKIE } from "@/lib/age-verification";
import { fetchTrendingAniListManga } from "@/lib/anilist";
import type { MangaLanguage } from "@/lib/manga-language";

const normalizeLanguage = (value: string | null): MangaLanguage => {
  return value === 'en' || value === 'ru' || value === 'es' || value === 'fr'
    ? value
    : 'ru';
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lang = normalizeLanguage(searchParams.get("lang"));
  const includeAdultContent = req.headers.get("cookie")?.includes(`${AGE_VERIFICATION_COOKIE}=true`) ?? false;

  const baseShelves = await getHomeData(lang, { includeAdultContent });

  try {
    const marvelPromise = fetch(`${new URL(req.url).origin}/api/marvel/shelf?limit=12`)
      .then((response) => response.ok ? response.json() : { items: [] })
      .catch(() => ({ items: [] }))
      .then((data) => data.items || []);

    const trendingPromise = fetchTrendingAniListManga(12)
      .then((items) => items.map((item, index) => ({
        id: item.id.toString(),
        title: item.title.userPreferred || item.title.english || item.title.romaji,
        description: item.description?.replace(/<[^>]*>?/gm, '').substring(0, 150) || 'Global trending pick',
        coverUrl: item.coverImage.extraLarge || item.coverImage.large,
        source: 'mangadex',
        href: `/library/mangadex/${item.id}`,
        meta: `TRENDING #${index + 1}`,
        rating: (item.averageScore / 10).toFixed(1) || '8.5',
      })))
      .catch(() => []);

    const [marvel, trending] = await Promise.all([marvelPromise, trendingPromise]);

    return NextResponse.json({
      shelves: {
        ...baseShelves,
        trending: trending || baseShelves.trending || [],
        marvel: marvel || [],
      }
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
