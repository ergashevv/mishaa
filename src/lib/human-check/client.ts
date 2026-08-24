import { isCrawlerUserAgent } from '@/lib/human-check/ua';
import { getVisitorId } from '@/lib/visitor-id';

export { getVisitorId };

export const HUMAN_CHECK_COOKIE = 'ics_human_ok';
export const HUMAN_CHECK_STORAGE_KEY = 'ics_human_verified';
export const HUMAN_CHECK_TIMESTAMP_KEY = 'ics_human_verified_at';
/** How long one confirmation lasts before the gate asks again. */
export const HUMAN_CHECK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing / blocked storage.
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Cookie fallback below still carries the verification.
  }
}

/** True when this browser has confirmed within the TTL. */
export function readHumanVerification(): boolean {
  if (typeof window === 'undefined') return false;

  const stored = readLocal(HUMAN_CHECK_STORAGE_KEY);
  const storedAt = readLocal(HUMAN_CHECK_TIMESTAMP_KEY);

  if (stored === 'true' && storedAt) {
    const then = Number.parseInt(storedAt, 10);
    if (Number.isFinite(then) && Date.now() - then < HUMAN_CHECK_TTL_MS) return true;
    return false;
  }

  // localStorage can be wiped or blocked while the cookie survives (and vice versa).
  try {
    return document.cookie
      .split('; ')
      .some((entry) => entry === `${HUMAN_CHECK_COOKIE}=1`);
  } catch {
    return false;
  }
}

/** Has this browser ever confirmed before? Distinguishes new visitors from returning ones. */
export function hasVerifiedBefore(): boolean {
  if (typeof window === 'undefined') return false;
  return readLocal(HUMAN_CHECK_TIMESTAMP_KEY) !== null;
}

export function persistHumanVerification() {
  if (typeof window === 'undefined') return;

  writeLocal(HUMAN_CHECK_STORAGE_KEY, 'true');
  writeLocal(HUMAN_CHECK_TIMESTAMP_KEY, Date.now().toString());

  try {
    const maxAge = Math.floor(HUMAN_CHECK_TTL_MS / 1000);
    document.cookie = `${HUMAN_CHECK_COOKIE}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {
    // Storage above already keeps the session alive.
  }
}

/**
 * The gate is for people, not machines. Search engines render JS, so without this a crawler
 * would snapshot every page behind an opaque overlay — and this site's traffic is organic search.
 */
export function shouldSkipHumanCheck(): boolean {
  if (typeof window === 'undefined') return true;
  if (isCrawlerUserAgent(navigator.userAgent)) return true;
  // `navigator.webdriver` is set by headless automation, including some SEO auditors.
  if (navigator.webdriver) return true;
  return false;
}

export type HumanCheckReport = {
  visitorId: string;
  decidedMs: number;
  repeatVisit: boolean;
};

/** Fire-and-forget: the reader is let through regardless of whether this lands. */
export function reportHumanVerification({ visitorId, decidedMs, repeatVisit }: HumanCheckReport) {
  if (typeof window === 'undefined') return;

  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }

  const body = JSON.stringify({
    visitorId,
    decidedMs,
    repeatVisit,
    timezone,
    uiLang: document.documentElement.lang || navigator.language || null,
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    screen: `${window.screen.width}x${window.screen.height}`,
  });

  void fetch('/api/human-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    cache: 'no-store',
  }).catch(() => {
    // Logging is best-effort by design.
  });
}
