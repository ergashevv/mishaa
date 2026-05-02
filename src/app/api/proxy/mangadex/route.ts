export const runtime = "edge";
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_PREFIXES = ['manga', 'at-home/server'];

function isAllowedPath(path: string) {
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  if (!isAllowedPath(path) || path.includes('://') || path.includes('..')) {
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
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') || 'application/json';
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
