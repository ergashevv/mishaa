import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = new Set([
  'uploads.mangadex.org',
  'api.mangadex.org',
  'i.nhentai.net',
  't3.nhentai.net',
  'i.nhentai.to',
  'static1.e621.net',
  'e621.net',
  'cdn.donmai.us',
  'danbooru.donmai.us',
  'img3.gelbooru.com',
  'img1.gelbooru.com',
  'gelbooru.com',
]);

function getReferer(url: URL) {
  if (url.hostname.includes('mangadex')) return 'https://mangadex.org/';
  if (url.hostname.includes('nhentai')) return 'https://nhentai.net/';
  if (url.hostname.includes('e621')) return 'https://e621.net/';
  if (url.hostname.includes('danbooru')) return 'https://danbooru.donmai.us/';
  if (url.hostname.includes('gelbooru')) return 'https://gelbooru.com/';
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

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
  }

  try {
    const headers = new Headers();
    headers.set('User-Agent', 'iComics/1.0 (image proxy; contact support@icomics.uz)');
    headers.set('Accept', 'image/*,*/*;q=0.8');
    headers.set('Referer', getReferer(target) || req.url);

    const res = await fetch(target.toString(), {
      headers,
      cache: 'no-store',
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
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown image proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
