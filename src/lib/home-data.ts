import { 
  appendMangaDexFilters, 
  cacheMangaDexIdResolution,
  type MangaDexCoverRelationship,
  resolveMangaDexIdFromTitle,
  pickMangaDexCoverFileName, 
  buildMangaDexCoverUrl, 
  MANGADEX_LONG_STRIP_TAG_ID 
} from "@/lib/mangadex";
import { fetchTrendingAniListManga } from "@/lib/anilist";
import { 
  getMangaDexTranslatedLanguages, 
  resolveMangaDexLocalizedText, 
  MangaLanguage 
} from "@/lib/manga-language";
import { NHENTAI_API_MIRRORS, NHENTAI_JSON_HEADERS } from '@/lib/nhentai';


const safeText = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;
const FETCH_TIMEOUT_MS = 7000;
export const MANGADEX_ROMANCE_TAG_ID = '423e2eae-a7a2-4a8b-ac03-a8351462d71d';
export const MANGADEX_FANTASY_TAG_ID = 'cdc58593-87dd-415e-bbc0-2ec27bf404cc';
export const MANGADEX_DRAMA_TAG_ID = 'b9af3a63-f058-46de-a9a0-e0c13906197a';

type MangaDexApiItem = {
  id: string;
  relationships?: MangaDexCoverRelationship[] | null;
  attributes?: {
    title?: Record<string, string | undefined> | null;
    description?: Record<string, string | undefined> | null;
    status?: string | null;
    contentRating?: string | null;
    tags?: Array<{ attributes?: { name?: Record<string, string | undefined> | null } | null }> | null;
  } | null;
};

type NhentaiGalleryItem = {
  id?: number | string;
  gallery_id?: number | string;
  english_title?: string;
  title?: { english?: string; japanese?: string };
  num_pages?: number;
  thumbnail?: string | { path?: string };
};

async function loadMangaDex(params: URLSearchParams, lang: MangaLanguage, fallbackParams?: URLSearchParams) {
  const fetchItems = async (queryParams: URLSearchParams) => {
    const res = await fetch(`https://api.mangadex.org/manga?${queryParams.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];

    return items.map((item: MangaDexApiItem) => {
      const coverFileName = pickMangaDexCoverFileName(item.relationships);
      const genres = (item.attributes?.tags || [])
        .map((tag) => resolveMangaDexLocalizedText(tag.attributes?.name, lang) || tag.attributes?.name?.en)
        .filter((name): name is string => Boolean(name));

      return {
        id: item.id,
        title: resolveMangaDexLocalizedText(item.attributes?.title, lang) || safeText(Object.values(item.attributes?.title || {})[0], 'Untitled'),
        description: resolveMangaDexLocalizedText(item.attributes?.description, lang) || 'Catalog entry',
        coverUrl: coverFileName ? buildMangaDexCoverUrl(item.id, coverFileName) : '/logo.png',
        source: 'mangadex' as const,
        href: `/library/mangadex/${item.id}`,
        meta: item.attributes?.status?.toUpperCase() || 'MANGA',
        rating: item.attributes?.contentRating || 'safe',
        genres,
      };
    }).filter((c: { id: string; title: string }) => c.id && c.title);
  };

  try {
    const primaryItems = await fetchItems(params);
    if (primaryItems.length > 0 || !fallbackParams) return primaryItems;

    return fetchItems(fallbackParams);
  } catch {
    return [];
  }
}

async function loadNHentaiShelf(query: string, limit = 30) {
  try {
    let results: NhentaiGalleryItem[] = [];

    for (const mirror of NHENTAI_API_MIRRORS) {
      const res = await fetch(`https://${mirror}/api/v2/search?query=${encodeURIComponent(query)}&page=1`, {
        headers: NHENTAI_JSON_HEADERS,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) continue;

      const data = await res.json();
      results = Array.isArray(data?.result) ? data.result : [];
      if (results.length > 0) break;
    }

    const seenIds = new Set<string>();
    return results.slice(0, limit).map((item: NhentaiGalleryItem) => {
      const galleryIdRaw = item.id ?? item.gallery_id;
      const galleryId =
        galleryIdRaw !== undefined && galleryIdRaw !== null && String(galleryIdRaw).trim() !== ''
          ? String(galleryIdRaw).trim()
          : '';

      const thumbnailPath = typeof item.thumbnail === 'object' ? item.thumbnail?.path : item.thumbnail;

      return {
        id: galleryId,
        title: item.english_title || item.title?.english || item.title?.japanese || "Untitled",
        description: `${item.num_pages} pages`,
        coverUrl: thumbnailPath
          ? `/api/proxy/nhentai/image?path=${encodeURIComponent(thumbnailPath)}`
          : '/logo.png',
        source: 'nhentai' as const,
        href: galleryId ? `/library/nhentai/${galleryId}` : '/library',
        meta: '18+',
        rating: '5.0',
      };
    }).filter((row) => {
      if (!row.id || !row.title) return false;
      if (seenIds.has(row.id)) return false;
      seenIds.add(row.id);
      return true;
    });
  } catch { return []; }
}

type HomeDataOptions = {
  includeAdultContent?: boolean;
};

type HomeFeedOptions = HomeDataOptions & {
  page?: number;
  seed?: number;
};

const createMangaDexParams = (
  limit: number,
  offset: number,
  order: 'popular' | 'latest',
  filters: Parameters<typeof appendMangaDexFilters>[1],
) => {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(Math.max(0, offset)),
  });
  params.append('includes[]', 'cover_art');
  params.set(order === 'popular' ? 'order[followedCount]' : 'order[createdAt]', 'desc');
  appendMangaDexFilters(params, filters);
  return params;
};

const withoutTranslatedLanguage = (params: URLSearchParams) => {
  const fallback = new URLSearchParams(params);
  fallback.delete('availableTranslatedLanguage[]');
  return fallback;
};

const dedupeBySourceId = <T extends { source: string; id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function getHomeFeed(lang: MangaLanguage = 'en', options: HomeFeedOptions = {}) {
  const page = Math.max(0, Number(options.page || 0));
  const seed = Math.max(0, Number(options.seed || 0));
  const includeAdultContent = options.includeAdultContent ?? false;
  const limit = 16;
  const offset = page * limit + (seed % 5);
  const filters = {
    contentRatings: ['safe', 'suggestive'],
    translatedLanguages: getMangaDexTranslatedLanguages(lang),
  };

  const romanceParams = createMangaDexParams(8, offset, page % 2 === 0 ? 'popular' : 'latest', {
    ...filters,
    includedTagIds: [MANGADEX_ROMANCE_TAG_ID],
  });
  const fantasyParams = createMangaDexParams(8, offset, page % 2 === 0 ? 'popular' : 'latest', {
    ...filters,
    includedTagIds: [MANGADEX_FANTASY_TAG_ID],
  });
  const dramaParams = createMangaDexParams(8, offset, page % 2 === 0 ? 'popular' : 'latest', {
    ...filters,
    includedTagIds: [MANGADEX_DRAMA_TAG_ID],
  });
  const popularParams = createMangaDexParams(8, offset, 'popular', filters);
  const latestParams = createMangaDexParams(8, offset, 'latest', filters);

  const adultPromise = includeAdultContent && page >= 2
    ? loadNHentaiShelf(page % 2 === 0 ? 'romance' : 'fantasy', 8)
    : Promise.resolve([]);

  const [romance, fantasy, drama, popular, latest, adult] = await Promise.all([
    loadMangaDex(romanceParams, lang, withoutTranslatedLanguage(romanceParams)),
    loadMangaDex(fantasyParams, lang, withoutTranslatedLanguage(fantasyParams)),
    loadMangaDex(dramaParams, lang, withoutTranslatedLanguage(dramaParams)),
    loadMangaDex(popularParams, lang, withoutTranslatedLanguage(popularParams)),
    loadMangaDex(latestParams, lang, withoutTranslatedLanguage(latestParams)),
    adultPromise,
  ]);

  const safeItems = dedupeBySourceId([
    ...romance,
    ...fantasy,
    ...drama,
    ...popular,
    ...latest,
  ]).slice(0, includeAdultContent && page >= 2 ? 20 : 28);

  return dedupeBySourceId([
    ...safeItems,
    ...adult.slice(0, 8),
  ]).slice(0, 28);
}

export async function getHomeData(lang: MangaLanguage = 'en', options: HomeDataOptions = {}) {
  const includeAdultContent = options.includeAdultContent ?? false;
  const filters = {
    contentRatings: ['safe', 'suggestive'],
    translatedLanguages: getMangaDexTranslatedLanguages(lang),
  };

  // Reduced limits for initial server load to speed up TTFB
  const mangaParams = new URLSearchParams({ limit: '12', offset: '0', 'order[followedCount]': 'desc' });
  mangaParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(mangaParams, { ...filters, originalLanguages: ['ja'] });
  const mangaFallbackParams = new URLSearchParams(mangaParams);
  mangaFallbackParams.delete('availableTranslatedLanguage[]');

  const webtoonsParams = new URLSearchParams({ limit: '12', offset: '0', 'order[followedCount]': 'desc' });
  webtoonsParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(webtoonsParams, { ...filters, includedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] });
  const webtoonsFallbackParams = new URLSearchParams(webtoonsParams);
  webtoonsFallbackParams.delete('availableTranslatedLanguage[]');

  const manhwaParams = new URLSearchParams({ limit: '12', offset: '0', 'order[followedCount]': 'desc' });
  manhwaParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(manhwaParams, { ...filters, originalLanguages: ['ko'], excludedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] });
  const manhwaFallbackParams = new URLSearchParams(manhwaParams);
  manhwaFallbackParams.delete('availableTranslatedLanguage[]');

  const latestParams = new URLSearchParams({ limit: '12', offset: '0', 'order[createdAt]': 'desc' });
  latestParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(latestParams, filters);
  const latestFallbackParams = new URLSearchParams(latestParams);
  latestFallbackParams.delete('availableTranslatedLanguage[]');

  const romanceParams = new URLSearchParams({ limit: '12', offset: '0', 'order[followedCount]': 'desc' });
  romanceParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(romanceParams, { ...filters, includedTagIds: [MANGADEX_ROMANCE_TAG_ID] });
  const romanceFallbackParams = new URLSearchParams(romanceParams);
  romanceFallbackParams.delete('availableTranslatedLanguage[]');

  const fantasyParams = new URLSearchParams({ limit: '12', offset: '0', 'order[followedCount]': 'desc' });
  fantasyParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(fantasyParams, { ...filters, includedTagIds: [MANGADEX_FANTASY_TAG_ID] });
  const fantasyFallbackParams = new URLSearchParams(fantasyParams);
  fantasyFallbackParams.delete('availableTranslatedLanguage[]');

  const dramaParams = new URLSearchParams({ limit: '12', offset: '0', 'order[followedCount]': 'desc' });
  dramaParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(dramaParams, { ...filters, includedTagIds: [MANGADEX_DRAMA_TAG_ID] });
  const dramaFallbackParams = new URLSearchParams(dramaParams);
  dramaFallbackParams.delete('availableTranslatedLanguage[]');

  const adultShelves = includeAdultContent
    ? [
        loadNHentaiShelf('doujinshi', 12),
        loadNHentaiShelf('milf', 12),
        loadNHentaiShelf('netorare', 12),
      ]
    : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([])];

  const [romance, fantasy, drama, manga, webtoons, manhwa, doujinshi, milf, ntr, trending, latest] = await Promise.all([
    loadMangaDex(romanceParams, lang, romanceFallbackParams),
    loadMangaDex(fantasyParams, lang, fantasyFallbackParams),
    loadMangaDex(dramaParams, lang, dramaFallbackParams),
    loadMangaDex(mangaParams, lang, mangaFallbackParams),
    loadMangaDex(webtoonsParams, lang, webtoonsFallbackParams),
    loadMangaDex(manhwaParams, lang, manhwaFallbackParams),
    ...adultShelves,
    fetchTrendingAniListManga(12).then(async (items) => {
      const resolved = await Promise.all(items.map(async (item, index) => {
        const title = item.title.userPreferred || item.title.english || item.title.romaji;
        const mangaDexId = title ? await resolveMangaDexIdFromTitle(title) : null;
        if (mangaDexId) {
          cacheMangaDexIdResolution(item.id.toString(), mangaDexId);
        }

        return {
          id: mangaDexId || item.id.toString(),
          title,
          description: item.description?.replace(/<[^>]*>?/gm, '').substring(0, 150) || 'Global trending pick',
          // Medium first: extraLarge spikes LCP/time-to-paint on mobile (Telegram-style slow hero loads).
          coverUrl:
            item.coverImage.medium || item.coverImage.large || item.coverImage.extraLarge || '/logo.png',
          bannerUrl: item.bannerImage || undefined,
          source: 'mangadex' as const,
          href: mangaDexId ? `/library/mangadex/${mangaDexId}` : item.siteUrl || '/library',
          meta: `TRENDING #${index + 1}`,
          rating: (item.averageScore / 10).toFixed(1) || '8.5'
        };
      }));

      return resolved;
    }).catch(() => []),
    loadMangaDex(latestParams, lang, latestFallbackParams)
  ]);

  return {
    'trending': trending,
    'romance': romance,
    'fantasy': fantasy,
    'drama': drama,
    'manga-hub': manga,
    'new': latest,
    'webtoons': webtoons,
    'manhwa': manhwa,
    'doujinshi': doujinshi,
    'milf': milf,
    'ntr': ntr,
  };
}
