export const runtime = "edge";
import { NextRequest, NextResponse } from 'next/server';
import { AGE_VERIFICATION_COOKIE } from '@/lib/age-verification';

export async function GET(req: NextRequest) {
  const ageVerified = req.cookies.get(AGE_VERIFICATION_COOKIE)?.value === 'true';
  if (!ageVerified) {
    return NextResponse.json(
      { error: 'Age verification required', code: 'AGE_VERIFICATION_REQUIRED' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  // Common headers to mimic a browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://nhentai.net/',
  };

  try {
    // nhentai API v2
    const targetUrl = `https://nhentai.net/api/v2/${path}`;
    console.log(`Proxying to: ${targetUrl}`);
    
    const res = await fetch(targetUrl, { headers, next: { revalidate: 3600 } });

    // If 404/403, try fallback search
    if (!res.ok) {
      console.warn(`nhentai.net returned ${res.status}.`);
      return NextResponse.json({ 
        error: `Failed to fetch from nhentai: ${res.status}`,
        status: res.status 
      }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
