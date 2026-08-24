import { isCrawlerUserAgent, parseBrowser, parseDevice, parseOs } from '@/lib/human-check/ua';

/** Column caps — a hostile client must not be able to inflate the tables with huge fields. */
export const FIELD_LIMITS = {
  visitorId: 64,
  path: 512,
  referrer: 512,
  uiLang: 16,
  timezone: 64,
  screen: 16,
  eventName: 64,
  userAgent: 512,
} as const;

export function clamp(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Never store a raw IP. A salted hash still supports "how many distinct people" and
 * spotting a flood from one source, without keeping the address itself.
 */
async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const salt = process.env.HUMAN_CHECK_IP_SALT || process.env.JWT_SECRET || 'icomics-telemetry';
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export type RequestContext = {
  /** False when the POST came from another site — we drop those rather than count them. */
  sameOrigin: boolean;
  /** True for search engines, previewers and scripted clients: never counted as a person. */
  isCrawler: boolean;
  userAgent: string;
  country: string | null;
  city: string | null;
  region: string | null;
  device: string;
  browser: string;
  os: string;
  ipHash: string | null;
};

/** Everything the server can tell about a beacon's sender, derived once per request. */
export async function readRequestContext(request: Request): Promise<RequestContext> {
  const headers = request.headers;
  const userAgent = headers.get('user-agent') ?? '';

  // An absent Origin is normal for `navigator.sendBeacon` on a same-origin POST, so only
  // a *present and mismatched* origin is treated as foreign.
  let sameOrigin = true;
  const origin = headers.get('origin');
  if (origin) {
    const host = headers.get('host');
    try {
      sameOrigin = !host || new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }

  return {
    sameOrigin,
    isCrawler: isCrawlerUserAgent(userAgent),
    userAgent,
    // Cloudflare always sets cf-ipcountry; city/region only exist behind a Transform Rule,
    // so they stay opportunistic — the client's IANA timezone covers the gap.
    country: headers.get('cf-ipcountry') || null,
    city: headers.get('cf-ipcity') || null,
    region: headers.get('cf-region') || null,
    device: parseDevice(userAgent),
    browser: parseBrowser(userAgent),
    os: parseOs(userAgent),
    ipHash: await hashIp(
      headers.get('cf-connecting-ip') ?? headers.get('x-real-ip') ?? headers.get('x-forwarded-for'),
    ),
  };
}
