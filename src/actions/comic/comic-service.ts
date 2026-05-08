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
import { normalizeMarvelImageOrLogo } from '@/lib/marvel/image';
import { getSuperheroApiBase, SEARCH_PAGE_LIMIT } from './internal/constants';
import { fetchJsonThroughProxy, resolveMangaDexLookupId } from './internal/mangadex-client';
import { buildMangaDexRelatedRails } from './internal/mangadex-related';
import { searchMangaDexComicsPage } from './internal/mangadex-search';
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
      const data = await fetchJsonThroughProxy(
        `manga/${mangaDexId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
        `https://api.mangadex.org/manga/${mangaDexId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
      );
      const manga = data.data;

      const coverFileName = pickMangaDexCoverFileName(manga.relationships);
      const author = (manga.relationships as MangaDexRelationship[]).find(
        (r) => r.type === 'author',
      )?.attributes?.name;
      const title = resolveMangaDexLocalizedText(manga.attributes.title, mangaLanguage);
      const description = resolveMangaDexLocalizedText(manga.attributes.description, mangaLanguage);
      const genres = manga.attributes.tags
        .map((t: MangaDexTag) => resolveMangaDexLocalizedText(t.attributes.name, mangaLanguage))
        .filter(Boolean);
      const aniListData = manga.attributes.links?.al
        ? await fetchAniListManga(manga.attributes.links.al)
        : null;
      const related = await buildMangaDexRelatedRails(manga, aniListData, mangaLanguage);

      if (manga.attributes.links?.al) {
        cacheMangaDexIdResolution(String(manga.attributes.links.al), manga.id);
      }

      return {
        id: manga.id,
        title: title || (Object.values(manga.attributes.title || {})[0] as string),
        description: description || 'No description available.',
        coverUrl: coverFileName ? buildMangaDexCoverUrl(manga.id, coverFileName, 'original') : '/logo.png',
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
        jikanData: manga.attributes.links?.mal ? await fetchJikanManga(manga.attributes.links.mal) : null,
        related,
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

    const res = await fetch(`https://archive.org/metadata/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error('Archive fetch failed');
    const payload = await res.json();
    const meta = payload.metadata;
    return {
      id,
      title: meta.title || id,
      description: meta.description || 'No description available.',
      coverUrl: `https://archive.org/services/img/${id}`,
      rating: 'N/A',
      genres: meta.subject ? (Array.isArray(meta.subject) ? meta.subject : [meta.subject]) : ['Classic'],
      status: 'Completed',
      year: meta.date,
      author: meta.creator || 'Unknown',
      source: 'archive' as const,
    };
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
      const params = new URLSearchParams({
        limit: '500',
        'order[chapter]': 'asc',
      });
      translatedLanguages?.forEach((lang) => params.append('translatedLanguage[]', lang));

      console.log(`[MangaDex] Fetching chapters for ${id}, lang: ${mangaLanguage}`);
      let data = await fetchJsonThroughProxy(
        `manga/${mangaDexId}/feed?${params.toString()}`,
        `https://api.mangadex.org/manga/${mangaDexId}/feed?${params.toString()}`,
      );

      if ((!data.data || data.data.length === 0) && mangaLanguage !== 'en') {
        console.log(`[MangaDex] No chapters in ${mangaLanguage}, falling back to EN`);
        const fallbackParams = new URLSearchParams({
          limit: '500',
          'order[chapter]': 'asc',
          'translatedLanguage[]': 'en',
        });
        data = await fetchJsonThroughProxy(
          `manga/${mangaDexId}/feed?${fallbackParams.toString()}`,
          `https://api.mangadex.org/manga/${mangaDexId}/feed?${fallbackParams.toString()}`,
        );
      }

      if (!data.data || data.data.length === 0) {
        console.log(`[MangaDex] Still empty, aggressive fallback to ALL languages`);
        const aggrParams = new URLSearchParams({
          limit: '500',
          'order[chapter]': 'asc',
        });
        data = await fetchJsonThroughProxy(
          `manga/${mangaDexId}/feed?${aggrParams.toString()}`,
          `https://api.mangadex.org/manga/${mangaDexId}/feed?${aggrParams.toString()}`,
        );
      }

      console.log(`[MangaDex] Total chapters found: ${data.data?.length || 0}`);

      return (
        data.data?.map(
          (ch: {
            id: string;
            attributes: {
              title?: string;
              chapter: string;
              volume?: string;
              externalUrl?: string;
            };
          }) => ({
            id: ch.id,
            title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
            chapterNum: ch.attributes.chapter,
            volume: ch.attributes.volume,
            externalUrl: ch.attributes.externalUrl,
          }),
        ) || []
      );
    }

    if (source === 'nhentai') {
      return [{ id, title: 'Full Gallery', chapterNum: '1' }];
    }

    if (source === 'archive') {
      const res = await fetch(`https://archive.org/metadata/${id}`, { next: { revalidate: 3600 } });
      const data = await res.json();
      const bookFiles =
        data.files?.filter((f: { format: string }) =>
          ['Image Container PDF', 'PDF', 'EPUB', 'Comic Book Archive'].includes(f.format),
        ) || [];

      if (bookFiles.length > 1) {
        return bookFiles.map((f: { name: string; title?: string }, i: number) => ({
          id: f.name,
          title: f.title || f.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          chapterNum: (i + 1).toString(),
        }));
      }
      return [{ id, title: 'Complete Volume', chapterNum: '1' }];
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

    if (source === 'archive') {
      const res = await fetch(`https://archive.org/metadata/${id}`, { next: { revalidate: 3600 } });
      const data = await res.json();
      const isSubFile = chapterId !== id;

      let jp2File;
      if (isSubFile) {
        const baseName = chapterId.replace(/\.[^/.]+$/, '');
        jp2File = data.files?.find(
          (f: { name: string; format: string }) =>
            f.name.includes(baseName) && f.format === 'Single Page Processed JP2 ZIP',
        );
      } else {
        jp2File = data.files?.find(
          (f: { format: string }) => f.format === 'Single Page Processed JP2 ZIP',
        );
      }

      const count = parseInt(jp2File?.filecount || data.metadata?.page_count || '100', 10);
      const pages: string[] = [];
      for (let i = 0; i < Math.min(count, 1500); i++) {
        pages.push(
          `/api/proxy/archive?action=page&id=${encodeURIComponent(id)}&page=${i}${isSubFile ? `&file=${encodeURIComponent(chapterId)}` : ''}`,
        );
      }
      return pages;
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
      const searchParams = new URLSearchParams();
      if (query.length >= 2) searchParams.set('q', query);
      else {
        searchParams.set('limit', SEARCH_PAGE_LIMIT.toString());
        searchParams.set('offset', String(page * SEARCH_PAGE_LIMIT));
      }

      const res = await fetch(`${MARVEL_PUBLIC_API_BASE}/issues?${searchParams.toString()}`, {
        next: { revalidate: 900 },
      });
      const data = await res.json();
      const items = data.items || [];

      return {
        items: items.map(
          (item: {
            id: number | string;
            title: string;
            seriesName: string;
            cover: { path: string; extension: string };
            pageCount?: number;
          }) => ({
            id: String(item.id),
            title: item.title,
            description: item.seriesName,
            coverUrl: normalizeMarvelImageOrLogo(item.cover),
            source: 'marvel' as const,
            rating: item.pageCount ? `${item.pageCount} p` : 'Marvel',
          }),
        ),
        hasMore: data.has_next || items.length === SEARCH_PAGE_LIMIT,
      };
    }

    if (source === 'mangadex') {
      return searchMangaDexComicsPage({
        page,
        query,
        mangaLanguage,
        ratings,
        originalLanguages,
        includedTagIds,
        excludedTagIds,
      });
    }

    if (source === 'archive') {
      const baseQuery =
        '(collection:comicbooksarchive OR collection:manga OR collection:comics OR (mediatype:texts AND subject:comics AND subject:manga))';
      const finalQuery = query ? `(${query}) AND ${baseQuery}` : baseQuery;
      const res = await fetch(
        `https://archive.org/advancedsearch.php?q=${encodeURIComponent(finalQuery)}&output=json&rows=${SEARCH_PAGE_LIMIT}&page=${page + 1}`,
        { next: { revalidate: 3600 } },
      );
      const data = await res.json();
      const docs = data.response.docs || [];

      const filteredDocs = docs.filter((item: { title?: string }) => {
        const title = (item.title || '').toLowerCase();
        if (title.includes('thesis') || title.includes('dissertation') || title.includes('journal article'))
          return false;
        return true;
      });

      return {
        items: filteredDocs.map((item: { identifier: string; title: string }) => ({
          id: item.identifier,
          title: item.title,
          description: '',
          coverUrl: `https://archive.org/services/img/${item.identifier}`,
          source: 'archive' as const,
          rating: 'Safe',
        })),
        hasMore: (page + 1) * SEARCH_PAGE_LIMIT < data.response.numFound,
      };
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
