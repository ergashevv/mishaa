import { getSql } from '@/lib/sql';
import { getPublicSiteUrl } from '@/lib/og-metadata';

export type VisitorTotals = {
  views: number;
  visitors: number;
  viewsToday: number;
  visitorsToday: number;
  visitors7d: number;
  visitors30d: number;
};

export type DayBucket = { day: string; views: number; visitors: number };
export type LabelCount = { label: string; count: number };

export type RecentVisit = {
  id: string;
  createdAt: string;
  visitorId: string | null;
  path: string | null;
  referrer: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  uiLang: string | null;
  timezone: string | null;
};

export type VisitorDashboard = {
  totals: VisitorTotals;
  byDay: DayBucket[];
  topPages: LabelCount[];
  topReferrers: LabelCount[];
  countries: LabelCount[];
  devices: LabelCount[];
  browsers: LabelCount[];
  recent: RecentVisit[];
};

type Row = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const str = (v: unknown): string | null => (v == null ? null : String(v));

/** Referrers are grouped by host — 200 distinct Google URLs are one source, not 200. */
const REFERRER_HOST = `
  CASE
    WHEN referrer IS NULL OR referrer = '' THEN 'direct / none'
    ELSE split_part(split_part(split_part(referrer, '://', 2), '/', 1), '?', 1)
  END`;

/** Our own host, so page-to-page clicks can be told apart from real acquisition. */
function siteHost(): string {
  try {
    return new URL(getPublicSiteUrl()).host;
  } catch {
    return '';
  }
}

const labelRows = (rows: Row[]): LabelCount[] =>
  rows.map((r) => ({ label: String(r.label), count: num(r.count) }));

export async function loadVisitorDashboard(recentLimit = 80): Promise<VisitorDashboard> {
  const sql = getSql();

  const [totals, days, pages, referrers, countries, devices, browsers, recent] = await Promise.all([
    sql(`SELECT count(*)::int                                                          AS views,
                count(DISTINCT visitor_id)::int                                        AS visitors,
                count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int    AS views_today,
                count(DISTINCT visitor_id) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS visitors_today,
                count(DISTINCT visitor_id) FILTER (WHERE created_at >= now() - interval '7 days')::int  AS visitors_7d,
                count(DISTINCT visitor_id) FILTER (WHERE created_at >= now() - interval '30 days')::int AS visitors_30d
           FROM site_event WHERE name = 'page_view'`) as Promise<Row[]>,

    // generate_series keeps zero-traffic days on the axis; a plain GROUP BY drops them and
    // the trend line silently lies about the gaps.
    sql(`SELECT to_char(d.day, 'YYYY-MM-DD')        AS day,
                count(e.id)::int                    AS views,
                count(DISTINCT e.visitor_id)::int   AS visitors
           FROM generate_series(date_trunc('day', now()) - interval '13 days',
                                date_trunc('day', now()), interval '1 day') AS d(day)
           LEFT JOIN site_event e
             ON e.name = 'page_view'
            AND e.created_at >= d.day AND e.created_at < d.day + interval '1 day'
          GROUP BY d.day ORDER BY d.day`) as Promise<Row[]>,

    sql(`SELECT coalesce(path, '(unknown)') AS label, count(*)::int AS count
           FROM site_event WHERE name = 'page_view'
          GROUP BY 1 ORDER BY count DESC LIMIT 12`) as Promise<Row[]>,

    // Internal page-to-page clicks are not a traffic source, so they are excluded here —
    // this card answers "how did people find us", not "what did they click next".
    sql(
      `SELECT ${REFERRER_HOST} AS label, count(*)::int AS count
         FROM site_event
        WHERE name = 'page_view'
          AND ${REFERRER_HOST} <> $1
        GROUP BY 1 ORDER BY count DESC LIMIT 10`,
      [siteHost()],
    ) as Promise<Row[]>,

    sql(`SELECT coalesce(country, '??') AS label, count(DISTINCT visitor_id)::int AS count
           FROM site_event WHERE name = 'page_view'
          GROUP BY 1 ORDER BY count DESC, label LIMIT 12`) as Promise<Row[]>,

    sql(`SELECT coalesce(device, 'unknown') AS label, count(DISTINCT visitor_id)::int AS count
           FROM site_event WHERE name = 'page_view' GROUP BY 1 ORDER BY count DESC`) as Promise<Row[]>,

    sql(`SELECT coalesce(browser, 'Other') AS label, count(DISTINCT visitor_id)::int AS count
           FROM site_event WHERE name = 'page_view'
          GROUP BY 1 ORDER BY count DESC LIMIT 8`) as Promise<Row[]>,

    sql(
      `SELECT id, created_at, visitor_id, path, referrer, country, device, browser, os, ui_lang, timezone
         FROM site_event WHERE name = 'page_view' ORDER BY created_at DESC LIMIT $1`,
      [recentLimit],
    ) as Promise<Row[]>,
  ]);

  const t = totals[0] ?? {};

  return {
    totals: {
      views: num(t.views),
      visitors: num(t.visitors),
      viewsToday: num(t.views_today),
      visitorsToday: num(t.visitors_today),
      visitors7d: num(t.visitors_7d),
      visitors30d: num(t.visitors_30d),
    },
    byDay: days.map((r) => ({
      day: String(r.day),
      views: num(r.views),
      visitors: num(r.visitors),
    })),
    topPages: labelRows(pages),
    topReferrers: labelRows(referrers),
    countries: labelRows(countries),
    devices: labelRows(devices),
    browsers: labelRows(browsers),
    recent: recent.map((r) => ({
      id: String(r.id),
      createdAt: new Date(r.created_at as string).toISOString(),
      visitorId: str(r.visitor_id),
      path: str(r.path),
      referrer: str(r.referrer),
      country: str(r.country),
      device: str(r.device),
      browser: str(r.browser),
      os: str(r.os),
      uiLang: str(r.ui_lang),
      timezone: str(r.timezone),
    })),
  };
}
