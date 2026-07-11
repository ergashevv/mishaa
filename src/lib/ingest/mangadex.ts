import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildMangaDexCoverUrl, pickMangaDexCoverFileName } from '@/lib/mangadex';
import { getPublicSiteUrl } from '@/lib/og-metadata';

/**
 * Incremental MangaDex metadata ingest.
 *
 * Goal: gradually build our OWN catalog (metadata only — no chapter page images) so
 * that sitemap, catalog pages and lastmod stop depending on a live per-request fan-out
 * to api.mangadex.org. Runs a bounded number of upserts per invocation (the daily cron
 * passes ~500) and is fully idempotent: re-running only refreshes rows.
 *
 * Paging strategy — createdAt ASC + a `createdAtSince` watermark:
 * MangaDex caps `offset` at 10,000 (offset+limit ≤ 10000), so a plain offset walk can
 * never sweep the full ~93k catalog. Instead we remember the createdAt of the last item
 * we ingested and pass it as `createdAtSince` next run. createdAt never changes, so the
 * walk is deterministic, resumable, and immune to the offset cap. Once we reach the tail
 * (a short page), the cursor is marked `exhausted` and every later run naturally becomes
 * a freshness pass — brand-new titles have a createdAt later than the watermark.
 */

const MANGADEX_API = 'https://api.mangadex.org';

/** MangaDex blocks requests without a browser-like UA (mirror the reader client). */
const MANGADEX_HEADERS = {
  'User-Agent': 'iComics.wiki/1.0 (+https://icomics.wiki; contact support@icomics.wiki)',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

/** Public catalog ratings — deliberately excludes `pornographic` (never sitemap-indexed). */
const INGEST_CONTENT_RATINGS = ['safe', 'suggestive', 'erotica'] as const;

const PAGE_LIMIT = 100; // MangaDex max per request
const FETCH_TIMEOUT_MS = 12_000;
const DELAY_BETWEEN_PAGES_MS = 350; // gentle: well under MangaDex's ~5 req/s ceiling
/** Parallel Neon upserts per chunk — collapses ~100 sequential round-trips into ~13. */
const UPSERT_CONCURRENCY = 8;
const SOURCE = 'mangadex' as const;

type MangaDexRow = {
  id: string;
  attributes: {
    title?: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    description?: Record<string, string>;
    originalLanguage?: string;
    status?: string;
    year?: number | null;
    contentRating?: string;
    publicationDemographic?: string | null;
    lastChapter?: string | null;
    lastVolume?: string | null;
    createdAt?: string;
    updatedAt?: string;
    tags?: Array<{
      id: string;
      attributes?: { name?: Record<string, string>; group?: string };
    }>;
  };
  relationships?: Array<{
    type: string;
    attributes?: { fileName?: string; volume?: string | null; createdAt?: string; name?: string };
  }>;
};

/** Localized-string pick: prefer en, then ru, then romaji/ja, then first available. */
function pickLocalized(dict: Record<string, string> | undefined | null): string {
  if (!dict) return '';
  return (
    dict.en ||
    dict.ru ||
    dict['ja-ro'] ||
    dict.ja ||
    (Object.values(dict)[0] as string) ||
    ''
  );
}

function parseDate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** MangaDex `createdAtSince` must match `YYYY-MM-DDTHH:MM:SS` (no ms, no timezone). */
function toMangaDexSince(date: Date): string {
  return date.toISOString().slice(0, 19);
}

function relName(row: MangaDexRow, type: 'author' | 'artist'): string | null {
  const names = (row.relationships || [])
    .filter((r) => r.type === type && r.attributes?.name)
    .map((r) => r.attributes!.name as string);
  const unique = [...new Set(names)];
  return unique.length ? unique.join(', ') : null;
}

function mapTags(row: MangaDexRow): Array<{ name: string; group: string }> {
  return (row.attributes.tags || [])
    .map((t) => ({
      name: pickLocalized(t.attributes?.name),
      group: t.attributes?.group || 'tag',
    }))
    .filter((t) => t.name);
}

/** Nullable-Json helper: real objects/arrays pass through; empty/missing → SQL NULL. */
function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value == null) return Prisma.DbNull;
  if (Array.isArray(value) && value.length === 0) return Prisma.DbNull;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

/** Upstream row → Prisma Series create/update payload (metadata only). */
function toSeriesData(row: MangaDexRow): Prisma.SeriesCreateInput {
  const coverFileName = pickMangaDexCoverFileName(row.relationships) || null;
  const yearRaw = row.attributes.year;
  return {
    source: SOURCE,
    sourceId: row.id,
    title: pickLocalized(row.attributes.title) || row.id,
    titles: jsonOrNull(row.attributes.title),
    altTitles: jsonOrNull(row.attributes.altTitles),
    description: pickLocalized(row.attributes.description) || null,
    descriptions: jsonOrNull(row.attributes.description),
    coverFileName,
    coverUrl: coverFileName ? buildMangaDexCoverUrl(row.id, coverFileName) || null : null,
    contentRating: row.attributes.contentRating ?? null,
    status: row.attributes.status ?? null,
    year: typeof yearRaw === 'number' ? yearRaw : null,
    originalLanguage: row.attributes.originalLanguage ?? null,
    demographic: row.attributes.publicationDemographic ?? null,
    author: relName(row, 'author'),
    artist: relName(row, 'artist'),
    tags: jsonOrNull(mapTags(row)),
    lastChapter: row.attributes.lastChapter ?? null,
    lastVolume: row.attributes.lastVolume ?? null,
    sourceCreatedAt: parseDate(row.attributes.createdAt),
    sourceUpdatedAt: parseDate(row.attributes.updatedAt),
  };
}

/** MangaDex `/manga` sort orders we page by. */
type MangaDexOrder = { key: string; val: 'asc' | 'desc' };
/** Full-catalog backfill: stable, never-changing key (paged via createdAtSince watermark). */
const ORDER_CREATED_ASC: MangaDexOrder = { key: 'order[createdAt]', val: 'asc' };
/** Freshness: titles whose newest chapter dropped most recently — the "last news" feed. */
const ORDER_LATEST_CHAPTER_DESC: MangaDexOrder = { key: 'order[latestUploadedChapter]', val: 'desc' };

async function fetchMangaPage(input: {
  order: MangaDexOrder;
  createdAtSince: string | null;
  offset: number;
}): Promise<{ rows: MangaDexRow[]; total: number }> {
  const params = new URLSearchParams();
  params.set('limit', String(PAGE_LIMIT));
  params.set('offset', String(input.offset));
  params.set(input.order.key, input.order.val);
  params.append('includes[]', 'cover_art');
  params.append('includes[]', 'author');
  params.append('includes[]', 'artist');
  for (const r of INGEST_CONTENT_RATINGS) params.append('contentRating[]', r);
  if (input.createdAtSince) params.set('createdAtSince', input.createdAtSince);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${MANGADEX_API}/manga?${params.toString()}`, {
      headers: MANGADEX_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`MangaDex /manga ${res.status}`);
    }
    const data = (await res.json()) as { data?: MangaDexRow[]; total?: number };
    return { rows: data.data || [], total: typeof data.total === 'number' ? data.total : 0 };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type IngestResult = {
  ok: boolean;
  requested: number;
  upserted: number;
  failed: number;
  exhausted: boolean;
  /** Site URLs for the titles touched this run — feed straight into IndexNow. */
  seriesUrls: string[];
  note?: string;
};

type PassResult = {
  upserted: number;
  failed: number;
  urls: string[];
  /** Newest createdAt seen this pass — used to advance the backfill watermark. */
  maxCreatedAt: Date | null;
  /** True when a short page signalled the end of the ordered list. */
  exhausted: boolean;
  note?: string;
};

/**
 * Shared engine: page through `/manga` (via `fetchPage`) and upsert up to `target` rows,
 * in small parallel chunks. Ordering + windowing is the caller's concern — this only owns
 * the upsert loop, URL collection and failure accounting. Never throws.
 */
async function runIngestPass(opts: {
  target: number;
  origin: string;
  fetchPage: (offset: number) => Promise<{ rows: MangaDexRow[]; total: number }>;
}): Promise<PassResult> {
  let upserted = 0;
  let failed = 0;
  let offset = 0;
  let exhausted = false;
  let maxCreatedAt: Date | null = null;
  const urls: string[] = [];
  let note: string | undefined;

  while (upserted < opts.target) {
    let page: { rows: MangaDexRow[]; total: number };
    try {
      page = await opts.fetchPage(offset);
    } catch (e) {
      note = `fetch failed at offset ${offset}: ${(e as Error).message}`;
      break;
    }

    if (page.rows.length === 0) {
      exhausted = true;
      break;
    }

    // Respect `target` even mid-page, then upsert the slice in small parallel chunks.
    const rows = page.rows.slice(0, opts.target - upserted);
    for (let i = 0; i < rows.length; i += UPSERT_CONCURRENCY) {
      const chunk = rows.slice(i, i + UPSERT_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (row) => {
          const data = toSeriesData(row);
          await prisma.series.upsert({
            where: { source_sourceId: { source: SOURCE, sourceId: row.id } },
            create: data,
            update: data,
          });
          return { row, data };
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          upserted += 1;
          const { row, data } = r.value;
          if (data.contentRating !== 'erotica') {
            urls.push(`${opts.origin}/library/mangadex/${row.id}`);
          }
          const created = parseDate(row.attributes.createdAt);
          if (created && (!maxCreatedAt || created > maxCreatedAt)) maxCreatedAt = created;
        } else {
          failed += 1;
        }
      }
    }

    // Short page => reached the tail of the ordered list.
    if (page.rows.length < PAGE_LIMIT) {
      exhausted = true;
      break;
    }

    offset += PAGE_LIMIT;
    if (upserted < opts.target) await sleep(DELAY_BETWEEN_PAGES_MS);
  }

  return { upserted, failed, urls, maxCreatedAt, exhausted, note };
}

/**
 * BACKFILL pass — walk the whole catalog oldest-first, advancing the `createdAtSince`
 * watermark so we sidestep MangaDex's 10k offset cap. Builds the long-tail base over time.
 * Idempotent. Never throws; returns `ok:false` + note on partial upstream failure.
 */
export async function ingestMangaDex({ target = 500 }: { target?: number } = {}): Promise<IngestResult> {
  const origin = getPublicSiteUrl().replace(/\/$/, '');
  const run = await prisma.ingestRun.create({ data: { source: SOURCE, requested: target, note: 'backfill' } });

  const cursor =
    (await prisma.ingestCursor.findUnique({ where: { id: SOURCE } })) ??
    (await prisma.ingestCursor.create({ data: { id: SOURCE, source: SOURCE } }));

  const createdAtSince = cursor.createdAtWatermark ? toMangaDexSince(cursor.createdAtWatermark) : null;

  const pass = await runIngestPass({
    target,
    origin,
    fetchPage: (offset) => fetchMangaPage({ order: ORDER_CREATED_ASC, createdAtSince, offset }),
  });

  const priorWatermark = cursor.createdAtWatermark ?? null;
  const newWatermark =
    pass.maxCreatedAt && (!priorWatermark || pass.maxCreatedAt > priorWatermark)
      ? pass.maxCreatedAt
      : priorWatermark;

  await prisma.ingestCursor.update({
    where: { id: SOURCE },
    data: {
      createdAtWatermark: newWatermark ?? undefined,
      totalSeen: { increment: pass.upserted },
      exhausted: pass.exhausted,
    },
  });

  const ok = pass.failed === 0 && !pass.note;
  await prisma.ingestRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), upserted: pass.upserted, failed: pass.failed, ok, note: pass.note ?? 'backfill' },
  });

  return {
    ok,
    requested: target,
    upserted: pass.upserted,
    failed: pass.failed,
    exhausted: pass.exhausted,
    seriesUrls: pass.urls,
    note: pass.note,
  };
}

/**
 * FRESHNESS pass — the "last news" feed. Pulls the titles whose newest chapter dropped
 * most recently and re-upserts them, refreshing their `sourceUpdatedAt`. That bumped
 * lastmod flows into the sitemap + IndexNow ping, so search engines keep seeing the site
 * as actively updating. Stateless (no cursor): every run re-grabs the current top slice.
 */
export async function ingestMangaDexFresh({ target = 120 }: { target?: number } = {}): Promise<IngestResult> {
  const origin = getPublicSiteUrl().replace(/\/$/, '');
  const run = await prisma.ingestRun.create({ data: { source: SOURCE, requested: target, note: 'fresh' } });

  const pass = await runIngestPass({
    target,
    origin,
    fetchPage: (offset) => fetchMangaPage({ order: ORDER_LATEST_CHAPTER_DESC, createdAtSince: null, offset }),
  });

  const ok = pass.failed === 0 && !pass.note;
  await prisma.ingestRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), upserted: pass.upserted, failed: pass.failed, ok, note: pass.note ?? 'fresh' },
  });

  return {
    ok,
    requested: target,
    upserted: pass.upserted,
    failed: pass.failed,
    exhausted: pass.exhausted,
    seriesUrls: pass.urls,
    note: pass.note,
  };
}

export type DailyIngestResult = {
  ok: boolean;
  fresh: IngestResult;
  backfill: IngestResult;
  /** Deduped union of both passes' URLs — one IndexNow submission covers everything. */
  seriesUrls: string[];
};

/**
 * The daily job: FRESH first (keeps the "active site" signal strong even if backfill later
 * fails), then BACKFILL. Freshness runs regardless of backfill outcome.
 */
export async function ingestMangaDexDaily({
  freshTarget = 120,
  backfillTarget = 500,
}: { freshTarget?: number; backfillTarget?: number } = {}): Promise<DailyIngestResult> {
  const fresh = await ingestMangaDexFresh({ target: freshTarget });
  const backfill = await ingestMangaDex({ target: backfillTarget });
  return {
    ok: fresh.ok && backfill.ok,
    fresh,
    backfill,
    seriesUrls: [...new Set([...fresh.seriesUrls, ...backfill.seriesUrls])],
  };
}
