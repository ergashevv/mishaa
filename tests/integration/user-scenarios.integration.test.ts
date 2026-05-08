import { describe, expect, it } from 'vitest';
import { fetchIntegration, fetchIntegrationOk } from './fetch-integration';
import { resolveIntegrationBaseUrl } from './resolve-base-url';

const baseUrl = resolveIntegrationBaseUrl();

const SHELF_KEYS_MIN = [
  'trending',
  'romance',
  'fantasy',
  'drama',
  'manga-hub',
  'new',
  'webtoons',
  'manhwa',
  'doujinshi',
  'milf',
  'ntr',
] as const;

describe('User-context HTTP scenarios (integration)', () => {
  it('prerequisite: INTEGRATION_BASE_URL / SITE_URL / VERCEL_URL', () => {
    expect(
      baseUrl,
      'Set INTEGRATION_BASE_URL (or deploy on Vercel with VERCEL_URL) to run user-scenario checks.',
    ).toBeTruthy();
  });

  describe.runIf(Boolean(baseUrl))('different “users” vs Edge routes', () => {
    it.each([
      {
        name: 'guest (no age cookie)',
        cookie: '',
        expectStatus: 403,
        expectCode: 'AGE_VERIFICATION_REQUIRED',
      },
      {
        name: 'verified (age_verified=true)',
        cookie: 'age_verified=true',
        expectStatus: 200,
        expectCode: undefined as string | undefined,
      },
      {
        name: "wrong cookie value (age_verified=false) — treated as minor / locked",
        cookie: 'age_verified=false',
        expectStatus: 403,
        expectCode: 'AGE_VERIFICATION_REQUIRED',
      },
    ])('nhentai JSON API: $name — $expectStatus', async ({ cookie, expectStatus, expectCode }) => {
      const u = new URL('/api/proxy/nhentai', baseUrl!);
      u.searchParams.set('path', 'v2/search?query=test&page=1');
      u.searchParams.set('_ib', String(Date.now()));

      const { status, json } = await fetchIntegration(u.toString(), {
        headers: cookie ? { Cookie: cookie } : {},
      });
      expect(status).toBe(expectStatus);
      if (expectCode) {
        expect((json as { code?: string }).code).toBe(expectCode);
      }
    });

    it('nhentai image: no cookie and no referer — blocked (not same as in-app <img>)', async () => {
      const u = new URL('/api/proxy/nhentai/image', baseUrl!);
      u.searchParams.set('path', 'galleries/3911833/2.webp');
      u.searchParams.set('_ib', String(Date.now()));

      const { status, json } = await fetchIntegration(u.toString(), {
        headers: {
          Accept: 'image/*,*/*;q=0.8',
        },
      });
      expect(status).toBe(403);
      expect((json as { code?: string }).code).toBe('AGE_VERIFICATION_REQUIRED');
    });

    it('nhentai image: same-origin Referer without cookie — allowed (matches reader page behaviour)', async () => {
      const u = new URL('/api/proxy/nhentai/image', baseUrl!);
      u.searchParams.set('path', 'galleries/3911833/2.webp');
      u.searchParams.set('_ib', String(Date.now()));

      const { status, ok } = await fetchIntegration(u.toString(), {
        headers: {
          Referer: `${baseUrl!}/library/nhentai/648185`,
          Accept: 'image/*,*/*;q=0.8',
        },
      });
      expect(ok, `expected 200 from image proxy, got ${status}`).toBe(true);
    });

    it('booru proxy: guest blocked before upstream', async () => {
      const url = new URL('/api/proxy/booru', baseUrl!);
      url.searchParams.set('source', 'danbooru');
      url.searchParams.set('kind', 'search');
      url.searchParams.set('query', '1girl');
      url.searchParams.set('_ib', String(Date.now()));

      const { status, json } = await fetchIntegration(url.toString());
      expect(status).toBe(403);
      expect((json as { code?: string }).code).toBe('AGE_VERIFICATION_REQUIRED');
    });

    it('profile API: anonymous user gets 401 (session-based)', async () => {
      const u = new URL('/api/profile', baseUrl!);
      u.searchParams.set('_ib', String(Date.now()));

      const { status, json } = await fetchIntegration(u.toString());
      expect(status).toBe(401);
      expect((json as { error?: string }).error).toBe('Unauthorized');
    });

    it('home /api/home/data: guest has empty adult shelves; verified loads NHentai rails', async () => {
      const guestUrl = new URL('/api/home/data', baseUrl!);
      guestUrl.searchParams.set('lang', 'en');
      guestUrl.searchParams.set('_ib', `guest-${Date.now()}`);

      const verifiedUrl = new URL('/api/home/data', baseUrl!);
      verifiedUrl.searchParams.set('lang', 'en');
      verifiedUrl.searchParams.set('_ib', `ok-${Date.now()}`);

      const guest = (await fetchIntegrationOk(guestUrl.toString())) as {
        shelves?: Record<string, unknown[]>;
      };

      const verified = (await fetchIntegrationOk(verifiedUrl.toString(), {
        headers: { Cookie: 'age_verified=true' },
      })) as { shelves?: Record<string, unknown[]> };

      for (const k of ['doujinshi', 'milf', 'ntr'] as const) {
        expect(Array.isArray(guest.shelves?.[k])).toBe(true);
        expect((guest.shelves?.[k] ?? []).length, `guest ${k} should stay empty`).toBe(0);
      }

      expect((verified.shelves?.doujinshi ?? []).length).toBeGreaterThan(0);
    });

    it.each([
      ['en'],
      ['ru'],
      ['es'],
      ['fr'],
      ['xx'],
    ] as const)('home data lang=%s — same shelf shape (unknown lang falls back server-side)', async (lang) => {
      const u = new URL('/api/home/data', baseUrl!);
      u.searchParams.set('lang', lang);
      u.searchParams.set('_ib', String(Date.now()));

      const data = (await fetchIntegrationOk(u.toString())) as { shelves?: Record<string, unknown> };

      const keys = Object.keys(data.shelves || {});
      for (const expected of SHELF_KEYS_MIN) {
        expect(keys).toContain(expected);
        expect(Array.isArray((data.shelves as Record<string, unknown[]>)[expected])).toBe(true);
      }
    });

    it('home feed: cache semantics differ when adult cookie is set (private vs CDN-cacheable)', async () => {
      const guestUrl = new URL('/api/home/data', baseUrl!);
      guestUrl.searchParams.set('lang', 'en');
      guestUrl.searchParams.set('mode', 'feed');
      guestUrl.searchParams.set('page', '0');
      guestUrl.searchParams.set('seed', '0');
      guestUrl.searchParams.set('_ib', `feed-guest-${Date.now()}`);

      const verifiedUrl = new URL('/api/home/data', baseUrl!);
      verifiedUrl.searchParams.set('lang', 'en');
      verifiedUrl.searchParams.set('mode', 'feed');
      verifiedUrl.searchParams.set('page', '0');
      verifiedUrl.searchParams.set('seed', '0');
      verifiedUrl.searchParams.set('_ib', `feed-age-${Date.now()}`);

      const guestRes = await fetch(guestUrl, { cache: 'no-store' });
      const verifiedRes = await fetch(verifiedUrl, {
        cache: 'no-store',
        headers: { Cookie: 'age_verified=true' },
      });

      expect(guestRes.ok && verifiedRes.ok).toBe(true);
      const guestCc = guestRes.headers.get('cache-control') || '';
      const verifiedCc = verifiedRes.headers.get('cache-control') || '';
      expect(guestCc.includes('public')).toBe(true);
      expect(verifiedCc.includes('private')).toBe(true);
    });
  });
});
