export const runtime = "edge";
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const targetUrl = `https://api.mangadex.org/${path}`;
    const res = await fetch(targetUrl, {
      headers,
      next: { revalidate: 900 },
    });

    const contentType = res.headers.get('content-type') || 'application/json';
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
