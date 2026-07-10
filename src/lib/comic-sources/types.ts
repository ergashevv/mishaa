import type { BooruSource } from '@/lib/booru';

export const LIBRARY_SOURCE_SLUGS = [
  'mangadex',
  'marvel',
  'superhero',
  'nhentai',
  'e621',
  'danbooru',
  'gelbooru',
  'rule34',
] as const;

export type LibrarySource = (typeof LIBRARY_SOURCE_SLUGS)[number];

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
  const s = source.trim().toLowerCase();
  return s === 'e621' || s === 'danbooru' || s === 'gelbooru' || s === 'rule34';
}
