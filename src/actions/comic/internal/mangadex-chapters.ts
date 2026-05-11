/** MangaDex feed + aggregate normalization (dedupe uploads, scanlation labels). */

import type { ComicDetail } from '@/lib/comic-types';

type FeedChapterAttrs = {
  title?: string | null;
  chapter: string | null;
  volume?: string | null;
  externalUrl?: string | null;
  translatedLanguage?: string | null;
  readableAt?: string | null;
};

type FeedChapterRow = {
  id: string;
  attributes: FeedChapterAttrs;
  relationships?: Array<{
    type: string;
    attributes?: { name?: string | null };
  }>;
};

type AggChapterMeta = {
  chapter: string;
  id: string;
  others?: string[];
};

export type AggVolume = {
  volume: string | null | undefined;
  chapters: Record<string, AggChapterMeta>;
};

/** Build map: `${volume ?? 'none'}::${logicalChapter}` -> MangaDex "primary" chapter UUID. */
export function mangaDexAggregatePrimaryIds(
  volumes: Record<string, AggVolume> | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!volumes || typeof volumes !== 'object') return map;

  for (const vol of Object.values(volumes)) {
    const vk =
      vol?.volume !== undefined && vol?.volume !== null && vol.volume !== '' ? String(vol.volume) : 'none';
    const chapters = vol?.chapters;
    if (!chapters || typeof chapters !== 'object') continue;

    for (const [, meta] of Object.entries(chapters)) {
      const logical = meta?.chapter != null ? String(meta.chapter) : '';
      if (!logical || !meta?.id) continue;
      map.set(`${vk}::${logical}`, meta.id);
    }
  }

  return map;
}

export function mangaDexChapterKey(volume: string | null | undefined, chapterNum: string | null | undefined) {
  const vk =
    volume !== undefined && volume !== null && volume !== ''
      ? String(volume)
      : 'none';
  const ch =
    chapterNum !== undefined && chapterNum !== null && chapterNum !== ''
      ? String(chapterNum)
      : '?';
  return `${vk}::${ch}`;
}

function scanlationName(row: FeedChapterRow): string | undefined {
  const rel = row.relationships?.find((r) => r.type === 'scanlation_group');
  const name = rel?.attributes?.name?.trim();
  return name || undefined;
}

function scoreChapterPreference(
  row: FeedChapterRow,
  langs: readonly string[],
  aggregatePrimaryId: string | undefined,
): number {
  const lang = row.attributes.translatedLanguage || '';
  const langIdx = langs.length > 0 ? langs.indexOf(lang) : -1;
  const langScore =
    langs.length === 0 ? 0 : langIdx >= 0 ? 1000 - langIdx : lang === 'en' ? 100 : lang ? 50 : 0;
  const primaryBonus = aggregatePrimaryId && row.id === aggregatePrimaryId ? 40 : 0;
  let time = 0;
  const ra = row.attributes.readableAt;
  if (ra) {
    const t = Date.parse(ra);
    if (Number.isFinite(t)) time = Math.min(Math.floor(t / 1000), 2_147_483_647);
  }
  return langScore + primaryBonus + time / 1e10;
}

/**
 * Dedupe chapters that share volume+logical chapter across scanlation groups using MD aggregate primaries when available.
 */
export function dedupeMangaDexFeedChapters(
  rows: FeedChapterRow[],
  aggregateVolumes: Record<string, AggVolume> | null | undefined,
  langs: readonly string[],
): FeedChapterRow[] {
  const primaryMap = mangaDexAggregatePrimaryIds(aggregateVolumes || undefined);

  type GroupBest = { row: FeedChapterRow; score: number };
  const grouped = new Map<string, GroupBest>();

  const sortedInput = [...rows].sort((a, b) => {
    const ka = mangaDexChapterKey(a.attributes.volume, a.attributes.chapter);
    const kb = mangaDexChapterKey(b.attributes.volume, b.attributes.chapter);
    if (ka !== kb) return ka.localeCompare(kb);
    const ra = Date.parse(String(a.attributes.readableAt ?? ''));
    const rb = Date.parse(String(b.attributes.readableAt ?? ''));
    return (Number.isFinite(ra) ? ra : 0) - (Number.isFinite(rb) ? rb : 0);
  });

  for (const row of sortedInput) {
    const vk = mangaDexChapterKey(row.attributes.volume, row.attributes.chapter);
    const primaryId = primaryMap.get(vk);
    const score = scoreChapterPreference(row, langs, primaryId);

    const existing = grouped.get(vk);
    if (!existing || score > existing.score) {
      grouped.set(vk, { row, score });
    }
  }

  const out = [...grouped.values()].map((g) => g.row);

  const volSortKey = (v: string | null | undefined) => {
    if (v === undefined || v === null || v === '' || String(v).toLowerCase() === 'none') {
      return { kind: 'none' as const };
    }
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? { kind: 'num' as const, n } : { kind: 'str' as const, s: String(v) };
  };

  const chapSortStr = (c: string | null | undefined) => String(c ?? '');

  out.sort((a, b) => {
    const ka = volSortKey(a.attributes.volume);
    const kb = volSortKey(b.attributes.volume);

    let volCmp = 0;
    if (ka.kind === 'none' && kb.kind !== 'none') volCmp = 1;
    else if (kb.kind === 'none' && ka.kind !== 'none') volCmp = -1;
    else if (ka.kind === 'num' && kb.kind === 'num' && ka.n !== kb.n) volCmp = ka.n - kb.n;
    else if (ka.kind === 'num' && kb.kind === 'str') volCmp = -1;
    else if (ka.kind === 'str' && kb.kind === 'num') volCmp = 1;
    else if (ka.kind === 'str' && kb.kind === 'str' && ka.s !== kb.s)
      volCmp = ka.s.localeCompare(kb.s, undefined, { numeric: true });

    if (volCmp !== 0) return volCmp;

    return chapSortStr(a.attributes.chapter).localeCompare(chapSortStr(b.attributes.chapter), undefined, {
      numeric: true,
    });
  });

  return out;
}

export function rowsToComicChapters(rows: FeedChapterRow[]) {
  return rows.map((ch) => ({
    id: ch.id,
    title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
    chapterNum: ch.attributes.chapter || '?',
    volume: ch.attributes.volume ?? undefined,
    externalUrl: ch.attributes.externalUrl ?? undefined,
    scanlationGroup: scanlationName(ch),
  }));
}

/** Parse `/statistics/manga/{id}` payload (see MangaDex API docs). */
export function parseMangaDexStatistics(
  payload: unknown,
  mangaId: string,
): NonNullable<ComicDetail['mangaDexStats']> | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const stats = (payload as { statistics?: Record<string, unknown> }).statistics;
  const block = stats?.[mangaId];
  if (!block || typeof block !== 'object') return undefined;

  const b = block as {
    follows?: unknown;
    rating?: { bayesian?: unknown; average?: unknown } | null;
    unavailableChaptersCount?: unknown;
  };

  const follows = typeof b.follows === 'number' && Number.isFinite(b.follows) ? b.follows : null;

  let ratingBayesian: number | null = null;
  let ratingAverage: number | null = null;
  if (b.rating && typeof b.rating === 'object') {
    const bay = b.rating.bayesian;
    const avg = b.rating.average;
    if (typeof bay === 'number' && Number.isFinite(bay)) ratingBayesian = bay;
    if (typeof avg === 'number' && Number.isFinite(avg)) ratingAverage = avg;
  }

  let unavailableChaptersCount: number | undefined;
  const u = b.unavailableChaptersCount;
  if (typeof u === 'number' && Number.isFinite(u)) unavailableChaptersCount = u;

  if (follows === null && ratingBayesian === null && ratingAverage === null && unavailableChaptersCount == null) {
    return undefined;
  }

  return {
    follows,
    ratingBayesian,
    ratingAverage,
    unavailableChaptersCount,
  };
}
