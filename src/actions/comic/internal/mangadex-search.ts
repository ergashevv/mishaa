import {
  appendMangaDexFilters,
  buildMangaDexCoverUrl,
  pickMangaDexCoverFileName,
} from '@/lib/mangadex';
import {
  DEFAULT_MANGA_LANGUAGE,
  getMangaDexTranslatedLanguages,
  MangaLanguage,
  resolveMangaDexLocalizedText,
} from '@/lib/manga-language';
import type { ComicListItem, ComicsSearchPage } from '@/lib/comic-types';
import { SEARCH_PAGE_LIMIT } from './constants';
import { fetchJsonThroughProxy } from './mangadex-client';

/** MangaDex search page — shared by `/searchComics` and related-rails tag fallback (no circular import). */
export async function searchMangaDexComicsPage(input: {
  page: number;
  query: string;
  mangaLanguage: MangaLanguage;
  ratings?: string[];
  originalLanguages?: string[];
  includedTagIds?: string[];
  excludedTagIds?: string[];
}): Promise<ComicsSearchPage> {
  const {
    page,
    query,
    mangaLanguage = DEFAULT_MANGA_LANGUAGE,
    ratings,
    originalLanguages,
    includedTagIds,
    excludedTagIds,
  } = input;

  const translatedLanguages = getMangaDexTranslatedLanguages(mangaLanguage);
  const mdxRatings = ratings || ['safe', 'suggestive'];

  const buildMangaDexSearchParams = (langs: string[] | undefined) => {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', SEARCH_PAGE_LIMIT.toString());
    searchParams.set('offset', String(page * SEARCH_PAGE_LIMIT));
    searchParams.append('includes[]', 'cover_art');
    appendMangaDexFilters(searchParams, {
      contentRatings: mdxRatings,
      includedTagIds,
      excludedTagIds,
      originalLanguages,
      translatedLanguages: langs,
    });
    if (query.trim().length >= 2) {
      searchParams.set('title', query.trim());
      searchParams.set('order[relevance]', 'desc');
    } else {
      searchParams.set('order[followedCount]', 'desc');
    }
    return searchParams;
  };

  let params = buildMangaDexSearchParams(translatedLanguages);
  let data = await fetchJsonThroughProxy(
    `manga?${params.toString()}`,
    `https://api.mangadex.org/manga?${params.toString()}`,
  );
  let rows = data.data || [];

  if (rows.length === 0 && translatedLanguages !== undefined) {
    params = buildMangaDexSearchParams(undefined);
    data = await fetchJsonThroughProxy(
      `manga?${params.toString()}`,
      `https://api.mangadex.org/manga?${params.toString()}`,
    );
    rows = data.data || [];
  }

  const total = typeof data.total === 'number' ? data.total : 0;

  const items: ComicListItem[] = rows.map(
    (item: {
      id: string;
      attributes: {
        title: Record<string, string>;
        description: Record<string, string>;
        contentRating: string;
      };
      relationships: { type: string; attributes?: { fileName?: string; volume?: string | null; createdAt?: string } }[];
    }) => {
      const coverFileName = pickMangaDexCoverFileName(item.relationships);
      return {
        id: item.id,
        title:
          resolveMangaDexLocalizedText(item.attributes.title, mangaLanguage) ||
          (Object.values(item.attributes.title || {})[0] as string),
        description: resolveMangaDexLocalizedText(item.attributes.description, mangaLanguage) || '',
        coverUrl: coverFileName ? buildMangaDexCoverUrl(item.id, coverFileName) : '/logo.png',
        source: 'mangadex',
        rating: item.attributes.contentRating,
      };
    },
  );

  return {
    items,
    hasMore: (page + 1) * SEARCH_PAGE_LIMIT < total,
  };
}
