export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { AGE_VERIFICATION_COOKIE } from '@/lib/age-verification';
import {
  NHENTAI_API_MIRRORS,
  NHENTAI_JSON_HEADERS,
  isAllowedNHentaiProxyApiPath,
} from '@/lib/nhentai';

export async function GET(req: NextRequest) {
  const ageVerified = req.cookies.get(AGE_VERIFICATION_COOKIE)?.value === 'true';
  if (!ageVerified) {
    return NextResponse.json(
      { error: 'Age verification required', code: 'AGE_VERIFICATION_REQUIRED' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  if (!isAllowedNHentaiProxyApiPath(path)) {
    return NextResponse.json({ error: 'Invalid nHentai API path' }, { status: 400 });
  }

  const apiPaths = path.startsWith('v2/')
    ? [path, path.replace(/^v2\//, '')]
    : [path, `v2/${path}`];

  try {
    for (const mirror of NHENTAI_API_MIRRORS) {
      for (const apiPath of apiPaths) {
        const targetUrl = `https://${mirror}/api/${apiPath}`;
        const res = await fetch(targetUrl, {
          headers: NHENTAI_JSON_HEADERS,
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          console.warn(`nhentai mirror ${mirror} returned ${res.status} for ${apiPath}`);
          continue;
        }

        const body = await res.text();
        try {
          const data = JSON.parse(body);
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
          });
        } catch {
          return new NextResponse(body, {
            status: 200,
            headers: {
              'Content-Type': res.headers.get('content-type') || 'application/json',
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
          });
        }
      }
    }

    return NextResponse.json({ error: 'Failed to fetch from nhentai' }, { status: 502 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
