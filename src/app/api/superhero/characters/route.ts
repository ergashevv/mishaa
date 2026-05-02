import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { nameStartsWith } = await req.json();
    const query = nameStartsWith?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const SUPERHERO_API_BASE = `https://superheroapi.com/api/${process.env.SUPERHERO_API_TOKEN || '74ddaf49767100794a5c55160d893e3b'}`;
    const res = await fetch(`${SUPERHERO_API_BASE}/search/${encodeURIComponent(query)}`, { next: { revalidate: 3600 } });
    const data = await res.json();
    
    if (data.response === 'error') {
       return NextResponse.json({ results: [] });
    }

    return NextResponse.json({ results: data.results || [] });
  } catch (error) {
    console.error('Superhero API search error:', error);
    return NextResponse.json({ error: 'Failed to search Superhero API' }, { status: 500 });
  }
}
