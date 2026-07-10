import {
  cacheMangaDexIdResolution,
  getCachedMangaDexIdResolution,
  isMangaDexUuid,
  resolveMangaDexIdFromTitle,
} from '@/lib/mangadex';
import { fetchAniListManga } from '@/lib/anilist';

/**
 * MangaDex metadata changes slowly, so cache successful responses in the Next
 * Data Cache. Uncached (`no-store`) fetches made every SSR slow and fragile — a
 * slow/rate-limited upstream left detail pages thin and `noindex`. The per-attempt
 * timeout fails fast to the fallback endpoint instead of hanging the render.
 */
const MANGADEX_REVALIDATE_SECONDS = 3600;
const MANGADEX_FETCH_TIMEOUT_MS = 8000;

/** Headers MangaDex expects (it blocks requests without a browser-like UA). */
const MANGADEX_HEADERS = {
  'User-Agent':
    'iComics.wiki/1.0 (+https://icomics.wiki; contact support@icomics.wiki)',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

/**
 * Server-side MangaDex JSON fetch. Calls api.mangadex.org DIRECTLY — previously this
 * hopped through our own `/api/proxy/mangadex` route over the public origin, costing an
 * extra HTTPS round-trip + a second serverless invocation on every detail/chapter/reader
 * render (the busiest routes). The public proxy route still exists for genuine
 * client-side/CORS callers; server code must use this direct path (AGENTS.md rule).
 *
 * `fallbackUrl` is an optional secondary endpoint retried if the primary fails.
 * `at-home/server/*` carries a ~15-min token, so it is fetched fresh (never cached).
 */
export async function fetchJsonThroughProxy(path: string, fallbackUrl?: string) {
  const directUrl = `https://api.mangadex.org/${path}`;
  const endpoints =
    fallbackUrl && fallbackUrl !== directUrl ? [directUrl, fallbackUrl] : [directUrl];
  const revalidate = path.startsWith('at-home/server') ? 0 : MANGADEX_REVALIDATE_SECONDS;

  for (const url of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MANGADEX_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: MANGADEX_HEADERS,
        signal: controller.signal,
        next: { revalidate },
      });
      const text = await res.text();
      if (!res.ok) {
        continue;
      }

      try {
        return JSON.parse(text);
      } catch {
        continue;
      }
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  // Fresh fetches failed (e.g. Cloudflare block in dev). Fall back to whatever
  // the Next.js Data Cache has for this URL, regardless of revalidation age.
  // Non-cacheable paths (at-home tokens) skip this — stale tokens 404 the reader.
  if (revalidate > 0) {
    for (const url of endpoints) {
      try {
        const staleRes = await fetch(url, { headers: MANGADEX_HEADERS, cache: 'force-cache' });
        if (staleRes.ok) {
          const text = await staleRes.text();
          return JSON.parse(text);
        }
      } catch {
        // Cache miss — nothing cached for this URL
      }
    }
  }

  throw new Error('MangaDex fetch failed');
}

export async function resolveMangaDexLookupId(source: string, id: string) {
  if (source !== 'mangadex' || isMangaDexUuid(id)) {
    return id;
  }

  const cached = getCachedMangaDexIdResolution(id);
  if (cached) {
    return cached;
  }

  const aniList = await fetchAniListManga(id);
  const title = aniList?.title.userPreferred || aniList?.title.english || aniList?.title.romaji;
  if (!title) {
    return id;
  }

  const resolved = (await resolveMangaDexIdFromTitle(title)) || id;
  cacheMangaDexIdResolution(id, resolved);
  return resolved;
}
