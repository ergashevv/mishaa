import {
  cacheMangaDexIdResolution,
  getCachedMangaDexIdResolution,
  isMangaDexUuid,
  resolveMangaDexIdFromTitle,
} from '@/lib/mangadex';
import { fetchAniListManga } from '@/lib/anilist';
import { getSiteUrl } from '@/lib/site-url';

/**
 * MangaDex metadata changes slowly, so cache successful responses in the Next
 * Data Cache. Uncached (`no-store`) fetches made every SSR slow and fragile — a
 * slow/rate-limited upstream left detail pages thin and `noindex`. The per-attempt
 * timeout fails fast to the fallback endpoint instead of hanging the render.
 */
const MANGADEX_REVALIDATE_SECONDS = 3600;
const MANGADEX_FETCH_TIMEOUT_MS = 8000;

export async function fetchJsonThroughProxy(path: string, fallbackUrl?: string) {
  const proxyUrl = `${getSiteUrl()}/api/proxy/mangadex?path=${encodeURIComponent(path)}`;
  const endpoints = fallbackUrl ? [proxyUrl, fallbackUrl] : [proxyUrl];

  for (const url of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MANGADEX_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: MANGADEX_REVALIDATE_SECONDS },
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
