import { BOORU_SOURCE_SLUGS, type BooruSource } from '@/lib/booru';

export const LIBRARY_SOURCE_SLUGS = [
  'mangadex',
  'marvel',
  'superhero',
  'nhentai',
  ...BOORU_SOURCE_SLUGS,
] as const;

export type LibrarySource = (typeof LIBRARY_SOURCE_SLUGS)[number];

const BOORU_SLUG_SET: ReadonlySet<string> = new Set(BOORU_SOURCE_SLUGS);

export function isLibrarySource(value: string): value is LibrarySource {
  const s = value.trim().toLowerCase();
  return (LIBRARY_SOURCE_SLUGS as readonly string[]).includes(s);
}

/** Returns a canonical slug when the string matches a known source, otherwise null. */
export function normalizeLibrarySource(value: string): LibrarySource | null {
  const s = value.trim().toLowerCase();
  return isLibrarySource(s) ? s : null;
}

export type { BooruSource };

export function isBooruLibrarySource(source: string): source is BooruSource {
  return BOORU_SLUG_SET.has(source.trim().toLowerCase());
}
