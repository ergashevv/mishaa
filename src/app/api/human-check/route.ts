/**
 * Ingest endpoint for the "Are you human?" gate.
 *
 * `runtime = 'nodejs'` is mandatory: `@opennextjs/cloudflare` compiles `runtime = 'edge'`
 * routes to a stub with no loadable entrypoint, so an edge route 500s instantly in prod.
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/sql';
import { isCrawlerUserAgent, parseBrowser, parseDevice, parseOs } from '@/lib/human-check/ua';

/** Column caps — a hostile client should not be able to inflate the table with megabyte fields. */
const LIMITS = {
  visitorId: 64,
  path: 512,
  referrer: 512,
  uiLang: 16,
  timezone: 64,
  screen: 16,
  userAgent: 512,
} as const;

function clamp(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Never store a raw IP. A salted hash still lets us count unique humans and spot floods. */
async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const salt = process.env.HUMAN_CHECK_IP_SALT || process.env.JWT_SECRET || 'icomics-human-check';
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export async function POST(request: Request) {
  try {
    const headers = request.headers;

    // Same-origin only. The gate is fired by our own page; this keeps casual off-site
    // scripted POSTs from padding the numbers.
    const origin = headers.get('origin');
    if (origin) {
      const host = headers.get('host');
      try {
        if (host && new URL(origin).host !== host) {
          return new NextResponse(null, { status: 204 });
        }
      } catch {
        return new NextResponse(null, { status: 204 });
      }
    }

    const userAgent = headers.get('user-agent') ?? '';
    // Belt-and-suspenders: the client already skips the gate for crawlers, so a bot arriving
    // here is either spoofing or a renderer we mis-detected. Either way, don't log it as human.
    if (isCrawlerUserAgent(userAgent)) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return new NextResponse(null, { status: 204 });

    const visitorId = clamp(body.visitorId, LIMITS.visitorId);
    if (!visitorId) return new NextResponse(null, { status: 204 });

    const decidedRaw = Number(body.decidedMs);
    const decidedMs =
      Number.isFinite(decidedRaw) && decidedRaw >= 0 && decidedRaw < 86_400_000
        ? Math.round(decidedRaw)
        : null;

    const ipHash = await hashIp(
      headers.get('cf-connecting-ip') ?? headers.get('x-real-ip') ?? headers.get('x-forwarded-for'),
    );

    const sql = getSql();
    await sql(
      `INSERT INTO human_check
         (visitor_id, country, city, region, timezone, ui_lang, path, referrer,
          device, browser, os, screen, user_agent, ip_hash, decided_ms, repeat_visit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        visitorId,
        // Cloudflare always sets cf-ipcountry; city/region only exist if a Transform Rule
        // adds them, so they stay opportunistic (the IANA timezone below covers the gap).
        headers.get('cf-ipcountry') || null,
        headers.get('cf-ipcity') || null,
        headers.get('cf-region') || null,
        clamp(body.timezone, LIMITS.timezone),
        clamp(body.uiLang, LIMITS.uiLang),
        clamp(body.path, LIMITS.path),
        clamp(body.referrer, LIMITS.referrer),
        parseDevice(userAgent),
        parseBrowser(userAgent),
        parseOs(userAgent),
        clamp(body.screen, LIMITS.screen),
        userAgent.slice(0, LIMITS.userAgent) || null,
        ipHash,
        decidedMs,
        body.repeatVisit === true,
      ],
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Fail soft, always. A logging outage must never keep a real reader off the site —
    // the client treats any response (or none) as "verified" and lets them through.
    console.error('[human-check] ingest failed:', error);
    return new NextResponse(null, { status: 204 });
  }
}
