/** Strip basic HTML/markup for plain-text meta snippets. */
export function stripMarkupForMeta(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** User-visible document title segments (layout template adds `| iComics.wiki`). */
export function buildWorkMetadataTitle(opts: {
  workTitle: string;
  /** e.g. "Manga", "Comic". */
  typeLabel: string;
  ratingText?: string;
}): string {
  const suffix = opts.ratingText ? ` (${opts.ratingText})` : '';
  const type = opts.typeLabel.trim();
  return `${opts.workTitle} — ${type}: synopsis & chapters${suffix}`;
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
  tail += ` Read ${opts.typeLabel.toLowerCase()} online on ${opts.siteBrand}.`;

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
  return `${opts.workTitle} — read ${type.toLowerCase()} online`;
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
    ? `${opts.workTitle}, chapter ${ch}: read this ${opts.typeLabel.toLowerCase()} in the fullscreen browser reader on ${opts.siteBrand}.`
    : `${opts.workTitle}: read this ${opts.typeLabel.toLowerCase()} on ${opts.siteBrand}.`;

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
