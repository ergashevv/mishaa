import {
  NHENTAI_API_MIRRORS,
  NHENTAI_HTML_GALLERY_HEADERS,
  NHENTAI_HTML_GALLERY_MIRRORS,
  NHENTAI_JSON_HEADERS,
} from '@/lib/nhentai';
import { hasAgeVerification } from '../age-gate';

export interface NHentaiTag {
  type: string;
  name: string;
}

export interface NHentaiGallery {
  id: number | string;
  media_id: string;
  title: { english?: string; japanese?: string };
  tags?: NHentaiTag[];
  upload_date?: number;
  images: {
    thumbnail: { t: string };
    cover: { t: string };
    pages: Record<string, { t: string; w?: number; h?: number }> | { t: string; w?: number; h?: number }[];
  };
}

const CACHE_TTL = 1000 * 60 * 60;
/** Bump when fetch/normalization changes so poisoned cache entries are not reused. */
export const NHENTAI_CACHE_KEY_REV = 2;

export const nhentaiCache = new Map<string, { data: unknown; timestamp: number }>();

const cleanTrailingCommas = (value: string) => value.replace(/,\s*([}\]])/g, '$1');

export const resolveNHentaiImageExt = (type?: string) => {
  switch (type) {
    case 'p':
      return 'png';
    case 'g':
      return 'gif';
    case 'w':
      return 'webp';
    case 'j':
    default:
      return 'jpg';
  }
};

export const getNHentaiPageEntries = (pages: NHentaiGallery['images']['pages']) => {
  if (!pages) return [];

  if (Array.isArray(pages)) {
    return pages.map((page, index) => ({
      page: index + 1,
      ...page,
    }));
  }

  return Object.entries(pages)
    .map(([page, value]) => ({
      page: Number(page),
      ...(value || {}),
    }))
    .filter((entry) => Number.isFinite(entry.page))
    .sort((left, right) => left.page - right.page);
};

const inferNHentaiTypeChar = (filePath: string) => {
  const lower = (filePath || '').toLowerCase();
  if (lower.endsWith('.webp')) return 'w';
  if (lower.endsWith('.png')) return 'p';
  if (lower.endsWith('.gif')) return 'g';
  return 'j';
};

const isV2GalleryDetail = (data: unknown): data is Record<string, unknown> => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const row = data as Record<string, unknown>;
  return Array.isArray(row.pages) && !('images' in row);
};

const mapV2DetailToLegacy = (raw: Record<string, unknown>): NHentaiGallery | null => {
  const pages = raw.pages as Array<{ number?: number; path?: string }> | undefined;
  if (!pages?.length || raw.media_id == null || raw.id == null) return null;

  return {
    id: raw.id as number | string,
    media_id: String(raw.media_id),
    title: ((raw.title as NHentaiGallery['title']) || {}) as NHentaiGallery['title'],
    tags: raw.tags as NHentaiGallery['tags'],
    upload_date: raw.upload_date as number | undefined,
    images: {
      thumbnail: {
        t: inferNHentaiTypeChar(String((raw.thumbnail as { path?: string } | undefined)?.path || '')),
      },
      cover: {
        t: inferNHentaiTypeChar(String((raw.cover as { path?: string } | undefined)?.path || '')),
      },
      pages: [...pages]
        .map((p) => ({
          page: Number(p.number),
          t: inferNHentaiTypeChar(String(p.path || '')),
        }))
        .filter((p) => Number.isFinite(p.page))
        .sort((a, b) => a.page - b.page),
    },
  };
};

const coerceNHentaiGalleryPayload = (raw: unknown, expectedId: string): NHentaiGallery | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if ('error' in row && row.error) return null;

  let legacy: NHentaiGallery | null = null;
  if (isV2GalleryDetail(raw)) {
    legacy = mapV2DetailToLegacy(raw as Record<string, unknown>);
  } else if ((raw as NHentaiGallery).images?.pages) {
    legacy = raw as NHentaiGallery;
  } else {
    return null;
  }

  if (!legacy) return null;
  if (String(legacy.id) !== String(expectedId)) {
    console.warn(`[nHentai] Rejected gallery payload: expected id ${expectedId}, got ${legacy.id}`);
    return null;
  }
  (legacy as { related?: unknown }).related = row.related;
  return legacy;
};

export async function fetchNHentaiRaw(path: string) {
  if (!(await hasAgeVerification())) {
    return null;
  }

  const cacheKey = `nhentai_${NHENTAI_CACHE_KEY_REV}_${path}`;
  const cached = nhentaiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[nHentai] 🚀 Serving from Server Cache: ${path}`);
    return cached.data;
  }

  const galleryPathMatch = path.match(/^gallery\/([^/?]+)$/);
  const strictGalleryId = galleryPathMatch?.[1];

  if (strictGalleryId) {
    for (const mirror of NHENTAI_API_MIRRORS) {
      try {
        const url = `https://${mirror}/api/v2/galleries/${encodeURIComponent(strictGalleryId)}`;
        const res = await fetch(url, {
          headers: NHENTAI_JSON_HEADERS,
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const raw = await res.json();
        const normalized = coerceNHentaiGalleryPayload(raw, strictGalleryId);
        if (normalized) {
          nhentaiCache.set(cacheKey, { data: normalized, timestamp: Date.now() });
          console.log(`[nHentai] ✅ v2/galleries OK from ${mirror}: ${strictGalleryId}`);
          return normalized;
        }
      } catch {
        continue;
      }
    }
  }

  const isGallery = path.includes('gallery/') && !path.includes('v2/');
  const legacyGalleryId = isGallery ? path.split('/').pop() : null;

  const apiPaths = path.startsWith('v2/') ? [path, path.replace('v2/', '')] : [path, `v2/${path}`];
  const mirrors = [...NHENTAI_API_MIRRORS];

  const fetchTasks: Promise<unknown>[] = [];

  for (const mirror of mirrors) {
    for (const p of apiPaths) {
      const url = `https://${mirror}/api/${p}`;
      fetchTasks.push(
        (async () => {
          try {
            const res = await fetch(url, {
              headers: NHENTAI_JSON_HEADERS,
              next: { revalidate: 3600 },
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            if (legacyGalleryId) {
              const normalized = coerceNHentaiGalleryPayload(data, legacyGalleryId);
              if (normalized) {
                console.log(`[nHentai] ✅ API normalized from ${mirror}: ${p}`);
                return normalized;
              }
              throw new Error('Failed');
            }
            console.log(`[nHentai] ✅ API Success from ${mirror}: ${p}`);
            return data;
          } catch {
            throw new Error('Error');
          }
        })(),
      );
    }
  }

  if (isGallery && legacyGalleryId) {
    for (const mirror of NHENTAI_HTML_GALLERY_MIRRORS) {
      const gUrl = `https://${mirror}/g/${legacyGalleryId}/`;
      fetchTasks.push(
        (async () => {
          try {
            const res = await fetch(gUrl, {
              headers: NHENTAI_HTML_GALLERY_HEADERS,
              next: { revalidate: 3600 },
              signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`Gallery HTML failed: ${res.status}`);

            const html = await res.text();
            const marker = 'var gallery = new N.gallery(';
            const markerIndex = html.indexOf(marker);
            if (markerIndex < 0) throw new Error('Gallery payload not found');

            const objectStart = html.indexOf('{', markerIndex);
            if (objectStart < 0) throw new Error('Gallery payload start not found');

            const objectEnd = html.indexOf(');', objectStart);
            if (objectEnd < 0) throw new Error('Gallery payload end not found');

            const raw = html.slice(objectStart, objectEnd);
            const parsed = JSON.parse(cleanTrailingCommas(raw));
            const normalized = coerceNHentaiGalleryPayload(parsed, legacyGalleryId);
            if (!normalized) throw new Error('Gallery id mismatch');
            console.log(`[nHentai] ✅ Gallery HTML parsed from ${mirror} for ID ${legacyGalleryId}`);
            return normalized;
          } catch {
            throw new Error('Error');
          }
        })(),
      );
    }
  }

  const fallbackProxies = [
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://${NHENTAI_API_MIRRORS[0]}/api/${path}`)}`,
    `https://corsproxy.io/?${encodeURIComponent(`https://${NHENTAI_API_MIRRORS[0]}/api/${path}`)}`,
  ];
  for (const p of fallbackProxies) {
    fetchTasks.push(
      (async () => {
        try {
          const res = await fetch(p, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
          if (!res.ok) throw new Error('Failed');
          const text = await res.text();
          const data = JSON.parse(text);
          if (legacyGalleryId) {
            const normalized = coerceNHentaiGalleryPayload(data, legacyGalleryId);
            if (!normalized) throw new Error('Failed');
            console.log(`[nHentai] ✅ Proxy Success (normalized) for ${path}`);
            return normalized;
          }
          console.log(`[nHentai] ✅ Proxy Success for ${path}`);
          return data;
        } catch {
          throw new Error('Error');
        }
      })(),
    );
  }

  try {
    const result = await Promise.any(fetchTasks);
    nhentaiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    console.error(`[nHentai] 🚨 ALL TASKS FAILED for ${path}`);
    return null;
  }
}

export async function searchNHentai(query: string, page: number) {
  if (!(await hasAgeVerification())) {
    return null;
  }

  let path = '';
  const cleanQuery = query.trim() || '';

  if (!cleanQuery || cleanQuery === 'all') {
    path = `v2/search?query=%20&page=${page + 1}`;
  } else if (cleanQuery.includes('&sort=')) {
    const [q, sort] = cleanQuery.split('&sort=');
    path = `v2/search?query=${encodeURIComponent(q)}&sort=${sort}&page=${page + 1}`;
  } else {
    path = `v2/search?query=${encodeURIComponent(cleanQuery)}&page=${page + 1}`;
  }
  return fetchNHentaiRaw(path);
}
