import { BOORU_SOURCE_SLUGS } from '@/lib/booru';
import type { LibrarySource } from './types';

/** Sources that require age verification on the server and client. */
export const RESTRICTED_LIBRARY_SOURCES = new Set<LibrarySource>([
  'nhentai',
  ...BOORU_SOURCE_SLUGS,
]);

export function isRestrictedLibrarySource(source: string): boolean {
  const s = source.trim().toLowerCase();
  return (RESTRICTED_LIBRARY_SOURCES as ReadonlySet<string>).has(s);
}
