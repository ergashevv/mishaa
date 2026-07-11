import { MetadataRoute } from 'next';
import { searchComics, getChapters } from '@/actions/comic';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { GUIDES_ORDER } from '@/lib/guides/registry';
import { getSeriesSitemapEntries } from '@/lib/ingest/series-repo';

/**
 * Re-run the heavy MangaDex/Marvel fan-out at most every 6h. The route already had
 * implicit ISR, but pinning it keeps the ~60+ upstream fetches off the per-request path
 * and out of build-time bursts that risk MangaDex 429s.
 */
export const revalidate = 21600;

/** MangaDex listing pages merged into sitemap (36 titles per page via SEARCH_PAGE_LIMIT). */
const MANGA_SITEMAP_MAX_PAGES = 55;

/** Listing-fetch fan-out is chunked into batches of this size to avoid a MangaDex 429 burst. */
const SITEMAP_FETCH_BATCH = 10;

/** Marvel issue detail pages (bounded — issues are static metadata, no reader/chapter URLs). */
const MARVEL_SITEMAP_MAX_PAGES = 4;

/** Sample chapter URLs for long-tail discovery (first listing page → subset of titles × capped chapters). */
const CHAPTER_SITEMAP_TITLE_CAP = 12;

const CHAPTERS_PER_TITLE_CAP = 18;

/**
 * Stable revision date for evergreen / editorial routes (about, privacy, guides…).
 * Bump when those pages materially change. We deliberately avoid `new Date()` per
 * request so `lastmod` stays an honest freshness signal instead of telling Google
 * "every URL changed just now" on every crawl — which erodes trust in the field.
 */
const CONTENT_REVISION = new Date('2026-06-10T00:00:00.000Z');

/** Parse an ISO timestamp into a Date, or null when missing/invalid. */
function parseDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function routeEntry(
  baseUrl: string,
  path: string,
  opts: {
    changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
    priority: number;
    lastModified: Date;
  },
): MetadataRoute.Sitemap[0] {
  return {
    url: `${baseUrl}${path}`,
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
  };
}

/**
 * Note: we intentionally do NOT emit `?ui=<lang>` variant URLs here. The hubs are
 * self-canonical to their clean path and carry the language signal via per-page
 * hreflang <link> alternates in metadata. Listing the param twins in the sitemap only
 * manufactured near-duplicate entries (and some hubs lacked reciprocal hreflang).
 */

/**
 * Static / editorial routes. `catalogLastModified` is the newest catalog change and
 * drives the two catalog-backed hubs (`/`, `/library`); everything else is evergreen
 * and uses the stable {@link CONTENT_REVISION}.
 */
function buildStaticRoutes(baseUrl: string, catalogLastModified: Date): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/about',
    '/icomics-wiki',
    '/library',
    '/contact',
    '/link-to-us',
    '/faq',
    '/support',
    '/superheroes',
    '/privacy',
    '/terms',
    '/content-policy',
    '/dmca',
    '/guides',
    '/reading',
    ...GUIDES_ORDER.map((g) => `/guides/${g.slug}`),
  ];

  return staticPaths.map((route) =>
    routeEntry(baseUrl, route, {
      changeFrequency:
        route === '' || route === '/library'
          ? 'daily'
          : route.startsWith('/guides') || route === '/reading'
            ? 'monthly'
            : 'weekly',
      priority:
        route === ''
          ? 1
          : route === '/library'
            ? 0.9
            : route === '/icomics-wiki'
              ? 0.8
              : route === '/faq' || route === '/contact' || route === '/link-to-us'
                ? 0.72
                : route.startsWith('/guides') || route === '/reading'
                  ? 0.75
                  : 0.6,
      lastModified: route === '' || route === '/library' ? catalogLastModified : CONTENT_REVISION,
    }),
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicSiteUrl().replace(/\/$/, '');

  try {
    // Chunk the 55 listing fetches into batches so we never open 55 simultaneous
    // connections to MangaDex (which triggers 429s that cascade into thin pages).
    type MangaPage = Awaited<ReturnType<typeof searchComics>>;
    const mangaPages: MangaPage[] = [];
    let anyListingRejected = false;
    for (let start = 0; start < MANGA_SITEMAP_MAX_PAGES; start += SITEMAP_FETCH_BATCH) {
      const batch = await Promise.allSettled(
        Array.from({ length: Math.min(SITEMAP_FETCH_BATCH, MANGA_SITEMAP_MAX_PAGES - start) }, (_, i) =>
          searchComics({ source: 'mangadex', page: start + i, query: '' }),
        ),
      );
      for (const r of batch) {
        if (r.status === 'fulfilled') mangaPages.push(r.value);
        else anyListingRejected = true;
      }
    }

    if (mangaPages.length === 0 && anyListingRejected) {
      console.error('Sitemap: all MangaDex listing fetches failed');
    }

    /** Newest catalog `updatedAt` → honest lastmod for the catalog-backed hubs. */
    let latestCatalogUpdate = CONTENT_REVISION;
    for (const page of mangaPages) {
      for (const item of page.items) {
        const d = parseDate(item.updatedAt);
        if (d && d.getTime() > latestCatalogUpdate.getTime()) {
          latestCatalogUpdate = d;
        }
      }
    }

    const byUrl = new Map<string, MetadataRoute.Sitemap[0]>();
    for (const entry of buildStaticRoutes(baseUrl, latestCatalogUpdate)) {
      byUrl.set(entry.url, entry);
    }

    for (const page of mangaPages) {
      for (const item of page.items) {
        const url = `${baseUrl}/library/mangadex/${item.id}`;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            lastModified: parseDate(item.updatedAt) ?? CONTENT_REVISION,
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }
    }

    // Merge our OWN ingested catalog (Postgres) on top of the live listing. This is
    // strictly additive — it only ever ADDS titles the live fan-out missed (everything
    // beyond the 55-page / ~2000-URL cap), so the sitemap can only grow as ingestion
    // fills. Once the DB comprehensively covers the catalog, the live fan-out above can
    // be dropped entirely. Failure here is non-fatal: we keep the live-derived entries.
    try {
      const dbSeries = await getSeriesSitemapEntries({ source: 'mangadex' });
      for (const s of dbSeries) {
        const url = `${baseUrl}/library/${s.source}/${s.sourceId}`;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            lastModified: s.sourceUpdatedAt ?? CONTENT_REVISION,
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }
    } catch (e) {
      console.error('Sitemap: DB catalog merge failed (kept live entries)', e);
    }

    // Marvel issue detail pages — a whole indexable vertical that was previously absent
    // from the sitemap (and unreachable via crawlable links). Bounded + allSettled so a
    // Marvel API outage degrades gracefully instead of breaking the whole sitemap.
    const marvelResults = await Promise.allSettled(
      Array.from({ length: MARVEL_SITEMAP_MAX_PAGES }, (_, page) =>
        searchComics({ source: 'marvel', page, query: '' }),
      ),
    );
    for (const r of marvelResults) {
      if (r.status !== 'fulfilled') continue;
      for (const item of r.value.items) {
        const url = `${baseUrl}/library/marvel/${item.id}`;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            lastModified: parseDate(item.updatedAt) ?? CONTENT_REVISION,
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        }
      }
    }

    // Sample chapter URLs for long-tail discovery — fetch the spotlight titles' feeds in
    // parallel (was a sequential loop that added a ~10s serial tail to a cold render).
    const spotlightTitles = (mangaPages[0]?.items ?? []).slice(0, CHAPTER_SITEMAP_TITLE_CAP);
    const chapterLists = await Promise.allSettled(
      spotlightTitles.map((item) => getChapters('mangadex', item.id)),
    );
    spotlightTitles.forEach((item, idx) => {
      const result = chapterLists[idx];
      if (result.status !== 'fulfilled') return;
      const itemLastModified = parseDate(item.updatedAt) ?? CONTENT_REVISION;
      for (const ch of result.value.slice(0, CHAPTERS_PER_TITLE_CAP)) {
        const url = `${baseUrl}/library/mangadex/${item.id}/read/${ch.id}`;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            lastModified: itemLastModified,
            changeFrequency: 'weekly',
            priority: 0.55,
          });
        }
      }
    });

    return [...byUrl.values()];
  } catch (e) {
    console.error('Sitemap generation error:', e);
    const fallback = new Map<string, MetadataRoute.Sitemap[0]>();
    for (const entry of buildStaticRoutes(baseUrl, CONTENT_REVISION)) {
      fallback.set(entry.url, entry);
    }
    return [...fallback.values()];
  }
}
