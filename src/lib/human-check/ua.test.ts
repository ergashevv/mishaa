import { describe, it, expect } from 'vitest';
import { isCrawlerUserAgent, parseBrowser, parseDevice, parseOs } from './ua';

/**
 * The gate must never cover a page for a search engine: icomics.wiki's traffic is organic,
 * and Googlebot executes JS, so a missed crawler means an indexed "blocked" snapshot.
 */
describe('isCrawlerUserAgent', () => {
  const crawlers = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'TelegramBot (like TwitterBot)',
    'Twitterbot/1.0',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36',
    'curl/8.4.0',
    'python-requests/2.31.0',
  ];

  it.each(crawlers)('flags %s', (ua) => {
    expect(isCrawlerUserAgent(ua)).toBe(true);
  });

  const humans = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  ];

  it.each(humans)('lets %s through', (ua) => {
    expect(isCrawlerUserAgent(ua)).toBe(false);
  });

  it('treats a missing user-agent as human rather than silently gating nobody', () => {
    expect(isCrawlerUserAgent(null)).toBe(false);
    expect(isCrawlerUserAgent('')).toBe(false);
  });
});

describe('device / browser / os buckets', () => {
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const ipad =
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1';
  const androidPhone =
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const androidTablet =
    'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const win =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';

  it('separates phones, tablets and desktops', () => {
    expect(parseDevice(iphone)).toBe('mobile');
    expect(parseDevice(androidPhone)).toBe('mobile');
    expect(parseDevice(ipad)).toBe('tablet');
    expect(parseDevice(androidTablet)).toBe('tablet');
    expect(parseDevice(win)).toBe('desktop');
  });

  it('prefers the fork over the Chromium/Safari base string it also claims', () => {
    expect(parseBrowser(win)).toBe('Edge');
    expect(parseBrowser(iphone)).toBe('Safari');
    expect(parseBrowser(androidPhone)).toBe('Chrome');
    expect(
      parseBrowser('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/119 SamsungBrowser/23.0 Safari/537.36'),
    ).toBe('Samsung Internet');
  });

  it('reads the platform', () => {
    expect(parseOs(iphone)).toBe('iOS');
    expect(parseOs(androidPhone)).toBe('Android');
    expect(parseOs(win)).toBe('Windows');
    expect(parseOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126')).toBe('macOS');
  });
});
