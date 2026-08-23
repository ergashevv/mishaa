import { sql } from '@/lib/sql';
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
 * DB access is raw Neon HTTP SQL (see ./sql) — Prisma's query engine can't run on the
 * Cloudflare Workers runtime.
 *
 * Two passes (see the exported functions):
 *  - FRESH:    order[latestUploadedChapter]=desc — the "last news" titles whose newest
 *              chapter dropped most recently; keeps the site's freshness signal alive.
 *  - BACKFILL: createdAt ASC + a `createdAtSince` watermark. MangaDex caps `offset` at
 *              10,000, so a plain offset walk can never sweep the full ~93k catalog;
 *              remembering the last createdAt and passing it as `createdAtSince` next run
 *              makes the walk deterministic, resumable and immune to the offset cap.
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

/** Serialize a JSON value for a jsonb column: real objects/arrays → JSON text, else null. */
function jsonParam(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return null;
  return JSON.stringify(value);
}

/**
 * Data columns for the Series upsert, in a fixed order. `id` (gen_random_uuid) and
 * `updatedAt` (now()) are supplied as SQL expressions, not params — see upsertSeries.
 */
const SERIES_DATA_COLS = [
  'source',
  '"sourceId"',
  'title',
  'titles',
  '"altTitles"',
  'description',
  'descriptions',
  '"coverFileName"',
  '"coverUrl"',
  '"contentRating"',
  'status',
  'year',
  '"originalLanguage"',
  'demographic',
  'author',
  'artist',
  'tags',
  '"lastChapter"',
  '"lastVolume"',
  '"sourceCreatedAt"',
  '"sourceUpdatedAt"',
] as const;

/** Upstream row → ordered value array matching {@link SERIES_DATA_COLS}. */
function toSeriesValues(row: MangaDexRow): unknown[] {
  const coverFileName = pickMangaDexCoverFileName(row.relationships) || null;
  const yearRaw = row.attributes.year;
  return [
    SOURCE,
    row.id,
    pickLocalized(row.attributes.title) || row.id,
    jsonParam(row.attributes.title),
    jsonParam(row.attributes.altTitles),
    pickLocalized(row.attributes.description) || null,
    jsonParam(row.attributes.description),
    coverFileName,
    coverFileName ? buildMangaDexCoverUrl(row.id, coverFileName) || null : null,
    row.attributes.contentRating ?? null,
    row.attributes.status ?? null,
    typeof yearRaw === 'number' ? yearRaw : null,
    row.attributes.originalLanguage ?? null,
    row.attributes.publicationDemographic ?? null,
    relName(row, 'author'),
    relName(row, 'artist'),
    jsonParam(mapTags(row)),
    row.attributes.lastChapter ?? null,
    row.attributes.lastVolume ?? null,
    parseDate(row.attributes.createdAt),
    parseDate(row.attributes.updatedAt),
  ];
}

const SERIES_UPDATE_CLAUSE = SERIES_DATA_COLS.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

/**
 * Bulk upsert a whole page in ONE multi-row INSERT. Cloudflare Workers cap outbound
 * subrequests per invocation (50 on the free plan), and every Neon HTTP query is one
 * subrequest — so a row-at-a-time loop of 500 upserts instantly trips "Too many
 * subrequests". Batching ~100 rows per statement keeps a 500-title run to ~5 DB
 * subrequests. Deduped by id first: ON CONFLICT can't touch the same row twice in one
 * statement.
 */
async function upsertSeriesBatch(rows: MangaDexRow[]): Promise<void> {
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  if (unique.length === 0) return;

  const cols = SERIES_DATA_COLS.length;
  const params: unknown[] = [];
  const tuples = unique.map((row, i) => {
    const vals = toSeriesValues(row);
    params.push(...vals);
    const ph = vals.map((_, j) => `$${i * cols + j + 1}`).join(', ');
    return `(gen_random_uuid()::text, now(), ${ph})`;
  });

  const text =
    `INSERT INTO "Series" (id, "updatedAt", ${SERIES_DATA_COLS.join(', ')}) ` +
    `VALUES ${tuples.join(', ')} ` +
    `ON CONFLICT (source, "sourceId") DO UPDATE SET ${SERIES_UPDATE_CLAUSE}, "updatedAt" = now()`;
  await sql(text, params);
}

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

/** MangaDex `/manga` sort orders we page by. */
type MangaDexOrder = { key: string; val: 'asc' | 'desc' };
const ORDER_CREATED_ASC: MangaDexOrder = { key: 'order[createdAt]', val: 'asc' };
const ORDER_LATEST_CHAPTER_DESC: MangaDexOrder = { key: 'order[latestUploadedChapter]', val: 'desc' };

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

    // Respect `target` even mid-page, then upsert the whole slice in ONE bulk statement
    // (Workers subrequest budget — see upsertSeriesBatch).
    const rows = page.rows.slice(0, opts.target - upserted);
    try {
      await upsertSeriesBatch(rows);
    } catch (e) {
      failed += rows.length;
      note = `upsert batch failed at offset ${offset}: ${(e as Error).message}`;
      break;
    }
    for (const row of rows) {
      upserted += 1;
      if (row.attributes.contentRating !== 'erotica') {
        urls.push(`${opts.origin}/library/mangadex/${row.id}`);
      }
      const created = parseDate(row.attributes.createdAt);
      if (created && (!maxCreatedAt || created > maxCreatedAt)) maxCreatedAt = created;
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

/** Insert an IngestRun audit row, returning its id. */
async function startRun(label: string, requested: number): Promise<string> {
  const rows = (await sql`
    INSERT INTO "IngestRun" (id, source, requested, note)
    VALUES (gen_random_uuid()::text, ${SOURCE}, ${requested}, ${label})
    RETURNING id
  `) as Array<{ id: string }>;
  return rows[0].id;
}

async function finishRun(
  id: string,
  data: { upserted: number; failed: number; ok: boolean; note: string },
): Promise<void> {
  await sql`
    UPDATE "IngestRun"
    SET "finishedAt" = now(), upserted = ${data.upserted}, failed = ${data.failed}, ok = ${data.ok}, note = ${data.note}
    WHERE id = ${id}
  `;
}

/**
 * BACKFILL pass — walk the whole catalog oldest-first, advancing the `createdAtSince`
 * watermark so we sidestep MangaDex's 10k offset cap. Builds the long-tail base over time.
 * Idempotent. Never throws; returns `ok:false` + note on partial upstream failure.
 */
export async function ingestMangaDex({ target = 500 }: { target?: number } = {}): Promise<IngestResult> {
  const origin = getPublicSiteUrl().replace(/\/$/, '');
  const runId = await startRun('backfill', target);

  // Load-or-create the cursor.
  await sql`
    INSERT INTO "IngestCursor" (id, source, "totalSeen", exhausted, "updatedAt")
    VALUES (${SOURCE}, ${SOURCE}, 0, false, now())
    ON CONFLICT (id) DO NOTHING
  `;
  const cursorRows = (await sql`
    SELECT "createdAtWatermark" FROM "IngestCursor" WHERE id = ${SOURCE}
  `) as Array<{ createdAtWatermark: string | Date | null }>;
  const priorWatermark = cursorRows[0]?.createdAtWatermark
    ? new Date(cursorRows[0].createdAtWatermark)
    : null;
  const createdAtSince = priorWatermark ? toMangaDexSince(priorWatermark) : null;

  const pass = await runIngestPass({
    target,
    origin,
    fetchPage: (offset) => fetchMangaPage({ order: ORDER_CREATED_ASC, createdAtSince, offset }),
  });

  const newWatermark =
    pass.maxCreatedAt && (!priorWatermark || pass.maxCreatedAt > priorWatermark)
      ? pass.maxCreatedAt
      : null; // null => keep existing (COALESCE below)

  await sql`
    UPDATE "IngestCursor"
    SET "createdAtWatermark" = COALESCE(${newWatermark}::timestamp, "createdAtWatermark"),
        "totalSeen" = "totalSeen" + ${pass.upserted},
        exhausted = ${pass.exhausted},
        "updatedAt" = now()
    WHERE id = ${SOURCE}
  `;

  const ok = pass.failed === 0 && !pass.note;
  await finishRun(runId, { upserted: pass.upserted, failed: pass.failed, ok, note: pass.note ?? 'backfill' });

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
  const runId = await startRun('fresh', target);

  const pass = await runIngestPass({
    target,
    origin,
    fetchPage: (offset) => fetchMangaPage({ order: ORDER_LATEST_CHAPTER_DESC, createdAtSince: null, offset }),
  });

  const ok = pass.failed === 0 && !pass.note;
  await finishRun(runId, { upserted: pass.upserted, failed: pass.failed, ok, note: pass.note ?? 'fresh' });

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
