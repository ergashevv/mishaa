"use server";

import { BooruSource, mapBooruDetail } from '@/lib/booru';
import {
  buildMangaDexCoverUrl,
  pickMangaDexCoverFileName,
  appendMangaDexFilters,
  cacheMangaDexIdResolution,
} from '@/lib/mangadex';
import {
  resolveMangaDexLocalizedText,
  MangaLanguage,
  getMangaDexTranslatedLanguages,
  DEFAULT_MANGA_LANGUAGE,
} from '@/lib/manga-language';
import { fetchAniListManga } from '@/lib/anilist';
import { fetchJikanManga } from '@/lib/jikan';
import { isRestrictedLibrarySource } from '@/lib/comic-sources';
import { hasAgeVerification } from './age-gate';
import { MARVEL_PUBLIC_API_BASE } from '@/lib/marvel/public-api';
import type {
  MarvelCharacter,
  MarvelCreator,
  MarvelIssue,
  MarvelSeries,
  MarvelSeriesIssue,
} from '@/lib/marvel/types';
import type { ComicChapter, ComicDetail, ComicsSearchPage } from '@/lib/comic-types';
import { normalizeMarvelImageOrLogo, normalizeMarvelImageToProxyUrl } from '@/lib/marvel/image';
import { getSuperheroApiBase, SEARCH_PAGE_LIMIT } from './internal/constants';
import { fetchJsonThroughProxy, resolveMangaDexLookupId } from './internal/mangadex-client';
import { buildMangaDexRelatedRails } from './internal/mangadex-related';
import { searchMangaDexComicsPage } from './internal/mangadex-search';
import {
  dedupeMangaDexFeedChapters,
  parseMangaDexStatistics,
  rowsToComicChapters,
  type AggVolume,
} from './internal/mangadex-chapters';
import {
  fetchNHentaiRaw,
  getNHentaiPageEntries,
  NHENTAI_CACHE_KEY_REV,
  NHentaiGallery,
  NHentaiTag,
  nhentaiCache,
  resolveNHentaiImageExt,
  searchNHentai,
} from './internal/nhentai-internal';

export { fetchNHentaiRaw };

export type {
  MarvelCharacter,
  MarvelCreator,
  MarvelIssue,
  MarvelSeries,
  MarvelSeriesIssue,
} from '@/lib/marvel/types';

interface MangaDexRelationship {
  type: string;
  attributes?: {
    name?: string;
  };
}

interface MangaDexTag {
  attributes: {
    name: Record<string, string>;
  };
}

export async function getComicDetails(
  source: string,
  id: string,
  mangaLanguage: MangaLanguage = DEFAULT_MANGA_LANGUAGE,
  options?: { enrich?: boolean },
): Promise<ComicDetail | null> {
  try {
    if (isRestrictedLibrarySource(source) && !(await hasAgeVerification())) {
      return null;
    }

    if (source === 'superhero') {
      const res = await fetch(`${getSuperheroApiBase()}/${id}`, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error('Superhero fetch failed');
      const data = await res.json();
      if (data.response === 'error') throw new Error(data.error);

      return {
        id: data.id,
        title: data.name,
        description: data.biography?.['full-name'] || data.name,
        coverUrl: data.image?.url || '/logo.png',
        rating: 'Safe',
        genres: [data.biography?.publisher || 'Superhero'],
        status: 'Completed',
        year: data.biography?.['first-appearance'],
        author: data.biography?.publisher || 'Unknown',
        source: 'superhero' as const,
        superheroData: data,
      };
    }

    if (source === 'marvel') {
      const res = await fetch(`${MARVEL_PUBLIC_API_BASE}/issues/${id}`, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error('Marvel fetch failed');
      const data = await res.json();
      const issue = data?.data?.results?.[0] || data?.items?.[0] || data;

      const cover = issue.cover || issue.thumbnail;
      const writer =
        (issue.creators || []).find((c: MarvelCreator) => c.role === 'writer')?.name || 'Marvel';

      const seriesId = issue.seriesId;
      let series: MarvelSeries | null = null;
      const characters: MarvelCharacter[] = [];
      let seriesIssues: MarvelSeriesIssue[] = [];

      if (seriesId) {
        try {
          const [seriesRes, seriesIssuesRes] = await Promise.all([
            fetch(`${MARVEL_PUBLIC_API_BASE}/series/${seriesId}`, { next: { revalidate: 3600 } }),
            fetch(`${MARVEL_PUBLIC_API_BASE}/series/${seriesId}/issues`, {
              next: { revalidate: 3600 },
            }),
          ]);
          if (seriesRes.ok) series = (await seriesRes.json()).data?.results?.[0] || null;
          if (seriesIssuesRes.ok) seriesIssues = (await seriesIssuesRes.json()).data?.results || [];
        } catch (e) {
          console.error('Marvel series fetch error:', e);
        }
      }

      return {
        id: String(issue.id),
        title: issue.title,
        description: issue.description || 'Marvel metadata only.',
        coverUrl: normalizeMarvelImageOrLogo(cover),
        bannerUrl: normalizeMarvelImageOrLogo(cover) || undefined,
        rating: issue.pageCount ? `${issue.pageCount} pages` : 'Marvel Metadata',
        genres: [issue.seriesName, 'Marvel Comics'].filter(Boolean),
        status: 'Metadata',
        year: issue.onSaleDate?.slice(0, 4),
        author: writer,
        source: 'marvel' as const,
        marvelIssue: issue,
        marvelSeries: series || undefined,
        marvelSeriesIssues: seriesIssues,
        marvelCharacters: characters,
      };
    }

    if (source === 'mangadex') {
      const mangaDexId = await resolveMangaDexLookupId(source, id);
      const mangaPath = `manga/${mangaDexId}?includes[]=cover_art&includes[]=author&includes[]=artist`;
      const statsPath = `statistics/manga/${mangaDexId}`;
      const [data, statsPayload] = await Promise.all([
        fetchJsonThroughProxy(mangaPath, `https://api.mangadex.org/${mangaPath}`),
        fetchJsonThroughProxy(statsPath, `https://api.mangadex.org/${statsPath}`).catch(() => null),
      ]);

      const manga = data.data;
      const mangaDexStats = statsPayload ? parseMangaDexStatistics(statsPayload, mangaDexId) : undefined;

      const coverFileName = pickMangaDexCoverFileName(manga.relationships);
      const author = (manga.relationships as MangaDexRelationship[]).find(
        (r) => r.type === 'author',
      )?.attributes?.name;
      const title = resolveMangaDexLocalizedText(manga.attributes.title, mangaLanguage);
      const description = resolveMangaDexLocalizedText(manga.attributes.description, mangaLanguage);
      const genres = manga.attributes.tags
        .map((t: MangaDexTag) => resolveMangaDexLocalizedText(t.attributes.name, mangaLanguage))
        .filter(Boolean);
      // Enrichment (AniList rating, MAL stats, related rails) is render-blocking for
      // the detail page, so run the three branches concurrently instead of serially.
      // The reader passes `enrich: false` — it never shows any of this data.
      const enrich = options?.enrich !== false;
      const aniListPromise =
        enrich && manga.attributes.links?.al
          ? fetchAniListManga(manga.attributes.links.al).catch(() => null)
          : Promise.resolve(null);
      const [aniListData, jikanData, related] = await Promise.all([
        aniListPromise,
        enrich && manga.attributes.links?.mal
          ? fetchJikanManga(manga.attributes.links.mal).catch(() => null)
          : Promise.resolve(null),
        enrich
          ? aniListPromise
              .then((ani) => buildMangaDexRelatedRails(manga, ani, mangaLanguage))
              .catch(() => [])
          : Promise.resolve([]),
      ]);

      if (manga.attributes.links?.al) {
        cacheMangaDexIdResolution(String(manga.attributes.links.al), manga.id);
      }

      return {
        id: manga.id,
        title: title || (Object.values(manga.attributes.title || {})[0] as string),
        description: description || 'No description available.',
        coverUrl: coverFileName ? buildMangaDexCoverUrl(manga.id, coverFileName, 'medium') : '/logo.png',
        rating: manga.attributes.contentRating,
        genres:
          genres.length > 0 ? genres : manga.attributes.tags.map((t: MangaDexTag) => t.attributes.name.en),
        status: manga.attributes.status,
        year: manga.attributes.year,
        author: author,
        source: 'mangadex' as const,
        aniListId: manga.attributes.links?.al,
        malId: manga.attributes.links?.mal,
        aniListData,
        jikanData,
        related,
        mangaDexStats,
      };
    }

    if (source === 'nhentai') {
      const data = (await fetchNHentaiRaw(`gallery/${id}`)) as NHentaiGallery | null;
      if (!data) return null;
      const pageEntries = getNHentaiPageEntries(data.images.pages);
      const firstPage = pageEntries[0];

      const related = (data as { related?: unknown[] }).related || [];

      return {
        id: data.id.toString(),
        title: data.title?.english || data.title?.japanese || 'Untitled',
        description: data.tags?.map((t: NHentaiTag) => t.name).join(', ') || 'No description',
        coverUrl: `/api/proxy/nhentai/image?path=galleries/${data.media_id}/thumb.${resolveNHentaiImageExt(data.images.thumbnail.t)}`,
        bannerUrl: firstPage
          ? `/api/proxy/nhentai/image?path=galleries/${data.media_id}/${firstPage.page}.${resolveNHentaiImageExt(firstPage.t)}`
          : `/api/proxy/nhentai/image?path=galleries/${data.media_id}/thumb.${resolveNHentaiImageExt(data.images.thumbnail.t)}`,
        rating: 'pornographic',
        genres:
          data.tags?.filter((t: NHentaiTag) => t.type === 'tag').map((t: NHentaiTag) => t.name) || [],
        status: 'Completed',
        year: data.upload_date ? new Date(data.upload_date * 1000).getFullYear().toString() : undefined,
        author: data.tags?.find((t: NHentaiTag) => t.type === 'artist')?.name || 'Unknown',
        source: 'nhentai' as const,
        related: (related as any[]).map((r: any) => {
          const relTitle =
            r.title?.english || r.title?.japanese || r.english_title || r.japanese_title || 'Untitled';
          let relCover = '/logo.png';
          if (r.images?.thumbnail?.t) {
            relCover = `/api/proxy/nhentai/image?path=galleries/${r.media_id}/thumb.${resolveNHentaiImageExt(r.images.thumbnail.t)}`;
          } else if (typeof r.thumbnail === 'string' && r.thumbnail) {
            relCover = `/api/proxy/nhentai/image?path=${encodeURIComponent(r.thumbnail)}`;
          }
          return {
            id: r.id.toString(),
            title: relTitle,
            coverUrl: relCover,
            source: 'nhentai' as const,
            rating: 'pornographic',
          };
        }),
      };
    }

    if (['e621', 'danbooru', 'gelbooru', 'rule34'].includes(source)) {
      let targetUrl = '';
      if (source === 'e621') targetUrl = `https://e621.net/posts/${id}.json`;
      else if (source === 'danbooru') targetUrl = `https://danbooru.donmai.us/posts/${id}.json`;
      else if (source === 'gelbooru')
        targetUrl = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&id=${id}&json=1`;
      else if (source === 'rule34')
        targetUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&id=${id}&json=1`;

      const res = await fetch(targetUrl, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error('Booru fetch failed');
      const pdata = await res.json();
      const post = mapBooruDetail(source as BooruSource, pdata);
      if (!post) throw new Error('Post not found');

      return {
        id: post.id,
        title: post.title || `${source.toUpperCase()} #${post.id}`,
        description: post.description || post.tags.join(', '),
        coverUrl: post.coverUrl,
        rating: post.rating,
        genres: post.tags,
        status: 'Completed',
        author: source,
        source: source as BooruSource,
      };
    }

    return null;
  } catch (error) {
    console.error('getComicDetails error:', error);
    return null;
  }
}

export async function getChapters(
  source: string,
  id: string,
  mangaLanguage: MangaLanguage = DEFAULT_MANGA_LANGUAGE,
): Promise<ComicChapter[]> {
  try {
    if (isRestrictedLibrarySource(source) && !(await hasAgeVerification())) {
      return [];
    }

    if (source === 'superhero') {
      return [{ id: '1', title: 'Character Profile', chapterNum: '1' }];
    }

    if (source === 'mangadex') {
      const mangaDexId = await resolveMangaDexLookupId(source, id);
      const translatedLanguages = getMangaDexTranslatedLanguages(mangaLanguage);

      // Aggregate is only consumed after the feed rows arrive — fetch both concurrently.
      const aggregatePromise = fetchJsonThroughProxy(
        `manga/${mangaDexId}/aggregate`,
        `https://api.mangadex.org/manga/${mangaDexId}/aggregate`,
      ).catch(() => null) as Promise<{ volumes?: Record<string, AggVolume> } | null>;

      const appendFeedIncludes = (params: URLSearchParams) => {
        params.append('includes[]', 'scanlation_group');
      };

      const buildFeedParams = (langs?: string[]) => {
        const params = new URLSearchParams({
          limit: '500',
          'order[chapter]': 'asc',
        });
        appendFeedIncludes(params);
        langs?.forEach((langCode) => params.append('translatedLanguage[]', langCode));
        return params;
      };

      let langsForDedupe = translatedLanguages ?? [];

      let params = buildFeedParams(translatedLanguages ?? undefined);
      console.log(`[MangaDex] Fetching chapters for ${id}, lang: ${mangaLanguage}`);
      let data = await fetchJsonThroughProxy(
        `manga/${mangaDexId}/feed?${params.toString()}`,
        `https://api.mangadex.org/manga/${mangaDexId}/feed?${params.toString()}`,
      );

      if ((!data.data || data.data.length === 0) && mangaLanguage !== 'en') {
        console.log(`[MangaDex] No chapters in ${mangaLanguage}, falling back to EN`);
        langsForDedupe = ['en'];
        const fallbackParams = buildFeedParams(['en']);
        data = await fetchJsonThroughProxy(
          `manga/${mangaDexId}/feed?${fallbackParams.toString()}`,
          `https://api.mangadex.org/manga/${mangaDexId}/feed?${fallbackParams.toString()}`,
        );
      }

      if (!data.data || data.data.length === 0) {
        console.log(`[MangaDex] Still empty, aggressive fallback to ALL languages`);
        langsForDedupe = [];
        const aggrParams = buildFeedParams(undefined);
        data = await fetchJsonThroughProxy(
          `manga/${mangaDexId}/feed?${aggrParams.toString()}`,
          `https://api.mangadex.org/manga/${mangaDexId}/feed?${aggrParams.toString()}`,
        );
      }

      console.log(`[MangaDex] Total chapters found: ${data.data?.length || 0}`);

      const aggregatePayload = await aggregatePromise;
      const aggVolumes =
        aggregatePayload && typeof aggregatePayload.volumes === 'object' ? aggregatePayload.volumes : undefined;

      const rawRows = Array.isArray(data.data) ? data.data : [];
      const deduped = dedupeMangaDexFeedChapters(rawRows, aggVolumes, langsForDedupe);
      return rowsToComicChapters(deduped);
    }

    if (source === 'nhentai') {
      return [{ id, title: 'Full Gallery', chapterNum: '1' }];
    }

    return [{ id, title: 'Single Item', chapterNum: '1' }];
  } catch (error) {
    console.error('getChapters error:', error);
    return [];
  }
}

export async function getChapterPages(source: string, id: string, chapterId: string) {
  try {
    if (isRestrictedLibrarySource(source) && !(await hasAgeVerification())) {
      return [];
    }

    if (source === 'superhero') {
      const res = await fetch(`${getSuperheroApiBase()}/${id}`, { next: { revalidate: 3600 } });
      const data = await res.json();
      return data.image?.url ? [data.image.url] : [];
    }

    if (source === 'mangadex') {
      const data = await fetchJsonThroughProxy(
        `at-home/server/${chapterId}`,
        `https://api.mangadex.org/at-home/server/${chapterId}`,
      );
      const baseUrl = data.baseUrl;
      const hash = data.chapter?.hash;
      let fileNames = data.chapter?.data;
      let quality = 'data';

      if (!fileNames || fileNames.length === 0) {
        fileNames = data.chapter?.dataSaver;
        quality = 'data-saver';
      }

      if (!baseUrl || !hash || !fileNames || fileNames.length === 0) {
        console.error('MangaDex at-home response missing data:', data);
        return [];
      }

      return fileNames.map(
        (n: string) => `/api/proxy/image?url=${encodeURIComponent(`${baseUrl}/${quality}/${hash}/${n}`)}`,
      );
    }

    if (source === 'nhentai') {
      const data = (await fetchNHentaiRaw(`gallery/${id}`)) as NHentaiGallery | null;
      if (!data) return [];
      const pageEntries = getNHentaiPageEntries(data.images.pages);
      return pageEntries.map((p: { page: number; t: string }) => {
        const ext = resolveNHentaiImageExt(p.t);
        return `/api/proxy/nhentai/image?path=${encodeURIComponent(`galleries/${data.media_id}/${p.page}.${ext}`)}`;
      });
    }

    if (['e621', 'danbooru', 'gelbooru', 'rule34'].includes(source)) {
      // Booru posts are single images — reuse the detail fetch (same upstream
      // URLs and caching) and read the proxied full-size file URL.
      const detail = await getComicDetails(source, id, undefined, { enrich: false });
      return detail?.coverUrl ? [detail.coverUrl] : [];
    }

    return [];
  } catch (error) {
    console.error('getChapterPages error:', error);
    return [];
  }
}

export async function searchComics(params: {
  source: string;
  query?: string;
  page?: number;
  mangaLanguage?: MangaLanguage;
  ratings?: string[];
  originalLanguages?: string[];
  includedTagIds?: string[];
  excludedTagIds?: string[];
}): Promise<ComicsSearchPage> {
  const {
    source,
    query = '',
    page = 0,
    mangaLanguage = DEFAULT_MANGA_LANGUAGE,
    ratings,
    originalLanguages,
    includedTagIds,
    excludedTagIds,
  } = params;

  try {
    if (isRestrictedLibrarySource(source) && !(await hasAgeVerification())) {
      return { items: [], hasMore: false };
    }

    if (source === 'superhero') {
      const searchQuery = query && query.length >= 2 ? query : 'batman';
      const res = await fetch(`${getSuperheroApiBase()}/search/${encodeURIComponent(searchQuery)}`, {
        next: { revalidate: 3600 },
      });
      const data = await res.json();
      const items = data.results || [];
      return {
        items: items.map((item: any) => ({
          id: item.id,
          title: item.name,
          description: item.biography?.['full-name'] || item.name,
          coverUrl: item.image?.url || '/logo.png',
          source: 'superhero' as const,
          rating: item.biography?.publisher || 'Superhero',
        })),
        hasMore: false,
      };
    }

    if (source === 'marvel') {
      const mapMarvelItem = (item: {
        id: number | string;
        title: string;
        issueNumber?: string;
        seriesName?: string;
        onSaleDate?: string;
        yearPage?: number;
        cover?: { path: string; extension: string };
        pageCount?: number;
      }) => ({
        id: String(item.id),
        title: item.title,
        description: item.seriesName ?? '',
        // List/search payloads carry no cover — return '' so the grid renders
        // its metadata-card fallback instead of a stretched site logo.
        coverUrl: normalizeMarvelImageToProxyUrl(item.cover),
        source: 'marvel' as const,
        rating: item.pageCount ? `${item.pageCount} p` : 'Marvel',
        issueNumber: item.issueNumber,
        seriesName: item.seriesName,
        onSaleDate: item.onSaleDate,
        yearPage: item.yearPage,
        pageCount: item.pageCount,
      });

      if (query.length >= 2) {
        // `/issues` ignores `q` (it returns the unfiltered latest feed); text
        // search lives at `/search/issues`, which is unpaged and ignores
        // limit/offset — return the full result set on page 0, nothing after.
        if (page > 0) return { items: [], hasMore: false };

        const res = await fetch(
          `${MARVEL_PUBLIC_API_BASE}/search/issues?q=${encodeURIComponent(query)}`,
          { next: { revalidate: 900 } },
        );
        const data = await res.json();
        const items = data.items || [];
        return { items: items.map(mapMarvelItem), hasMore: false };
      }

      const searchParams = new URLSearchParams({
        limit: SEARCH_PAGE_LIMIT.toString(),
        offset: String(page * SEARCH_PAGE_LIMIT),
      });
      const res = await fetch(`${MARVEL_PUBLIC_API_BASE}/issues?${searchParams.toString()}`, {
        next: { revalidate: 900 },
      });
      const data = await res.json();
      const items = data.items || [];

      return {
        items: items.map(mapMarvelItem),
        hasMore: data.has_next || items.length === SEARCH_PAGE_LIMIT,
      };
    }

    if (source === 'mangadex') {
      return await searchMangaDexComicsPage({
        page,
        query,
        mangaLanguage,
        ratings,
        originalLanguages,
        includedTagIds,
        excludedTagIds,
      });
    }

    if (source === 'nhentai') {
      const data = await searchNHentai(query, page);
      if (!data) return { items: [], hasMore: false };
      const results = Array.isArray((data as any)?.result)
        ? (data as any).result
        : Array.isArray(data)
          ? data
          : [];

      if (results.length > 0) {
        console.log('[nHentai Search Result Sample]:', JSON.stringify(results[0], null, 2).substring(0, 500));

        results.slice(0, 10).forEach((item: any) => {
          const gid = (item.id ?? item.gallery_id)?.toString?.() || '';
          const gpath = gid ? `gallery/${gid}` : '';
          const prefetchKey = gpath ? `nhentai_${NHENTAI_CACHE_KEY_REV}_${gpath}` : '';
          if (gid && prefetchKey && !nhentaiCache.has(prefetchKey)) {
            fetchNHentaiRaw(gpath).catch(() => {});
          }
        });
      }

      const numPages = Number((data as any)?.num_pages ?? 0);
      return {
        items: results.map((item: any) => ({
          id: (item.id || item.gallery_id || '').toString(),
          title: item.english_title || item.title?.english || item.title?.japanese || 'Untitled',
          description: `${item.num_pages} pages`,
          coverUrl:
            (typeof item.thumbnail === 'object' ? item.thumbnail?.path : item.thumbnail)
              ? `/api/proxy/nhentai/image?path=${encodeURIComponent(typeof item.thumbnail === 'object' ? item.thumbnail?.path : (item.thumbnail || ''))}`
              : '/logo.png',
          source: 'nhentai' as const,
          rating: 'pornographic',
        })),
        hasMore: Number.isFinite(numPages) && numPages > 0 ? page + 1 < numPages : results.length > 0,
      };
    }

    return { items: [], hasMore: false };
  } catch (error) {
    console.error('searchComics error:', error);
    return { items: [], hasMore: false };
  }
}

/** Opens a globally random title from `GET /manga/random`. */
export async function getRandomMangaDexManga(): Promise<{ id: string } | null> {
  try {
    const data = await fetchJsonThroughProxy(
      'manga/random',
      'https://api.mangadex.org/manga/random',
    );
    const nid = data?.data?.id;
    return typeof nid === 'string' ? { id: nid } : null;
  } catch (error) {
    console.warn('[MangaDex] manga/random:', error);
    return null;
  }
}
