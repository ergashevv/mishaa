export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { NHENTAI_API_MIRRORS, NHENTAI_JSON_HEADERS } from '@/lib/nhentai';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || '';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  for (const mirror of NHENTAI_API_MIRRORS) {
    try {
      const url = `https://${mirror}/api/v2/search?query=${encodeURIComponent(query)}&page=${page}`;
      const res = await fetch(url, {
        headers: NHENTAI_JSON_HEADERS,
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data?.result) ? data.result : [];

        return NextResponse.json(
          {
            result: results,
            numPages: data?.num_pages || 0,
            perPage: data?.per_page || 25,
          },
          {
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ result: [], numPages: 0, perPage: 25 }, { status: 200 });
}
