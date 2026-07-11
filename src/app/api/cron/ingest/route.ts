import { ingestMangaDexDaily } from '@/lib/ingest/mangadex';
import { submitIndexNowUrls } from '@/lib/indexnow';
import { getPublicSiteUrl } from '@/lib/og-metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Ingest can take tens of seconds (network + DB). Give the Worker room. */
export const maxDuration = 300;

/**
 * Authorized when `CRON_SECRET` is set (Cloudflare Cron / manual trigger sends
 * `Authorization: Bearer <CRON_SECRET>`). With no secret we still allow it: the job
 * only writes our own catalog rows and pings IndexNow with our own URLs — no harmful
 * side effect from a stray trigger. Set CRON_SECRET in prod to keep it tidy.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  return request.headers.get('authorization')?.trim() === `Bearer ${secret}`;
}

/**
 * Daily catalog ingest + fast-index ping. Two passes:
 *   1. FRESH — titles with the newest chapter uploads ("last news"), so search engines
 *      keep seeing the site as actively updating (freshness signal).
 *   2. BACKFILL — the next slice of the full catalog, oldest-first, building the long-tail.
 * Then announce every touched URL to IndexNow (Bing/Yandex); Google picks them up via the
 * DB-backed sitemap on its own crawl.
 *
 * Query overrides: `?target=` → backfill count (default 500, cap 2000);
 *                  `?fresh=`  → freshness count (default 120, cap 500).
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const backfillParam = Number.parseInt(url.searchParams.get('target') ?? '', 10);
  const freshParam = Number.parseInt(url.searchParams.get('fresh') ?? '', 10);
  const backfillTarget =
    Number.isFinite(backfillParam) && backfillParam > 0 ? Math.min(backfillParam, 2000) : 500;
  const freshTarget = Number.isFinite(freshParam) && freshParam >= 0 ? Math.min(freshParam, 500) : 120;

  const result = await ingestMangaDexDaily({ freshTarget, backfillTarget });

  const origin = getPublicSiteUrl().replace(/\/$/, '');
  // Always refresh the catalog hubs; add every freshly-touched title URL (already deduped).
  const urls = new Set<string>([`${origin}/`, `${origin}/library`, ...result.seriesUrls]);

  let indexNow: { ok: boolean; status: number; submitted: number } = {
    ok: false,
    status: 0,
    submitted: 0,
  };
  try {
    const res = await submitIndexNowUrls([...urls]);
    indexNow = { ok: res.ok, status: res.status, submitted: urls.size };
  } catch (e) {
    console.error('IngestCron: IndexNow submit failed', e);
  }

  return Response.json(
    {
      ok: result.ok,
      fresh: { ingested: result.fresh.upserted, failed: result.fresh.failed, note: result.fresh.note },
      backfill: {
        ingested: result.backfill.upserted,
        failed: result.backfill.failed,
        exhausted: result.backfill.exhausted,
        note: result.backfill.note,
      },
      indexNow,
    },
    { status: result.ok ? 200 : 207 },
  );
}
