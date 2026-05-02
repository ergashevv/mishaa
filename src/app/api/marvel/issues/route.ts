export const runtime = "edge";
import { NextResponse } from "next/server";

const MARVEL_API_BASE = "https://marvel.emreparker.com/v1";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "36"), 1), 100);
    const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);

    const endpoint = query.length >= 2
      ? `${MARVEL_API_BASE}/search/issues?q=${encodeURIComponent(query)}`
      : `${MARVEL_API_BASE}/issues?limit=${limit}&offset=${offset}`;

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Marvel search proxy error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch Marvel issues." },
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
    console.error("Marvel search route error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
