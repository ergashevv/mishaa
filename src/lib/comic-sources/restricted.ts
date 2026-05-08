import type { LibrarySource } from './types';

/** Sources that require age verification on the server and client. */
export const RESTRICTED_LIBRARY_SOURCES = new Set<LibrarySource>([
  'nhentai',
  'e621',
  'danbooru',
  'gelbooru',
  'rule34',
]);

export function isRestrictedLibrarySource(source: string): boolean {
  const s = source.trim().toLowerCase();
  return (RESTRICTED_LIBRARY_SOURCES as ReadonlySet<string>).has(s);
}
