import { cacheMangaDexIdResolution, resolveMangaDexIdFromTitle } from '@/lib/mangadex';
import type { AniListMedia } from '@/lib/anilist';
import { MangaLanguage } from '@/lib/manga-language';
import { searchMangaDexComicsPage } from './mangadex-search';

export type MangaDexRelatedRailsItem = {
  id: string;
  title: string;
  coverUrl: string;
  source: 'mangadex';
  rating: string;
};

const MANGADEX_UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function extractMangaDexUuidFromExternalLinks(
  links: Array<{ url?: string | null }> | undefined | null,
): string | null {
  if (!links?.length) return null;
  for (const link of links) {
    const u = link.url || '';
    const m = u.match(MANGADEX_UUID_IN_TEXT);
    if (m) return m[0];
  }
  return null;
}

export async function buildMangaDexRelatedRails(
  manga: {
    id: string;
    attributes: {
      tags: Array<{ id: string; attributes?: { group?: string; name?: Record<string, string> } }>;
      contentRating?: string | null;
    };
  },
  aniListData: AniListMedia | null,
  mangaLanguage: MangaLanguage,
): Promise<MangaDexRelatedRailsItem[]> {
  const currentId = manga.id;
  const seen = new Set<string>([currentId]);
  const out: MangaDexRelatedRailsItem[] = [];

  const push = (item: MangaDexRelatedRailsItem | null) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };

  const nodes = aniListData?.recommendations?.nodes;
  if (Array.isArray(nodes)) {
    const batch = await Promise.all(
      nodes.map(async (n) => {
        const rec = n?.mediaRecommendation;
        if (!rec || rec.type !== 'MANGA') return null;
        const aniTitle = rec.title?.userPreferred || rec.title?.english || '';
        const fromLink = extractMangaDexUuidFromExternalLinks(rec.externalLinks);
        let mdId = fromLink;
        if (!mdId && aniTitle) {
          mdId = (await resolveMangaDexIdFromTitle(aniTitle)) || null;
        }
        if (!mdId || mdId === currentId) return null;
        if (typeof rec.id === 'number') {
          cacheMangaDexIdResolution(String(rec.id), mdId);
        }
        return {
          id: mdId,
          title: aniTitle || 'Untitled',
          coverUrl: rec.coverImage?.extraLarge || rec.coverImage?.large || '/logo.png',
          source: 'mangadex' as const,
          rating: 'Safe',
        };
      }),
    );
    batch.forEach((x) => push(x));
  }

  const ratingsList: string[] = ['safe', 'suggestive', 'erotica', 'pornographic'];

  if (out.length < 8) {
    const tagIds = (manga.attributes.tags || [])
      .filter((t) => {
        const g = t.attributes?.group;
        return g === 'genre' || g === 'theme';
      })
      .map((t) => t.id)
      .filter(Boolean);

    for (const tagId of tagIds.slice(0, 4)) {
      if (out.length >= 12) break;
      const res = await searchMangaDexComicsPage({
        page: 0,
        query: '',
        mangaLanguage,
        includedTagIds: [tagId],
        ratings: ratingsList,
      });
      for (const item of res.items) {
        push({
          id: item.id,
          title: item.title,
          coverUrl: item.coverUrl || '/logo.png',
          source: 'mangadex',
          rating: item.rating,
        });
        if (out.length >= 12) break;
      }
    }
  }

  return out.slice(0, 12);
}
