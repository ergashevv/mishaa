import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const SUPERHERO_API_BASE = `https://superheroapi.com/api/${process.env.SUPERHERO_API_TOKEN || '74ddaf49767100794a5c55160d893e3b'}`;
    const res = await fetch(`${SUPERHERO_API_BASE}/${id}`, { next: { revalidate: 3600 } });
    const data = await res.json();
    
    if (data.response === 'error') {
       return NextResponse.json({ error: data.error }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Superhero API ID fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch Superhero by ID' }, { status: 500 });
  }
}
