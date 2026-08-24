import { readClientCookie } from '@/lib/cookie-client';
import { getAnalyticsConsentDecision } from '@/lib/analytics-consent';
import { getVisitorId } from '@/lib/visitor-id';
import { isCrawlerUserAgent } from '@/lib/human-check/ua';

export type AnalyticsEventName =
  | 'page_view'
  | 'comic_start_reading'
  | 'bookmark_added'
  | 'bookmark_removed'
  | 'report_opened'
  | 'report_submitted'
  | 'reader_swipe_next'
  | 'reader_swipe_prev'
  | 'promo_banner_click';

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

/** Internal surfaces are the owner looking at their own numbers, not an audience. */
const UNTRACKED_PREFIXES = ['/admin'];

export function shouldSendAnalyticsEvents(): boolean {
  if (typeof window === 'undefined') return false;
  if (UNTRACKED_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))) return false;
  // Search engines and headless automation are not visitors; keeping them out here means
  // the dashboard's "people" numbers stay honest without post-hoc filtering.
  if (isCrawlerUserAgent(navigator.userAgent) || navigator.webdriver) return false;
  if (readClientCookie('ics_analytics_consent_required') !== '1') return true;
  return getAnalyticsConsentDecision() === 'granted';
}

export const trackEvent = (name: AnalyticsEventName, payload: AnalyticsPayload = {}) => {
  if (typeof window === 'undefined') return;
  if (!shouldSendAnalyticsEvents()) return;

  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }

  const body = JSON.stringify({
    name,
    payload,
    // Same id the human-check gate records, so a confirmation and the page views around
    // it belong to one visitor rather than two unrelated rows.
    visitorId: getVisitorId(),
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    uiLang: document.documentElement.lang || navigator.language || null,
    screen: `${window.screen.width}x${window.screen.height}`,
    timezone,
    ts: Date.now(),
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/analytics', blob);
    return;
  }

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });
};

export const trackPageView = (payload: AnalyticsPayload = {}) => trackEvent('page_view', payload);
