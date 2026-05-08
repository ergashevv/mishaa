import { afterAll, describe, expect, it } from 'vitest';
import { appendMangaDexFilters, buildMangaDexCoverUrl, pickMangaDexCoverFileName } from '@/lib/mangadex';
import { fetchIntegrationOk } from './fetch-integration';
import { resolveIntegrationBaseUrl } from './resolve-base-url';

/** Resolved once so every test hits the same origin (critical for caching / cookies). */
const baseUrl = resolveIntegrationBaseUrl();

const ageCookieHeader = 'age_verified=true';

async function fetchJson(fullUrl: string, init?: RequestInit): Promise<unknown> {
  return fetchIntegrationOk(fullUrl, init);
}

describe('Deployed HTTP API contracts (integration)', () => {
  it('prerequisite: deployment base URL (local dev server or Vercel preview/prod)', () => {
    expect(
      baseUrl,
      'Set INTEGRATION_BASE_URL=https://icomics.wiki or run on Vercel with VERCEL_URL. For local stack: npm run dev in another terminal, then INTEGRATION_BASE_URL=http://localhost:3000 npm run test:integration.',
    ).toBeTruthy();
  });

  describe.runIf(Boolean(baseUrl))('routes (live deployment)', () => {
    afterAll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('GET /api/proxy/mangadex returns list payload (production-style filters)', async () => {
      const qs = new URLSearchParams();
      qs.set('limit', '2');
      qs.set('offset', '0');
      qs.append('includes[]', 'cover_art');
      appendMangaDexFilters(qs, {
        contentRatings: ['safe', 'suggestive'],
        translatedLanguages: ['en'],
      });
      qs.set('order[followedCount]', 'desc');

      const path = `manga?${qs.toString()}`;

      const data = await fetchJson(
        new URL(`/api/proxy/mangadex?path=${encodeURIComponent(path)}`, baseUrl!).toString(),
      ) as {
        result?: unknown;
        data?: Array<{ id: string; relationships?: unknown[] }>;
      };

      const rows = data.data ?? [];
      expect(Array.isArray(rows), '/api/proxy/mangadex: expected data[]').toBe(true);
      expect(rows.length, '/api/proxy/mangadex: empty manga list').toBeGreaterThan(0);
      expect(typeof rows[0]?.id === 'string' && rows[0].id.length > 8).toBe(true);
    });

    it('chains MangaDex list → uploads cover → /api/proxy/image bytes', async () => {
      const listPath =
        'manga?limit=1&offset=0&includes[]=cover_art&order[followedCount]=desc';
      const list = await fetchJson(
        new URL(`/api/proxy/mangadex?path=${encodeURIComponent(listPath)}`, baseUrl!).toString(),
      ) as { data?: Array<{ id: string; relationships?: Parameters<typeof pickMangaDexCoverFileName>[0] }> };

      const first = list.data?.[0];
      expect(first?.id).toBeTruthy();

      const fileName = pickMangaDexCoverFileName(first?.relationships);
      expect(fileName, 'missing cover relationship on first manga sample').toBeTruthy();

      const upstreamCover = buildMangaDexCoverUrl(first!.id, fileName, 'medium');
      expect(upstreamCover.startsWith('/api/proxy/image?url=')).toBe(true);

      const proxyImageUrl = new URL(upstreamCover, baseUrl!).toString();
      const imgRes = await fetch(proxyImageUrl, {
        headers: { Accept: 'image/*,*/*;q=0.8' },
      });

      expect(imgRes.ok, `/api/proxy/image → ${imgRes.status}`).toBe(true);
      const ctype = imgRes.headers.get('content-type') || '';
      expect(ctype.startsWith('image/')).toBe(true);
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      expect(buf.byteLength, 'image body empty').toBeGreaterThan(400);
    });

    it('GET /api/home/data?lang=en returns shelf shapes', async () => {
      const data = await fetchJson(
        new URL('/api/home/data?lang=en', baseUrl!).toString(),
        { headers: { Cookie: ageCookieHeader } },
      ) as { shelves?: Record<string, unknown> };

      const shelves = data.shelves;
      expect(shelves && typeof shelves === 'object').toBe(true);
      expect(Array.isArray(shelves?.trending)).toBe(true);
      expect(Array.isArray(shelves?.['manga-hub'])).toBe(true);
      expect((shelves?.trending as unknown[]).length).toBeGreaterThan(0);
      expect((shelves?.['manga-hub'] as unknown[]).length).toBeGreaterThan(0);
    });

    it('POST /api/proxy/anilist returns GraphQL JSON', async () => {
      /** AniList MANGA entry (Berserk) — verifies edge → graphql.anilist.co from deployed region */
      const res = await fetch(new URL('/api/proxy/anilist', baseUrl!).toString(), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 30002 }),
      });
      expect(res.ok).toBe(true);

      const data = await res.json() as { errors?: unknown[]; data?: { Media?: { averageScore?: number | null } } };
      expect(data.errors ?? []).toHaveLength(0);
      expect(data.data?.Media).toBeTruthy();
    });

    it('GET /api/proxy/nhentai (JSON API) succeeds with age verification cookie', async () => {
      const pathParam = encodeURIComponent('v2/search?query=test&page=1');
      const payload = await fetchJson(
        new URL(`/api/proxy/nhentai?path=${pathParam}`, baseUrl!).toString(),
        { headers: { Cookie: ageCookieHeader } },
      );

      const results = Array.isArray((payload as { result?: unknown }).result)
        ? (payload as { result: unknown[] }).result
        : Array.isArray(payload)
          ? (payload as unknown[])
          : [];

      expect(results.length, 'nhentai proxy: empty search result').toBeGreaterThan(0);
    });

    it('GET /api/proxy/nhentai/image works with cookie + same-origin Referer', async () => {
      /** Stable CDN path exercised in scripts/smoke-prod.mjs */
      const path = encodeURIComponent('galleries/3911833/2.webp');

      const res = await fetch(
        new URL(`/api/proxy/nhentai/image?path=${path}`, baseUrl!).toString(),
        {
          headers: {
            Cookie: ageCookieHeader,
            Referer: `${baseUrl!}/library/nhentai/648185`,
            Accept: 'image/*,*/*;q=0.8',
          },
        },
      );

      expect(res.ok, `/api/proxy/nhentai/image HTTP ${res.status}`).toBe(true);
      const ct = res.headers.get('content-type') || '';
      expect(ct.startsWith('image/')).toBe(true);
      expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(400);
    });
  });
});
