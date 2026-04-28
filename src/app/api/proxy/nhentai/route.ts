import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
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
    
    let res = await fetch(targetUrl, { headers });

    // If 404/403, try fallback search
    if (!res.ok) {
      console.warn(`nhentai.net returned ${res.status}.`);
      return NextResponse.json({ 
        error: `Failed to fetch from nhentai: ${res.status}`,
        status: res.status 
      }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
