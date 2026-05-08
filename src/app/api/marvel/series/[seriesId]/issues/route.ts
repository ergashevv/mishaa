export const runtime = "edge";
import { NextResponse } from "next/server";
import { MARVEL_PUBLIC_API_BASE } from '@/lib/marvel/public-api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;

    const response = await fetch(`${MARVEL_PUBLIC_API_BASE}/series/${encodeURIComponent(seriesId)}/issues`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Marvel series issues proxy error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch Marvel series issues." },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error: unknown) {
    console.error("Marvel series issues route error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
