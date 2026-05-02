export const runtime = "edge";
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseId(value: string | null) {
  const id = Number.parseInt(value || '', 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const mediaId = parseId(String(id || ''));

    if (!mediaId) {
      return NextResponse.json({ error: 'Invalid AniList id' }, { status: 400 });
    }

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: `query ($id: Int) { Media (id: $id, type: MANGA) { bannerImage averageScore } }`,
        variables: { id: mediaId },
      }),
    });

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AniList proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
