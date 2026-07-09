export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getHomeData, getHomeFeed } from "@/lib/home-data";
import { AGE_VERIFICATION_COOKIE } from "@/lib/age-verification";
import type { MangaLanguage } from "@/lib/manga-language";
import { isTruthyCookieFromHeader } from "@/lib/http/cookie-header";

/**
 * Align with the real UI/MangaLanguage set (en/ru/ja/ko/zh). The old list whitelisted
 * es/fr (not UI langs, so they minted dead `unstable_cache` entries) while silently
 * dropping ja/ko/zh to 'en' — so CJK users never got a localized, correctly-keyed shelf.
 */
const normalizeLanguage = (value: string | null): MangaLanguage => {
  return value === 'en' || value === 'ru' || value === 'ja' || value === 'ko' || value === 'zh'
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

  // `getHomeData` is `unstable_cache`d (1h) and already assembles a `trending` shelf
  // with AniList→MangaDex-resolved ON-SITE hrefs (`/library/mangadex/...`). The previous
  // per-request AniList refetch threw that away, blocked the response on a fresh GraphQL
  // call, and overwrote trending with OFF-SITE `item.siteUrl` links (a navigation bug).
  // If MangaDex is transiently unavailable, getHomeData throws to prevent caching empty
  // shelves — catch here so the API still responds (uncached empty, not a 500).
  let shelves: Record<string, unknown> = {};
  try {
    shelves = await getHomeData(lang, { includeAdultContent });
  } catch {
    // Return empty shelves without Cache-Control so the CDN doesn't cache this response
    return NextResponse.json({ shelves: {} });
  }

  return NextResponse.json({ shelves }, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
