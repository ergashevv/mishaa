export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { AGE_VERIFICATION_COOKIE } from '@/lib/age-verification';
import {
  BooruSource,
  BOORU_FETCH_HEADERS,
  buildBooruPostUrl,
  buildBooruSearchUrl,
} from '@/lib/booru';
import { isBooruLibrarySource } from '@/lib/comic-sources';

export const dynamic = 'force-dynamic';

function parsePageIndex(params: URLSearchParams) {
  const raw = Number.parseInt(params.get('page') || '0', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function isBooruSourceParam(value: string | null): value is BooruSource {
  return value !== null && isBooruLibrarySource(value);
}

function buildUrl(source: BooruSource, kind: 'search' | 'post', params: URLSearchParams) {
  if (kind === 'post') {
    return buildBooruPostUrl(source, params.get('id') || '');
  }
  return buildBooruSearchUrl(source, {
    limit: Number.parseInt(params.get('limit') || '36', 10) || 36,
    page: parsePageIndex(params),
    query: params.get('query') || '',
  });
}

async function fetchJson(
  source: BooruSource,
  kind: 'search' | 'post',
  params: URLSearchParams,
) {
  const targetUrl = buildUrl(source, kind, params);
  let res: Response;
  try {
    res = await fetch(targetUrl, {
      headers: BOORU_FETCH_HEADERS,
      next: { revalidate: 3600 },
    });
  } catch (error) {
    if (kind !== 'search') {
      throw error;
    }
    res = new Response(null, { status: 502, statusText: 'Booru upstream unavailable' });
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

  if (!isBooruSourceParam(sourceParam) || (kind !== 'search' && kind !== 'post')) {
    return NextResponse.json({ error: 'Invalid booru request' }, { status: 400 });
  }

  const emptyList = () =>
    NextResponse.json([], {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });

  try {
    const { body, status, contentType } = await fetchJson(sourceParam, kind, searchParams);

    // A flaky/empty upstream on a search shouldn't surface as an error — the grid
    // renders an "empty shelf" instead.
    if (kind === 'search' && status >= 400) {
      return emptyList();
    }

    return new NextResponse(body, {
      status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    if (kind === 'search') {
      return emptyList();
    }
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
