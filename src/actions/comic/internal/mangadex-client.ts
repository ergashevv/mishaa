import {
  cacheMangaDexIdResolution,
  getCachedMangaDexIdResolution,
  isMangaDexUuid,
  resolveMangaDexIdFromTitle,
} from '@/lib/mangadex';
import { fetchAniListManga } from '@/lib/anilist';
import { getSiteUrl } from '@/lib/site-url';

export async function fetchJsonThroughProxy(path: string, fallbackUrl?: string) {
  const proxyUrl = `${getSiteUrl()}/api/proxy/mangadex?path=${encodeURIComponent(path)}`;
  const endpoints = fallbackUrl ? [proxyUrl, fallbackUrl] : [proxyUrl];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
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
