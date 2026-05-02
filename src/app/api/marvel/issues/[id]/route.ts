export const runtime = "edge";
import { NextResponse } from "next/server";

const MARVEL_API_BASE = "https://marvel.emreparker.com/v1";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(`${MARVEL_API_BASE}/issues/${encodeURIComponent(id)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Marvel issue proxy error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch Marvel issue." },
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
    console.error("Marvel issue route error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
