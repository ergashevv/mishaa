"use server";

import { BooruSource, mapBooruDetail } from "@/lib/booru";
import { buildMangaDexCoverUrl, pickMangaDexCoverFileName, appendMangaDexFilters } from "@/lib/mangadex";
import { resolveMangaDexLocalizedText, MangaLanguage, getMangaDexTranslatedLanguages, DEFAULT_MANGA_LANGUAGE } from "@/lib/manga-language";

const MARVEL_API_BASE = "https://marvel.emreparker.com/v1";
const LIMIT = 36;

const NHENTAI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://nhentai.net/',
};

async function fetchNHentaiGallery(id: string) {
  const url = `https://nhentai.net/api/gallery/${id}`;
  try {
    const res = await fetch(url, { 
      headers: {
        ...NHENTAI_HEADERS,
        'Referer': `https://nhentai.net/g/${id}/`
      },
      next: { revalidate: 3600 } 
    });
    if (res.ok) return await res.json();

    // Fallback to a mirror or proxy if blocked by Cloudflare
    console.warn(`nHentai direct fetch failed (${res.status}), trying mirror...`);
    const mirrorUrl = `https://cinemur.com/api/gallery/${id}`;
    const mirrorRes = await fetch(mirrorUrl, { headers: NHENTAI_HEADERS });
    if (mirrorRes.ok) return await mirrorRes.json();

    console.warn(`nHentai mirror fetch failed, trying allorigins proxy...`);
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.contents) return JSON.parse(data.contents);
    }
  } catch (e) {
    console.error("fetchNHentaiGallery error:", e);
  }
  return null;
}


export async function getComicDetails(source: string, id: string, mangaLanguage: MangaLanguage = DEFAULT_MANGA_LANGUAGE) {
  try {
    if (source === 'marvel') {
      const res = await fetch(`${MARVEL_API_BASE}/issues/${id}`);
      if (!res.ok) throw new Error('Marvel fetch failed');
      const data = await res.json();
      const issue = data?.data?.results?.[0] || data?.items?.[0] || data;
      
      const cover = issue.cover || issue.thumbnail;
      const writer = (issue.creators || []).find((c: any) => c.role === 'writer')?.name || 'Marvel';

      // Background metadata for Marvel
      const seriesId = issue.seriesId;
      let series: any = null;
      let characters: any[] = [];
      let seriesIssues: any[] = [];

      if (seriesId) {
        try {
          const [seriesRes, seriesIssuesRes] = await Promise.all([
            fetch(`${MARVEL_API_BASE}/series/${seriesId}`),
            fetch(`${MARVEL_API_BASE}/series/${seriesId}/issues`)
          ]);
          if (seriesRes.ok) series = (await seriesRes.json()).data?.results?.[0] || null;
          if (seriesIssuesRes.ok) seriesIssues = (await seriesIssuesRes.json()).data?.results || [];
        } catch (e) { console.error('Marvel series fetch error:', e); }
      }

      return {
        id: String(issue.id),
        title: issue.title,
        description: issue.description || 'Marvel metadata only.',
        coverUrl: normalizeMarvelImage(cover) || '/logo.png',
        bannerUrl: normalizeMarvelImage(cover) || undefined,
        rating: issue.pageCount ? `${issue.pageCount} pages` : 'Marvel Metadata',
        genres: [issue.seriesName, 'Marvel Comics'].filter(Boolean),
        status: 'Metadata',
        year: issue.onSaleDate?.slice(0, 4),
        author: writer,
        source: 'marvel' as const,
        marvelIssue: issue,
        marvelSeries: series,
        marvelSeriesIssues: seriesIssues,
        marvelCharacters: characters // Could be added later or filtered by series name
      };
    }


    if (source === 'mangadex') {
      const res = await fetch(`https://api.mangadex.org/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`);
      if (!res.ok) throw new Error('MangaDex fetch failed');
      const data = await res.json();
      const manga = data.data;

      const coverFileName = pickMangaDexCoverFileName(manga.relationships);
      const author = manga.relationships.find((r: any) => r.type === 'author')?.attributes?.name;
      const title = resolveMangaDexLocalizedText(manga.attributes.title, mangaLanguage);
      const description = resolveMangaDexLocalizedText(manga.attributes.description, mangaLanguage);
      const genres = manga.attributes.tags.map((t: any) => resolveMangaDexLocalizedText(t.attributes.name, mangaLanguage)).filter(Boolean);

      return {
        id: manga.id,
        title: title || Object.values(manga.attributes.title || {})[0] as string,
        description: description || "No description available.",
        coverUrl: coverFileName ? buildMangaDexCoverUrl(manga.id, coverFileName) : '/logo.png',
        rating: manga.attributes.contentRating,
        genres: genres.length > 0 ? genres : manga.attributes.tags.map((t: any) => t.attributes.name.en),
        status: manga.attributes.status,
        year: manga.attributes.year,
        author: author,
        source: 'mangadex' as const,
        aniListId: manga.attributes.links?.al
      };
    }

    if (source === 'nhentai') {
      const data = await fetchNHentaiGallery(id);
      if (!data) throw new Error('nHentai fetch failed');
      
      return {
        id: data.id.toString(),
        title: data.title?.english || data.title?.japanese || "Untitled",
        description: data.tags?.map((t: any) => t.name).join(', ') || "",
        coverUrl: `https://t.nhentai.net/galleries/${data.media_id}/cover.${data.images.cover.t === 'p' ? 'png' : 'jpg'}`,
        rating: 'pornographic',
        genres: data.tags?.filter((t: any) => t.type === 'tag').map((t: any) => t.name) || [],
        status: 'Completed',
        author: data.tags?.find((t: any) => t.type === 'artist')?.name || 'Unknown',
        source: 'nhentai' as const
      };
    }

    if (['e621', 'danbooru', 'gelbooru'].includes(source)) {
      // Logic for Boorus... simpler to just call existing proxy for now but we can move it here
      const res = await fetch(`https://${source}.net/posts/${id}.json`); // Simplified for example
      if (!res.ok) throw new Error('Booru fetch failed');
      const data = await res.json();
      const post = mapBooruDetail(source as BooruSource, data);
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
        source: source as BooruSource
      };
    }

    // Default to archive
    const res = await fetch(`https://archive.org/metadata/${id}`);
    if (!res.ok) throw new Error('Archive fetch failed');
    const data = await res.json();
    const meta = data.metadata;
    return {
      id: id,
      title: meta.title || id,
      description: meta.description || "No description available.",
      coverUrl: `https://archive.org/services/img/${id}`,
      rating: "N/A",
      genres: meta.subject ? (Array.isArray(meta.subject) ? meta.subject : [meta.subject]) : ['Classic'],
      status: 'Completed',
      year: meta.date,
      author: meta.creator || 'Unknown',
      source: 'archive' as const
    };
  } catch (error) {
    console.error("getComicDetails error:", error);
    return null;
  }
}

export async function getChapters(source: string, id: string, mangaLanguage: MangaLanguage = DEFAULT_MANGA_LANGUAGE) {
  try {
    if (source === 'mangadex') {
      const translatedLanguages = getMangaDexTranslatedLanguages(mangaLanguage);
      const params = new URLSearchParams({
        limit: '500',
        'order[chapter]': 'asc',
      });
      translatedLanguages?.forEach(lang => params.append('translatedLanguage[]', lang));
      
      const res = await fetch(`https://api.mangadex.org/manga/${id}/feed?${params.toString()}`);
      let data = await res.json();
      
      // Fallback to English if no chapters found in preferred languages
      if ((!data.data || data.data.length === 0) && mangaLanguage !== 'en') {
        const fallbackParams = new URLSearchParams({
          limit: '500',
          'order[chapter]': 'asc',
          'translatedLanguage[]': 'en'
        });
        const fallbackRes = await fetch(`https://api.mangadex.org/manga/${id}/feed?${fallbackParams.toString()}`);
        data = await fallbackRes.json();
      }

      return data.data?.map((ch: any) => ({
        id: ch.id,
        title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
        chapterNum: ch.attributes.chapter,
        volume: ch.attributes.volume
      })) || [];
    }

    if (source === 'nhentai') {
      return [{ id, title: 'Full Gallery', chapterNum: '1' }];
    }

    if (source === 'archive') {
      const res = await fetch(`https://archive.org/metadata/${id}`);
      const data = await res.json();
      const bookFiles = data.files?.filter((f: any) => 
        ["Image Container PDF", "PDF", "EPUB", "Comic Book Archive"].includes(f.format)
      ) || [];

      if (bookFiles.length > 1) {
        return bookFiles.map((f: any, i: number) => ({
          id: f.name,
          title: f.title || f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
          chapterNum: (i + 1).toString()
        }));
      }
      return [{ id, title: 'Complete Volume', chapterNum: '1' }];
    }

    return [{ id, title: 'Single Item', chapterNum: '1' }];
  } catch (error) {
    console.error("getChapters error:", error);
    return [];
  }
}

export async function getChapterPages(source: string, id: string, chapterId: string) {
  try {
    if (source === 'mangadex') {
      const res = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`);
      if (!res.ok) {
        console.error(`MangaDex at-home error: ${res.status}`);
        return [];
      }
      const data = await res.json();
      const baseUrl = data.baseUrl;
      const hash = data.chapter?.hash;
      const fileNames = data.chapter?.data;

      if (!baseUrl || !hash || !fileNames) {
        console.error("MangaDex at-home response missing data:", data);
        return [];
      }

      return fileNames.map((n: string) => `/api/proxy/image?url=${encodeURIComponent(`${baseUrl}/data/${hash}/${n}`)}`);
    }

    if (source === 'nhentai') {
       const data = await fetchNHentaiGallery(id);
       if (!data) return [];
       return data.images.pages.map((p: any, i: number) => {
          const ext = p.t === 'p' ? 'png' : 'jpg';
          return `/api/proxy/nhentai/image?path=${encodeURIComponent(`galleries/${data.media_id}/${i + 1}.${ext}`)}`;
       });
    }

    if (source === 'archive') {
      const res = await fetch(`https://archive.org/metadata/${id}`);
      const data = await res.json();
      const isSubFile = chapterId !== id;
      
      let jp2File;
      if (isSubFile) {
        const baseName = chapterId.replace(/\.[^/.]+$/, "");
        jp2File = data.files?.find((f: any) => f.name.includes(baseName) && f.format === "Single Page Processed JP2 ZIP");
      } else {
        jp2File = data.files?.find((f: any) => f.format === "Single Page Processed JP2 ZIP");
      }

      const count = parseInt(jp2File?.filecount || data.metadata?.page_count || "100");
      const pages = [];
      for (let i = 0; i < Math.min(count, 1500); i++) {
        pages.push(`/api/proxy/archive?action=page&id=${encodeURIComponent(id)}&page=${i}${isSubFile ? `&file=${encodeURIComponent(chapterId)}` : ''}`);
      }
      return pages;
    }

    return [];
  } catch (error) {
    console.error("getChapterPages error:", error);
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
}) {
  const { source, query = '', page = 0, mangaLanguage = DEFAULT_MANGA_LANGUAGE, ratings, originalLanguages, includedTagIds, excludedTagIds } = params;
  
  try {
    if (source === 'marvel') {
      const searchParams = new URLSearchParams();
      if (query.length >= 2) searchParams.set('q', query);
      else {
        searchParams.set('limit', LIMIT.toString());
        searchParams.set('offset', String(page * LIMIT));
      }

      const res = await fetch(`${MARVEL_API_BASE}/issues?${searchParams.toString()}`);
      const data = await res.json();
      const items = data.items || [];
      
      return {
        items: items.map((item: any) => ({
          id: String(item.id),
          title: item.title,
          description: item.seriesName,
          coverUrl: normalizeMarvelImage(item.cover),
          source: 'marvel',
          rating: item.pageCount ? `${item.pageCount} p` : 'Marvel'
        })),
        hasMore: data.has_next || (items.length === LIMIT)
      };
    }

    if (source === 'mangadex') {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', LIMIT.toString());
      searchParams.set('offset', String(page * LIMIT));
      searchParams.append('includes[]', 'cover_art');
      
      const translatedLanguages = getMangaDexTranslatedLanguages(mangaLanguage);
      const mdxRatings = ratings || ['safe', 'suggestive'];
      
      appendMangaDexFilters(searchParams, {
        contentRatings: mdxRatings,
        includedTagIds,
        excludedTagIds,
        originalLanguages,
        translatedLanguages: translatedLanguages
      });

      if (query.trim().length >= 2) {
        searchParams.set('title', query.trim());
        searchParams.set('order[relevance]', 'desc');
      } else {
        searchParams.set('order[followedCount]', 'desc');
      }

      const res = await fetch(`https://api.mangadex.org/manga?${searchParams.toString()}`);
      const data = await res.json();
      const items = data.data || [];

      return {
        items: items.map((item: any) => {
          const coverFileName = pickMangaDexCoverFileName(item.relationships);
          return {
            id: item.id,
            title: resolveMangaDexLocalizedText(item.attributes.title, mangaLanguage) || Object.values(item.attributes.title || {})[0],
            description: resolveMangaDexLocalizedText(item.attributes.description, mangaLanguage) || '',
            coverUrl: coverFileName ? buildMangaDexCoverUrl(item.id, coverFileName) : '/logo.png',
            source: 'mangadex',
            rating: item.attributes.contentRating
          };
        }),
        hasMore: (page + 1) * LIMIT < data.total
      };
    }

    if (source === 'archive') {
       const baseQuery = '(collection:comics OR mediatype:comic OR subject:manga OR subject:comics)';
       const finalQuery = query ? `(${query}) AND ${baseQuery}` : baseQuery;
       const res = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(finalQuery)}&output=json&rows=${LIMIT}&page=${page + 1}`);
       const data = await res.json();
       const docs = data.response.docs || [];
       return {
         items: docs.map((item: any) => ({
           id: item.identifier,
           title: item.title,
           coverUrl: `https://archive.org/services/img/${item.identifier}`,
           source: 'archive'
         })),
         hasMore: (page + 1) * LIMIT < data.response.numFound
       };
    }

    return { items: [], hasMore: false };
  } catch (error) {
    console.error("searchComics error:", error);
    return { items: [], hasMore: false };
  }
}

function normalizeMarvelImage(image?: { path?: string; extension?: string }) {
  if (!image?.path || !image.extension) return '';
  const path = image.path.replace('http://', 'https://');
  const finalPath = path.includes('portrait_') ? path : `${path}/portrait_incredible`;
  return `${finalPath}.${image.extension}`;
}
