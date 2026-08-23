/**
 * Tiny user-agent classifier + crawler detector for the human-check gate.
 *
 * Hand-rolled rather than a UA-parsing dependency on purpose: the Cloudflare Worker sits
 * ~600 KiB under the 3 MiB free-plan gzip limit, so every new runtime dependency is a real
 * risk. These buckets only need to be good enough for "which device/browser was this",
 * not forensic accuracy.
 */

/** Search engines, previewers and monitors. The gate must never block these — icomics.wiki
 *  lives on organic search, and a bot that renders JS would otherwise index a covered page. */
const CRAWLER_PATTERN =
  /bot|crawler|crawling|spider|googlebot|bingbot|yandex(bot|images)|duckduckbot|baiduspider|slurp|applebot|petalbot|ahrefs|semrush|mj12bot|dotbot|facebookexternalhit|facebookcatalog|twitterbot|telegrambot|whatsapp|slackbot|discordbot|linkedinbot|embedly|quora link preview|pinterest|redditbot|vkshare|skypeuripreview|nuzzel|outbrain|w3c_validator|chrome-lighthouse|lighthouse|gtmetrix|pingdom|uptimerobot|headlesschrome|phantomjs|puppeteer|playwright|python-requests|curl\/|wget\/|axios\/|node-fetch|go-http-client|java\/|okhttp|scrapy/i;

export function isCrawlerUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return CRAWLER_PATTERN.test(ua);
}

export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

export function parseDevice(ua: string): DeviceKind {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/** Order matters: every Chromium fork also claims "Chrome", and Chrome claims "Safari". */
export function parseBrowser(ua: string): string {
  const checks: Array<[RegExp, string]> = [
    [/edg(?:e|a|ios)?\//i, 'Edge'],
    [/opr\/|opera/i, 'Opera'],
    [/samsungbrowser/i, 'Samsung Internet'],
    [/yabrowser/i, 'Yandex Browser'],
    [/ucbrowser/i, 'UC Browser'],
    [/vivaldi/i, 'Vivaldi'],
    [/brave/i, 'Brave'],
    [/firefox|fxios/i, 'Firefox'],
    [/crios|chrome/i, 'Chrome'],
    [/safari/i, 'Safari'],
  ];
  for (const [pattern, name] of checks) {
    if (pattern.test(ua)) return name;
  }
  return 'Other';
}

export function parseOs(ua: string): string {
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/iphone|ipad|ipod|ios/i.test(ua)) return 'iOS';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}
