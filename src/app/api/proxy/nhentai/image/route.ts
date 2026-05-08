export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { AGE_VERIFICATION_COOKIE } from '@/lib/age-verification';
import { NHENTAI_IMAGE_HEADERS, isAllowedNHentaiImageCdnPath } from '@/lib/nhentai';

export const dynamic = 'force-dynamic';

function hasSameOriginReferer(req: NextRequest) {
  const referer = req.headers.get('referer');
  if (!referer) return false;

  try {
    const refererUrl = new URL(referer);
    return refererUrl.origin === req.nextUrl.origin;
  } catch {
    return false;
  }
}

function decodePathParam(raw: string) {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function GET(req: NextRequest) {
  const ageVerified = req.cookies.get(AGE_VERIFICATION_COOKIE)?.value === 'true';
  if (!ageVerified && !hasSameOriginReferer(req)) {
    return NextResponse.json(
      { error: 'Age verification required', code: 'AGE_VERIFICATION_REQUIRED' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') || '';

  if (!isAllowedNHentaiImageCdnPath(path)) {
    return NextResponse.json({ error: 'Invalid nhentai image path' }, { status: 400 });
  }

  const decodedFull = decodePathParam(path);
  const withoutHashQuery = decodedFull.split(/[?#]/)[0] ?? '';

  if (/^https?:\/\//i.test(withoutHashQuery)) {
    let targetUrl: string;
    try {
      const u = new URL(withoutHashQuery);
      targetUrl = u.toString().replace(/^http:\/\//i, 'https://');
    } catch {
      return NextResponse.json({ error: 'Invalid nhentai image path' }, { status: 400 });
    }

    try {
      const res = await fetch(targetUrl, {
        headers: NHENTAI_IMAGE_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Direct fetch ${res.status}`);
      return new NextResponse(res.body, {
        status: 200,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error: unknown) {
      console.error('Nhentai image (absolute URL) failed:', error);
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }
  }

  const decodedPath = withoutHashQuery.replace(/^\/+/, '');

  const isThumbnail = decodedPath.includes('/thumb.') || decodedPath.includes('/1t.');
  const hosts = isThumbnail
    ? ['t.nhentai.net', 't2.nhentai.net', 't3.nhentai.net', 't5.nhentai.net']
    : ['i.nhentai.net', 'i2.nhentai.net', 'i3.nhentai.net', 'i5.nhentai.net', 'i7.nhentai.net'];

  const fetchImage = async (host: string) => {
    const res = await fetch(`https://${host}/${decodedPath}`, {
      headers: NHENTAI_IMAGE_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Host ${host} failed`);
    return res;
  };

  const fetchViaWeserv = async () => {
    const primaryHost = hosts[0];
    const abs = `https://${primaryHost}/${decodedPath}`;
    const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(abs)}&output=webp&q=80`;

    const res = await fetch(weservUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('Weserv failed');
    return res;
  };

  try {
    const res = await Promise.any([...hosts.slice(0, 2).map((h) => fetchImage(h)), fetchViaWeserv()]);

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Nhentai Image Proxy Error:', message, 'Path:', decodedPath);

    try {
      const primaryRes = await fetch(`https://${hosts[0]}/${decodedPath}`, {
        headers: NHENTAI_IMAGE_HEADERS,
      });
      if (primaryRes.ok) {
        return new NextResponse(primaryRes.body, {
          status: 200,
          headers: {
            'Content-Type': primaryRes.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    } catch {
      /* final fallback exhausted */
    }

    return NextResponse.json({ error: 'Failed to fetch image from any mirror' }, { status: 502 });
  }
}
