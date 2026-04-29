import { NextRequest, NextResponse } from 'next/server';
import { AGE_VERIFICATION_COOKIE } from '@/lib/age-verification';
import {
  BooruSource,
  normalizeBooruQuery,
} from '@/lib/booru';

export const dynamic = 'force-dynamic';

const BOORU_BASE_URLS: Record<BooruSource, string> = {
  e621: 'https://e621.net',
  danbooru: 'https://danbooru.donmai.us',
  gelbooru: 'https://gelbooru.com',
};

function isBooruSource(value: string | null): value is BooruSource {
  return value === 'e621' || value === 'danbooru' || value === 'gelbooru';
}

function buildUrl(source: BooruSource, kind: 'search' | 'post', params: URLSearchParams) {
  if (source === 'gelbooru') {
    const url = new URL(`${BOORU_BASE_URLS[source]}/index.php`);
    url.searchParams.set('page', 'dapi');
    url.searchParams.set('s', 'post');
    url.searchParams.set('q', 'index');
    url.searchParams.set('json', '1');

    if (kind === 'search') {
      url.searchParams.set('limit', params.get('limit') || '36');
      url.searchParams.set('pid', params.get('page') || '0');
      url.searchParams.set('tags', normalizeBooruQuery(source, params.get('query') || ''));
    } else {
      url.searchParams.set('id', params.get('id') || '');
    }

    return url.toString();
  }

  if (kind === 'search') {
    const url = new URL(`${BOORU_BASE_URLS[source]}/posts.json`);
    url.searchParams.set('limit', params.get('limit') || '36');
    url.searchParams.set('page', params.get('page') || '1');
    url.searchParams.set('tags', normalizeBooruQuery(source, params.get('query') || ''));
    return url.toString();
  }

  return `${BOORU_BASE_URLS[source]}/posts/${params.get('id')}.json`;
}

export async function GET(req: NextRequest) {
  const ageVerified = req.cookies.get(AGE_VERIFICATION_COOKIE)?.value === 'true';
  if (!ageVerified) {
    return NextResponse.json(
      { error: 'Age verification required', code: 'AGE_VERIFICATION_REQUIRED' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const sourceParam = searchParams.get('source');
  const kind = searchParams.get('kind') as 'search' | 'post' | null;

  if (!isBooruSource(sourceParam) || (kind !== 'search' && kind !== 'post')) {
    return NextResponse.json({ error: 'Invalid booru request' }, { status: 400 });
  }

  const headers = {
    'User-Agent': 'iComics/1.0 (booru proxy; contact support@icomics.uz)',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const targetUrl = buildUrl(sourceParam, kind, searchParams);
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
