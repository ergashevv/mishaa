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
import { fetchNHentaiRaw } from "@/actions/comic";
import { getSiteUrl } from "@/lib/site-url";


const safeText = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;

async function loadMangaDex(params: URLSearchParams, lang: MangaLanguage) {
  try {
    const proxyUrl = `${getSiteUrl()}/api/proxy/mangadex?path=${encodeURIComponent(`manga?${params.toString()}`)}`;
    const res = await fetch(proxyUrl, { next: { revalidate: 3600 } });
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
  } catch { return []; }
}

async function loadNHentaiShelf(query: string, limit = 30) {
  try {
    const path = `v2/search?query=${encodeURIComponent(query)}&page=1`;
    const data = await fetchNHentaiRaw(path);
    if (!data) return [];
    const results = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
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

  const mangaParams = new URLSearchParams({ limit: '30', offset: '0', 'order[followedCount]': 'desc' });
  mangaParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(mangaParams, { ...filters, originalLanguages: ['ja'] });

  const webtoonsParams = new URLSearchParams({ limit: '30', offset: '0', 'order[followedCount]': 'desc' });
  webtoonsParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(webtoonsParams, { ...filters, includedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] });

  const manhwaParams = new URLSearchParams({ limit: '30', offset: '0', 'order[followedCount]': 'desc' });
  manhwaParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(manhwaParams, { ...filters, originalLanguages: ['ko'], excludedTagIds: [MANGADEX_LONG_STRIP_TAG_ID] });

  const latestParams = new URLSearchParams({ limit: '30', offset: '0', 'order[createdAt]': 'desc' });
  latestParams.append('includes[]', 'cover_art');
  appendMangaDexFilters(latestParams, filters);

  const adultShelves = includeAdultContent
    ? [
        loadNHentaiShelf('', 30),
        loadNHentaiShelf('milf', 30),
        loadNHentaiShelf('netorare', 30),
      ]
    : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([])];

  const [manga, webtoons, manhwa, doujinshi, milf, ntr, trending, latest] = await Promise.all([
    loadMangaDex(mangaParams, lang),
    loadMangaDex(webtoonsParams, lang),
    loadMangaDex(manhwaParams, lang),
    ...adultShelves,
    fetchTrendingAniListManga(30).then(items => items.map(item => ({
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
    loadMangaDex(latestParams, lang)
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
