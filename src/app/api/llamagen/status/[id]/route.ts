export const runtime = "edge";
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/require-session';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const apiKey = process.env.LLAMAGEN_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "LlamaGen API Key not configured" }, { status: 500 });
    }

    const response = await fetch(`https://api.llamagen.ai/v1/comics/generations/${id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch status" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
