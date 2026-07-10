export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_PREFIXES = ['manga', 'at-home/server'];

const MD_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedStatisticsManga(path: string) {
  if (!path.startsWith('statistics/manga/')) return false;
  const rest = path.slice('statistics/manga/'.length);
  return rest.length > 0 && !rest.includes('/') && MD_UUID.test(rest);
}

function isAllowedPath(path: string) {
  if (path.includes('://') || path.includes('..')) return false;
  if (isAllowedStatisticsManga(path)) return true;
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: 'Invalid MangaDex path' }, { status: 400 });
  }

  const headers = {
    'User-Agent':
      'iComics.wiki/1.0 (+https://icomics.wiki; contact support@icomics.wiki)',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // MangaDex @home base URLs carry a token that expires in ~15 min. Caching them for
  // 15 min + serving stale for 24h hands readers an expired token, so the per-page image
  // fetches 403/410 and the chapter renders blank. Fetch at-home/server (near-)fresh and
  // never serve it stale; keep the long cache only for slow-changing manga/statistics.
  const isAtHome = path.startsWith('at-home/server');

  try {
    const targetUrl = `https://api.mangadex.org/${path}`;
    const res = await fetch(targetUrl, {
      headers,
      next: { revalidate: isAtHome ? 0 : 900 },
    });

    const contentType = res.headers.get('content-type') || 'application/json';
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': isAtHome
          ? 'private, no-store'
          : 'public, max-age=900, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
