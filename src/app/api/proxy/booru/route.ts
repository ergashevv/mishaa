export const runtime = "edge";
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

function parsePageIndex(params: URLSearchParams) {
  const raw = Number.parseInt(params.get('page') || '0', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function isBooruSource(value: string | null): value is BooruSource {
  return value === 'e621' || value === 'danbooru' || value === 'gelbooru';
}

function buildUrl(source: BooruSource, kind: 'search' | 'post', params: URLSearchParams) {
  const pageIndex = parsePageIndex(params);

  if (source === 'gelbooru') {
    const url = new URL(`${BOORU_BASE_URLS[source]}/index.php`);
    url.searchParams.set('page', 'dapi');
    url.searchParams.set('s', 'post');
    url.searchParams.set('q', 'index');
    url.searchParams.set('json', '1');

    if (kind === 'search') {
      url.searchParams.set('limit', params.get('limit') || '36');
      url.searchParams.set('pid', String(pageIndex));
      url.searchParams.set('tags', normalizeBooruQuery(source, params.get('query') || ''));
    } else {
      url.searchParams.set('id', params.get('id') || '');
    }

    return url.toString();
  }

  if (kind === 'search') {
    const url = new URL(`${BOORU_BASE_URLS[source]}/posts.json`);
    url.searchParams.set('limit', params.get('limit') || '36');
    url.searchParams.set('page', String(pageIndex + 1));
    url.searchParams.set('tags', normalizeBooruQuery(source, params.get('query') || ''));
    return url.toString();
  }

  return `${BOORU_BASE_URLS[source]}/posts/${params.get('id')}.json`;
}

async function fetchJson(
  source: BooruSource,
  kind: 'search' | 'post',
  params: URLSearchParams,
  headers: Record<string, string>,
) {
  const targetUrl = buildUrl(source, kind, params);
  let res: Response;
  try {
    res = await fetch(targetUrl, {
      headers,
      next: { revalidate: 3600 },
    });
  } catch (error) {
    if (source !== 'gelbooru' || kind !== 'search') {
      throw error;
    }
    res = new Response(null, { status: 502, statusText: 'Gelbooru upstream unavailable' });
  }

  if (res.ok) {
    const body = await res.text();
    return { body, status: res.status, contentType: res.headers.get('content-type') || 'application/json' };
  }

  const body = await res.text();
  return { body, status: res.status, contentType: res.headers.get('content-type') || 'application/json' };
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
    const { body, status, contentType } = await fetchJson(sourceParam, kind, searchParams, headers);

    if (sourceParam === 'gelbooru' && kind === 'search' && status >= 400) {
      return NextResponse.json([], {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    return new NextResponse(body, {
      status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    if (sourceParam === 'gelbooru' && kind === 'search') {
      return NextResponse.json([], {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
