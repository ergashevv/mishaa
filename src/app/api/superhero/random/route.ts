import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const count = parseInt(url.searchParams.get('count') || '1', 10);
    const maxId = 731; // Total superheroes in the API
    const SUPERHERO_API_BASE = `https://superheroapi.com/api/${process.env.SUPERHERO_API_TOKEN || '74ddaf49767100794a5c55160d893e3b'}`;
    
    const fetchPromises = [];
    for (let i = 0; i < count; i++) {
       const randomId = Math.floor(Math.random() * maxId) + 1;
       fetchPromises.push(
         fetch(`${SUPERHERO_API_BASE}/${randomId}`, { next: { revalidate: 60 } })
           .then(res => res.json())
           .catch(() => null)
       );
    }
    
    const results = await Promise.all(fetchPromises);
    const validResults = results.filter(r => r && r.response === 'success');

    return NextResponse.json({ results: validResults });
  } catch (error) {
    console.error('Superhero API random fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch random Superheroes' }, { status: 500 });
  }
}
