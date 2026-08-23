import { getSql } from '@/lib/sql';

export type Totals = {
  total: number;
  uniqueVisitors: number;
  today: number;
  last7: number;
  medianDecidedMs: number | null;
};

export type DayBucket = { day: string; count: number };
export type LabelCount = { label: string; count: number };

export type RecentRow = {
  id: string;
  createdAt: string;
  visitorId: string;
  country: string | null;
  timezone: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  uiLang: string | null;
  path: string | null;
  referrer: string | null;
  decidedMs: number | null;
  repeatVisit: boolean;
};

export type Dashboard = {
  totals: Totals;
  byDay: DayBucket[];
  byCountry: LabelCount[];
  byDevice: LabelCount[];
  byBrowser: LabelCount[];
  recent: RecentRow[];
};

type Row = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const str = (v: unknown): string | null => (v == null ? null : String(v));

/**
 * One round trip per panel, all in flight together. Neon's HTTP driver has no interactive
 * transactions, and none are needed — these are independent read-only aggregates.
 */
export async function loadDashboard(recentLimit = 60): Promise<Dashboard> {
  const sql = getSql();

  const [totalsRows, dayRows, countryRows, deviceRows, browserRows, recentRows] = await Promise.all([
    sql(`SELECT count(*)::int                                   AS total,
                count(DISTINCT visitor_id)::int                 AS unique_visitors,
                count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
                count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last7,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY decided_ms)             AS median_decided_ms
           FROM human_check`) as Promise<Row[]>,

    // generate_series keeps zero-traffic days in the chart; a gap-free axis is the whole
    // point of a trend line, and a plain GROUP BY would silently drop empty days.
    sql(`SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                count(h.id)::int             AS count
           FROM generate_series(date_trunc('day', now()) - interval '13 days',
                                date_trunc('day', now()),
                                interval '1 day') AS d(day)
           LEFT JOIN human_check h
             ON h.created_at >= d.day AND h.created_at < d.day + interval '1 day'
          GROUP BY d.day
          ORDER BY d.day`) as Promise<Row[]>,

    sql(`SELECT coalesce(country, '??') AS label, count(*)::int AS count
           FROM human_check GROUP BY 1 ORDER BY count DESC, label LIMIT 12`) as Promise<Row[]>,

    sql(`SELECT coalesce(device, 'unknown') AS label, count(*)::int AS count
           FROM human_check GROUP BY 1 ORDER BY count DESC`) as Promise<Row[]>,

    sql(`SELECT coalesce(browser, 'Other') AS label, count(*)::int AS count
           FROM human_check GROUP BY 1 ORDER BY count DESC LIMIT 8`) as Promise<Row[]>,

    sql(
      `SELECT id, created_at, visitor_id, country, timezone, device, browser, os,
              ui_lang, path, referrer, decided_ms, repeat_visit
         FROM human_check ORDER BY created_at DESC LIMIT $1`,
      [recentLimit],
    ) as Promise<Row[]>,
  ]);

  const t = totalsRows[0] ?? {};

  return {
    totals: {
      total: num(t.total),
      uniqueVisitors: num(t.unique_visitors),
      today: num(t.today),
      last7: num(t.last7),
      medianDecidedMs: t.median_decided_ms == null ? null : num(t.median_decided_ms),
    },
    byDay: dayRows.map((r) => ({ day: String(r.day), count: num(r.count) })),
    byCountry: countryRows.map((r) => ({ label: String(r.label), count: num(r.count) })),
    byDevice: deviceRows.map((r) => ({ label: String(r.label), count: num(r.count) })),
    byBrowser: browserRows.map((r) => ({ label: String(r.label), count: num(r.count) })),
    recent: recentRows.map((r) => ({
      id: String(r.id),
      createdAt: new Date(r.created_at as string).toISOString(),
      visitorId: String(r.visitor_id),
      country: str(r.country),
      timezone: str(r.timezone),
      device: str(r.device),
      browser: str(r.browser),
      os: str(r.os),
      uiLang: str(r.ui_lang),
      path: str(r.path),
      referrer: str(r.referrer),
      decidedMs: r.decided_ms == null ? null : num(r.decided_ms),
      repeatVisit: r.repeat_visit === true,
    })),
  };
}
