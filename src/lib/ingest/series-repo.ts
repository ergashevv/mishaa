import { sql } from '@/lib/sql';

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
 * All ingested catalog titles for the sitemap — read straight from Postgres over Neon's
 * HTTP driver (Prisma can't run on the Cloudflare Workers runtime), so the sitemap no
 * longer depends on a live per-request fan-out to MangaDex (no 55-page cap, no
 * 429-thin-pages). Only `safe`/`suggestive` are indexed. Ordered newest-first so the most
 * relevant URLs win the cap while the catalog is still filling.
 */
export async function getSeriesSitemapEntries(opts?: {
  source?: string;
  limit?: number;
}): Promise<SeriesSitemapEntry[]> {
  const limit = Math.min(opts?.limit ?? SITEMAP_SERIES_CAP, SITEMAP_SERIES_CAP);
  const source = opts?.source ?? null;
  const rows = (await sql(
    `SELECT source, "sourceId", "sourceUpdatedAt"
       FROM "Series"
      WHERE "contentRating" IN ('safe', 'suggestive')
        AND ($1::text IS NULL OR source = $1)
      ORDER BY "sourceUpdatedAt" DESC NULLS LAST
      LIMIT $2`,
    [source, limit],
  )) as Array<{ source: string; sourceId: string; sourceUpdatedAt: string | Date | null }>;

  return rows.map((r) => ({
    source: r.source,
    sourceId: r.sourceId,
    sourceUpdatedAt: r.sourceUpdatedAt ? new Date(r.sourceUpdatedAt) : null,
  }));
}

/** Total indexable (SFW) series we hold — for observability / sitemap-index sizing. */
export async function countIndexableSeries(source?: string): Promise<number> {
  const rows = (await sql(
    `SELECT count(*)::int AS n
       FROM "Series"
      WHERE "contentRating" IN ('safe', 'suggestive')
        AND ($1::text IS NULL OR source = $1)`,
    [source ?? null],
  )) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}
