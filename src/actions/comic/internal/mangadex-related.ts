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

/** Content ratings at or below a given tier — keeps the fallback search from surfacing
 *  explicit titles as "more like this" under a safe/suggestive series. */
const RATING_TIERS: Record<string, string[]> = {
  safe: ['safe'],
  suggestive: ['safe', 'suggestive'],
  erotica: ['safe', 'suggestive', 'erotica'],
  pornographic: ['safe', 'suggestive', 'erotica', 'pornographic'],
};

const isAdultTier = (rating: string) => rating === 'erotica' || rating === 'pornographic';

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
  currentRating: string,
): Promise<MangaDexRelatedRailsItem[]> {
  const currentId = manga.id;
  const currentIsAdult = isAdultTier(currentRating);
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
        // Never surface an explicit pick as "more like this" under a safe/suggestive title.
        if (rec.isAdult && !currentIsAdult) return null;
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
          // Honest rating (was hardcoded 'Safe') — the age-gate blur elsewhere keys off this field.
          rating: rec.isAdult ? 'erotica' : 'safe',
        };
      }),
    );
    batch.forEach((x) => push(x));
  }

  if (out.length < 8) {
    const tagIds = (manga.attributes.tags || [])
      .filter((t) => {
        const g = t.attributes?.group;
        return g === 'genre' || g === 'theme';
      })
      .map((t) => t.id)
      .filter(Boolean);

    const ratingsList = RATING_TIERS[currentRating] ?? RATING_TIERS.safe;

    // Tag searches are independent of each other — run them concurrently so the
    // fallback costs one round-trip instead of up to four serial ones.
    const tagResults = await Promise.allSettled(
      tagIds.slice(0, 4).map((tagId) =>
        searchMangaDexComicsPage({
          page: 0,
          query: '',
          mangaLanguage,
          includedTagIds: [tagId],
          ratings: ratingsList,
        }),
      ),
    );

    // Rank by how many of the shared genre/theme tags each candidate matched, instead of
    // first-tag-search-wins — a title sharing 2+ tags with the current series is a closer
    // match than one that only happens to share the first tag searched.
    const candidates = new Map<string, { item: MangaDexRelatedRailsItem; matches: number }>();
    for (const result of tagResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value.items) {
        if (seen.has(item.id)) continue;
        const existing = candidates.get(item.id);
        if (existing) {
          existing.matches += 1;
        } else {
          candidates.set(item.id, {
            item: {
              id: item.id,
              title: item.title,
              coverUrl: item.coverUrl || '/logo.png',
              source: 'mangadex',
              rating: item.rating,
            },
            matches: 1,
          });
        }
      }
    }

    for (const { item } of [...candidates.values()].sort((a, b) => b.matches - a.matches)) {
      if (out.length >= 12) break;
      push(item);
    }
  }

  return out.slice(0, 12);
}
