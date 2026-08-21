import { readClientCookie } from '@/lib/cookie-client';
import { getAnalyticsConsentDecision } from '@/lib/analytics-consent';

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

export function shouldSendAnalyticsEvents(): boolean {
  if (typeof window === 'undefined') return false;
  if (readClientCookie('ics_analytics_consent_required') !== '1') return true;
  return getAnalyticsConsentDecision() === 'granted';
}

export const trackEvent = (name: AnalyticsEventName, payload: AnalyticsPayload = {}) => {
  if (typeof window === 'undefined') return;
  if (!shouldSendAnalyticsEvents()) return;

  const body = JSON.stringify({
    name,
    payload,
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
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
