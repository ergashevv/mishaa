/**
 * Ingest for the site's own analytics beacons (page views, reader swipes, bookmarks,
 * promo clicks). Previously this only `console.info`'d the payload, so every event the
 * app had been sending since launch was thrown away.
 *
 * `runtime = 'nodejs'` is mandatory: `@opennextjs/cloudflare` compiles `runtime = 'edge'`
 * routes to a stub with no loadable entrypoint, so an edge route 500s instantly in prod.
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/sql';
import { clamp, FIELD_LIMITS, readRequestContext } from '@/lib/telemetry/request-context';

/** Keep a beacon's free-form payload small; it is diagnostic context, not a document. */
function payloadJson(value: unknown): string | null {
  if (value == null || typeof value !== 'object') return null;
  try {
    const text = JSON.stringify(value);
    if (text === '{}' || text.length > 2000) return null;
    return text;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await readRequestContext(request);

    // Counting a crawler or an off-site script as a visitor would defeat the point of the
    // dashboard, which exists to show real people.
    if (!ctx.sameOrigin || ctx.isCrawler) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return new NextResponse(null, { status: 204 });

    const name = clamp(body.name, FIELD_LIMITS.eventName);
    if (!name) return new NextResponse(null, { status: 204 });

    const sql = getSql();
    await sql(
      `INSERT INTO site_event
         (name, visitor_id, path, referrer, country, city, device, browser, os,
          ui_lang, screen, timezone, ip_hash, user_agent, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
      [
        name,
        clamp(body.visitorId, FIELD_LIMITS.visitorId),
        clamp(body.path, FIELD_LIMITS.path),
        clamp(body.referrer, FIELD_LIMITS.referrer),
        ctx.country,
        ctx.city,
        ctx.device,
        ctx.browser,
        ctx.os,
        clamp(body.uiLang, FIELD_LIMITS.uiLang),
        clamp(body.screen, FIELD_LIMITS.screen),
        clamp(body.timezone, FIELD_LIMITS.timezone),
        ctx.ipHash,
        ctx.userAgent.slice(0, FIELD_LIMITS.userAgent) || null,
        payloadJson(body.payload),
      ],
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Fail soft, always: analytics must never break a page the reader is looking at.
    console.error('[analytics] ingest failed:', error);
    return new NextResponse(null, { status: 204 });
  }
}
