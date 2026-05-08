import { MARVEL_PUBLIC_API_BASE, MARVEL_UPSTREAM_TIMEOUT_MS } from '@/lib/marvel/public-api';

export type MarvelShelfCard = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  source: 'marvel';
  href: string;
  meta: string;
  rating: string;
};

/**
 * Aggregated Marvel “shelf” for home and `/api/marvel/shelf` — no self-HTTP to the app.
 */
export async function fetchMarvelShelfItems(options: {
  limit: number;
  offset: number;
}): Promise<MarvelShelfCard[]> {
  const limit = Math.min(Math.max(options.limit, 1), 50);
  const offset = Math.max(options.offset, 0);

  const listRes = await fetch(
    `${MARVEL_PUBLIC_API_BASE}/issues?limit=${limit}&offset=${offset}`,
    {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(MARVEL_UPSTREAM_TIMEOUT_MS),
    },
  );

  if (!listRes.ok) throw new Error('Failed to fetch Marvel list');
  const listData = await listRes.json();
  const items = Array.isArray(listData?.items) ? listData.items : [];

  const detailedItems = await Promise.all(
    items.map(async (item: { id: string }) => {
      try {
        const detailRes = await fetch(`${MARVEL_PUBLIC_API_BASE}/issues/${item.id}`, {
          headers: { Accept: 'application/json' },
          cache: 'force-cache',
          signal: AbortSignal.timeout(MARVEL_UPSTREAM_TIMEOUT_MS),
        });
        if (!detailRes.ok) return null;
        const detail = await detailRes.json();
        const issue = detail?.data?.results?.[0] || detail?.items?.[0] || detail;

        if (!issue) return null;

        const path = issue.cover?.path || issue.thumbnail?.path;
        const ext = issue.cover?.extension || issue.thumbnail?.extension;
        const directCoverUrl =
          path && ext ? `${path.replace('http://', 'https://')}/portrait_uncanny.${ext}` : null;
        const coverUrl = directCoverUrl
          ? `/api/proxy/image?url=${encodeURIComponent(directCoverUrl)}`
          : '/logo.png';

        return {
          id: String(issue.id),
          title: issue.title || `Issue ${issue.issueNumber}`,
          description: issue.seriesName || 'Marvel Universe',
          coverUrl,
          source: 'marvel' as const,
          href: `/library/marvel/${issue.id}`,
          meta: issue.issueNumber ? `ISSUE ${issue.issueNumber}` : 'MARVEL',
          rating: '4.8',
        } satisfies MarvelShelfCard;
      } catch {
        return null;
      }
    }),
  );

  return detailedItems.filter(Boolean) as MarvelShelfCard[];
}
