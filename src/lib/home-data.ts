import { 
  appendMangaDexFilters, 
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


const safeText = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;

async function loadMangaDex(params: URLSearchParams, lang: MangaLanguage, fallbackParams?: URLSearchParams) {
  const fetchItems = async (queryParams: URLSearchParams) => {
    const res = await fetch(`https://api.mangadex.org/manga?${queryParams.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];

    return items.map((item: any) => {
      const coverFileName = pickMangaDexCoverFileName(item.relationships);
      return {
        id: item.id,
        title: resolveMangaDexLocalizedText(item.attributes?.title, lang) || safeText(Object.values(item.attributes?.title || {})[0], 'Untitled'),
        description: resolveMangaDexLocalizedText(item.attributes?.description, lang) || 'Catalog entry',
        coverUrl: coverFileName ? buildMangaDexCoverUrl(item.id, coverFileName) : '/logo.png',
        source: 'mangadex' as const,
        href: `/library/mangadex/${item.id}`,
        meta: item.attributes?.status?.toUpperCase() || 'MANGA',
        rating: (Math.random() * 2 + 3).toFixed(1),
      };
    }).filter((c: any) => c.id && c.title);
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
    const mirrors = ['nhentai.net', 'nhentai.xxx', 'nhentai.to'];
    let results: any[] = [];

    for (const mirror of mirrors) {
      const res = await fetch(`https://${mirror}/api/v2/search?query=${encodeURIComponent(query)}&page=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
          Referer: 'https://nhentai.net/',
        },
        next: { revalidate: 3600 },
      });

      if (!res.ok) continue;

      const data = await res.json();
      results = Array.isArray(data?.result) ? data.result : [];
      if (results.length > 0) break;
    }

    return results.slice(0, limit).map((item: any) => ({
      id: (item.id || item.gallery_id || "").toString(),
      title: item.english_title || item.title?.english || item.title?.japanese || "Untitled",
      description: `${item.num_pages} pages`,
      coverUrl: `/api/proxy/nhentai/image?path=${encodeURIComponent(typeof item.thumbnail === 'object' ? item.thumbnail?.path : (item.thumbnail || ''))}`,
      source: 'nhentai' as const,
      href: `/library/nhentai/${item.id || item.gallery_id}`,
      meta: '18+',
      rating: '5.0',
    }));
  } catch { return []; }
}

type HomeDataOptions = {
  includeAdultContent?: boolean;
};

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

  const adultShelves = includeAdultContent
    ? [
        loadNHentaiShelf('doujinshi', 12),
        loadNHentaiShelf('milf', 12),
        loadNHentaiShelf('netorare', 12),
      ]
    : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([])];

  const [manga, webtoons, manhwa, doujinshi, milf, ntr, trending, latest] = await Promise.all([
    loadMangaDex(mangaParams, lang, mangaFallbackParams),
    loadMangaDex(webtoonsParams, lang, webtoonsFallbackParams),
    loadMangaDex(manhwaParams, lang, manhwaFallbackParams),
    ...adultShelves,
    fetchTrendingAniListManga(12).then(items => items.map(item => ({
        id: item.id.toString(),
        title: item.title.userPreferred || item.title.english || item.title.romaji,
        description: item.description?.replace(/<[^>]*>?/gm, '').substring(0, 150) || 'Global trending pick',
        coverUrl: item.coverImage.extraLarge || item.coverImage.large,
        bannerUrl: item.bannerImage || undefined,
        source: 'mangadex' as const,
        href: `/library/mangadex/${item.id}`,
        meta: `TRENDING #${items.indexOf(item) + 1}`,
        rating: (item.averageScore / 10).toFixed(1) || '8.5'
    }))).catch(() => []),
    loadMangaDex(latestParams, lang, latestFallbackParams)
  ]);

  return {
    'trending': trending,
    'manga-hub': manga,
    'new': latest,
    'doujinshi': doujinshi,
    'milf': milf,
    'ntr': ntr,
    'webtoons': webtoons,
    'manhwa': manhwa,
  };
}
