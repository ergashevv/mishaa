
import { NextResponse } from 'next/server';
import { fetchAniListManga } from '@/lib/anilist';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { history } = await req.json();
    if (!history || !Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Fetch recommendations for the last 3 items in history
    const recPromises = history.slice(-3).map(async (id) => {
      try {
        // If ID is numeric, it's likely an AniList ID
        if (/^\d+$/.test(id)) {
          const data = await fetchAniListManga(id);
          return data?.recommendations?.nodes || [];
        } else {
          // If UUID, it's a MangaDex ID. We can't direct map easily here without an extra fetch,
          // but we'll try to fetch AniList data using a search or similar if we really wanted to.
          // For now, let's keep it simple and fallback.
          return [];
        }
      } catch {
        return [];
      }
    });

    const results = await Promise.all(recPromises);
    const allRecs = results.flat();
    
    // Map to LibraryComic format
    const items = allRecs
      .map((node: any) => {
        const media = node.mediaRecommendation;
        if (!media || media.type !== 'MANGA') return null;
        return {
          id: media.id.toString(),
          title: media.title.userPreferred || media.title.english || "Untitled",
          description: "Recommended based on your history",
          coverUrl: media.coverImage.large,
          source: 'mangadex', // We default to mangadex for routing
          href: `/library/mangadex/${media.id}`,
          meta: 'RECOMMENDED',
          rating: 'Safe'
        };
      })
      .filter(Boolean)
      .slice(0, 12);

    // Remove duplicates
    const uniqueItems = Array.from(new Map(items.map((item: any) => [item.id, item])).values());

    return NextResponse.json({ items: uniqueItems });
  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json({ items: [] });
  }
}
