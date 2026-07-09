export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'mangadex.org',
  'mangadex.network',
  'nhentai.net',
  'nhentai.to',
  'e621.net',
  'donmai.us',
  'gelbooru.com',
  'rule34.xxx',
  'annihil.us',
  'marvel.com',
];

function isAllowedHost(hostname: string) {
  return ALLOWED_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

function getReferer(url: URL) {
  if (url.hostname.includes('mangadex')) return 'https://mangadex.org/';
  if (url.hostname.includes('nhentai')) return 'https://nhentai.net/';
  if (url.hostname.includes('e621')) return 'https://e621.net/';
  if (url.hostname.includes('danbooru')) return 'https://danbooru.donmai.us/';
  if (url.hostname.includes('gelbooru')) return 'https://gelbooru.com/';
  if (url.hostname.includes('annihil.us') || url.hostname.includes('marvel')) return 'https://www.marvel.com/';
  return undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
  }

  try {
    const headers = new Headers();
    headers.set('User-Agent', 'iComics.wiki/1.0 (image proxy; contact support@icomics.wiki)');
    headers.set('Accept', 'image/*,*/*;q=0.8');
    headers.set('Referer', getReferer(target) || req.url);

    const res = await fetch(target.toString(), {
      headers,
      next: { revalidate: 86400 * 30 }, // Cache upstream for 30 days
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Image fetch failed (${res.status})` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get('content-type') || 'image/*';
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown image proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
