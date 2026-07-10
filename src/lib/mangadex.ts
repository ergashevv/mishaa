export const MANGADEX_LONG_STRIP_TAG_ID = '3e2b8dae-350e-4ab8-a8ce-016e844b9f0d';
/** MangaDex theme tag "Girls' Love" (Yuri / GL). */
export const MANGADEX_GIRLS_LOVE_TAG_ID = 'a3c67850-4684-404e-9b7f-c69850ee5da6';

const MANGADEX_HEADERS = {
  'User-Agent': 'iComics.wiki/1.0 (+https://icomics.wiki; contact support@icomics.wiki)',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MANGADEX_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mangaDexIdResolutionCache = new Map<string, string>();

export type MangaDexCoverRelationship = {
  type?: string;
  attributes?: {
    fileName?: string;
    volume?: string | null;
    locale?: string | null;
    createdAt?: string;
    updatedAt?: string;
    version?: number;
  };
};

type CoverSize = 'small' | 'medium' | 'original';

const coverExtensionBySize: Record<CoverSize, string> = {
  small: '.256.jpg',
  medium: '.512.jpg',
  original: '',
};

function proxyImageUrl(url: string) {
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

export function isMangaDexUuid(value: string) {
  return MANGADEX_UUID_PATTERN.test(value);
}

export function cacheMangaDexIdResolution(sourceId: string, mangaDexId: string) {
  const key = sourceId.trim();
  if (!key || !isMangaDexUuid(mangaDexId)) return;
  mangaDexIdResolutionCache.set(key, mangaDexId);
}

export function getCachedMangaDexIdResolution(sourceId: string) {
  const key = sourceId.trim();
  return key ? mangaDexIdResolutionCache.get(key) || null : null;
}

export async function searchMangaDexByTitle(title: string, limit = 1) {
  const query = title.trim();
  if (!query) return [];

  try {
    const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: MANGADEX_HEADERS,
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

export async function resolveMangaDexIdFromTitle(title: string) {
  const firstMatch = (await searchMangaDexByTitle(title, 1))[0];
  return typeof firstMatch?.id === 'string' ? firstMatch.id : null;
}

export function buildMangaDexCoverUrl(
  mangaId: string,
  fileName?: string | null,
  size: CoverSize = 'medium',
) {
  if (!mangaId || !fileName) return '';

  return proxyImageUrl(
    `https://uploads.mangadex.org/covers/${mangaId}/${fileName}${coverExtensionBySize[size]}`
  );
}

export function pickMangaDexCoverFileName(relationships: MangaDexCoverRelationship[] | undefined | null) {
  const covers = (relationships || []).filter((relationship) => relationship?.type === 'cover_art');
  if (covers.length === 0) return '';

  const preferred = covers.find((relationship) => {
    const volume = relationship.attributes?.volume;
    return volume === undefined || volume === null || volume === '';
  });

  if (preferred?.attributes?.fileName) {
    return preferred.attributes.fileName;
  }

  const sortedByVolume = [...covers].sort((left, right) => {
    const leftVolume = Number.parseFloat(left.attributes?.volume || '');
    const rightVolume = Number.parseFloat(right.attributes?.volume || '');

    if (Number.isNaN(leftVolume) && Number.isNaN(rightVolume)) return 0;
    if (Number.isNaN(leftVolume)) return 1;
    if (Number.isNaN(rightVolume)) return -1;
    if (leftVolume !== rightVolume) return leftVolume - rightVolume;

    const leftCreated = left.attributes?.createdAt ? Date.parse(left.attributes.createdAt) : Number.POSITIVE_INFINITY;
    const rightCreated = right.attributes?.createdAt ? Date.parse(right.attributes.createdAt) : Number.POSITIVE_INFINITY;
    return leftCreated - rightCreated;
  });

  return sortedByVolume[0]?.attributes?.fileName || '';
}

export function appendMangaDexFilters(
  params: URLSearchParams,
  options: {
    contentRatings: string[];
    includedTagIds?: string[];
    excludedTagIds?: string[];
    originalLanguages?: string[];
    translatedLanguages?: string[];
  },
) {
  options.contentRatings.forEach((rating) => params.append('contentRating[]', rating));
  options.includedTagIds?.forEach((tagId) => params.append('includedTags[]', tagId));
  options.excludedTagIds?.forEach((tagId) => params.append('excludedTags[]', tagId));
  options.originalLanguages?.forEach((language) => params.append('originalLanguage[]', language));
  options.translatedLanguages?.forEach((language) => params.append('availableTranslatedLanguage[]', language));
}
