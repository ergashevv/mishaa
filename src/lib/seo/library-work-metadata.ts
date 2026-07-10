/** Strip basic HTML/markup for plain-text meta snippets. */
export function stripMarkupForMeta(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Human-readable work type for titles & meta (keep in sync with library detail route). */
export function libraryWorkTypeLabel(source: string): string {
  switch (source) {
    case 'mangadex':
      return 'Manga';
    case 'marvel':
      return 'Marvel comic';
    case 'nhentai':
      return 'Doujin';
    case 'superhero':
      return 'Superhero';
    default:
      return 'Comic';
  }
}

/** User-visible document title segments (layout template adds `| iComics.wiki`). */
export function buildWorkMetadataTitle(opts: {
  workTitle: string;
  /** e.g. "Manga", "Comic". */
  typeLabel: string;
  ratingText?: string;
  /** Aligns with MangaDex-intent queries when listing is from that catalog. */
  source?: string;
}): string {
  const suffix = opts.ratingText ? ` (${opts.ratingText})` : '';
  const type = opts.typeLabel.trim();
  const mdHub =
    opts.source === 'mangadex'
      ? ` — ${type} (MangaDex-style catalog): synopsis, chapters & read online`
      : ` — ${type}: synopsis & chapters`;
  return `${opts.workTitle}${mdHub}${suffix}`;
}

/**
 * Discovery-focused meta description: lead with series title + synopsis + actionable tail.
 */
export function buildWorkMetaDescription(opts: {
  title: string;
  synopsisHtml?: string | null;
  aniSynopsisHtml?: string | null;
  genres: readonly string[];
  typeLabel: string;
  chapterCount?: number;
  siteBrand: string;
  /** Typical display cap ~155–320; we target the upper range for richer matching. */
  maxLen?: number;
  /** Long-tail / hub queries (romanized JP titles, “mangadex + series”). */
  source?: string;
}): string {
  const maxLen = opts.maxLen ?? 305;
  const title = opts.title.trim();
  let core = stripMarkupForMeta(opts.synopsisHtml);
  const aniExtra = stripMarkupForMeta(opts.aniSynopsisHtml);
  if (core.length < 90 && aniExtra) {
    core = `${core ? `${core} ` : ''}${aniExtra}`.replace(/\s+/g, ' ').trim();
  }
  if (!core && opts.genres.length) {
    core = `${opts.genres.slice(0, 5).join(', ')} — ${opts.typeLabel} on ${opts.siteBrand}.`;
  }
  if (!core) {
    core = `Official listing on ${opts.siteBrand} — open to browse chapters and the fullscreen reader.`;
  }

  const genreShort = opts.genres.filter(Boolean).slice(0, 4).join(', ');
  let tail = genreShort ? ` Categories: ${genreShort}.` : '';
  if (typeof opts.chapterCount === 'number' && opts.chapterCount > 0) {
    tail += ` ${opts.chapterCount} chapters in the catalog.`;
  }
  if (opts.source === 'mangadex') {
    tail += ` Search-friendly listing (romanized / English titles like on MangaDex).`;
  }
  tail += ` Fullscreen browser reader — manga, manhwa & vertical webtoons on ${opts.siteBrand}.`;

  const head = `${title} —`;
  let body = `${head} ${core}`.replace(/\s+/g, ' ').trim();
  let combined = `${body}${tail}`.replace(/\s+/g, ' ').trim();
  if (combined.length <= maxLen) return combined;

  const budgetForCore = Math.max(
    title.length + 4,
    maxLen - tail.length - 4,
  );
  core = core.slice(0, Math.max(budgetForCore - head.length, 48));
  core = `${head} ${core}`.trim();
  if (core.endsWith(',')) core = core.slice(0, -1);
  if (!/[.!?…]$/.test(core)) core += '…';
  combined = `${core}${tail}`.replace(/\s+/g, ' ').trim();
  return combined.slice(0, maxLen).replace(/\s+\S*$/, '').trim();
}

export function buildChapterMetadataTitle(opts: {
  workTitle: string;
  chapterLabel: string | undefined;
  typeLabel: string;
}): string {
  const ch = opts.chapterLabel?.trim();
  const type = opts.typeLabel.trim();
  if (ch) {
    return `${opts.workTitle} — Ch. ${ch} (${type})`;
  }
  return `${opts.workTitle} — read ${type.toLowerCase()} online in your browser`;
}

export function buildChapterMetaDescription(opts: {
  workTitle: string;
  chapterLabel: string | undefined;
  typeLabel: string;
  synopsisHtml?: string | null;
  siteBrand: string;
  totalChapters?: number;
  maxLen?: number;
}): string {
  const maxLen = opts.maxLen ?? 300;
  const ch = opts.chapterLabel?.trim();
  const lead = ch
    ? `${opts.workTitle}, chapter ${ch}: read online in the fullscreen browser on ${opts.siteBrand} — ${opts.typeLabel.toLowerCase()} from the manga, manhwa & webtoon catalog.`
    : `${opts.workTitle}: read online on ${opts.siteBrand} — fullscreen browser manga, manhwa & webtoon reader.`;

  let extra = stripMarkupForMeta(opts.synopsisHtml);
  if (extra.length > 40) {
    extra = ` ${extra}`;
  } else {
    extra = '';
  }

  let countNote = '';
  if (typeof opts.totalChapters === 'number' && opts.totalChapters > 0) {
    countNote = ` ${opts.totalChapters} chapters in this series.`;
  }

  let out = `${lead}${extra}${countNote}`.replace(/\s+/g, ' ').trim();
  if (out.length <= maxLen) return out;
  out = out.slice(0, maxLen - 1).replace(/\s+\S*$/, '');
  if (!/[.!?…]$/.test(out)) out += '…';
  return out;
}
