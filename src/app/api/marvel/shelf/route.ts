export const runtime = "edge";
import { NextResponse } from "next/server";
import { fetchMarvelShelfItems } from "@/lib/marvel/shelf";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "12"), 1), 50);
    const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);

    const items = await fetchMarvelShelfItems({ limit, offset });

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown Marvel shelf error";
    console.error("Marvel shelf aggregation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
