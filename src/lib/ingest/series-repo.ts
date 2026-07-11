import { prisma } from '@/lib/prisma';

/** One indexable catalog URL sourced from our OWN DB (no live upstream fetch). */
export type SeriesSitemapEntry = {
  source: string;
  sourceId: string;
  /** Honest per-title lastmod (upstream updatedAt), or null → caller falls back. */
  sourceUpdatedAt: Date | null;
};

/**
 * A single sitemap file must stay under Google's 50,000-URL / 50 MB ceiling. We cap the
 * DB pull here; once the catalog grows past this we split into a sitemap index (child
 * sitemaps of ≤45k each). Until then this is one flat list.
 */
export const SITEMAP_SERIES_CAP = 45_000;

/**
 * All ingested catalog titles for the sitemap — read straight from Postgres, so the
 * sitemap no longer depends on a live per-request fan-out to MangaDex (no 55-page cap,
 * no 429-thin-pages). `pornographic` is never ingested, but we also drop `erotica` from
 * the indexable set to keep the sitemap SFW. Ordered newest-first so the most relevant
 * URLs win the cap while the catalog is still filling.
 */
export async function getSeriesSitemapEntries(opts?: {
  source?: string;
  limit?: number;
}): Promise<SeriesSitemapEntry[]> {
  const limit = Math.min(opts?.limit ?? SITEMAP_SERIES_CAP, SITEMAP_SERIES_CAP);
  const rows = await prisma.series.findMany({
    where: {
      ...(opts?.source ? { source: opts.source } : {}),
      contentRating: { in: ['safe', 'suggestive'] },
    },
    select: { source: true, sourceId: true, sourceUpdatedAt: true },
    orderBy: { sourceUpdatedAt: 'desc' },
    take: limit,
  });
  return rows;
}

/** Total indexable (SFW) series we hold — for observability / sitemap-index sizing. */
export async function countIndexableSeries(source?: string): Promise<number> {
  return prisma.series.count({
    where: {
      ...(source ? { source } : {}),
      contentRating: { in: ['safe', 'suggestive'] },
    },
  });
}
