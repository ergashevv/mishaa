import { NextRequest, NextResponse } from 'next/server';
import { AGE_VERIFICATION_COOKIE } from '@/lib/age-verification';

export const dynamic = 'force-dynamic';

function isSafePath(path: string) {
  return path.length > 0 && !path.includes('://') && !path.includes('..');
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
  const path = searchParams.get('path') || '';

  if (!isSafePath(path)) {
    return NextResponse.json({ error: 'Invalid nhentai image path' }, { status: 400 });
  }

  try {
    // nhentai uses t.nhentai.net for thumbnails and i.nhentai.net for full images
    const isThumbnail = path.includes('/thumb.') || path.includes('/1t.');
    const host = isThumbnail ? 't.nhentai.net' : 'i.nhentai.net';
    const targetUrl = `https://${host}/${path}`;

    const res = await fetch(targetUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://nhentai.net/',
      },
    });

    if (!res.ok) {
      // Try fallback to other host if one fails
      const fallbackHost = !isThumbnail ? 't.nhentai.net' : 'i.nhentai.net';
      const fallbackRes = await fetch(`https://${fallbackHost}/${path}`, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Referer': 'https://nhentai.net/',
        },
      });
      
      if (fallbackRes.ok) {
        return new NextResponse(fallbackRes.body, {
          status: 200,
          headers: {
            'Content-Type': fallbackRes.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown nhentai image proxy error';
    console.error('Nhentai Image Proxy Error:', message, 'Path:', path);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
