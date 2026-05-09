import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export type GuideDef = {
  slug: string;
  title: string;
  description: string;
  publishedIso: string;
};

/** Editorial guides — indexed for organic discovery; keep titles/descriptions unique and helpful. */
export const GUIDES_ORDER: GuideDef[] = [
  {
    slug: 'getting-started',
    title: 'Getting started with the iComics.wiki reader',
    description:
      'How to browse the library, open a series, start reading chapters, and use basic navigation on phone and desktop.',
    publishedIso: '2026-05-08T12:00:00.000Z',
  },
  {
    slug: 'manga-formats',
    title: 'Manga vs manhwa vs webtoon: what the formats mean',
    description:
      'A plain-language overview of scroll direction, typical layouts, and what to expect when switching between manga, manhwa, and vertical webtoons.',
    publishedIso: '2026-05-08T12:00:00.000Z',
  },
  {
    slug: 'library-sources',
    title: 'Library sources, safety settings, and age gate',
    description:
      'Why titles come from multiple catalogs, how restricted sources work, and where to manage age verification and reading preferences.',
    publishedIso: '2026-05-08T12:00:00.000Z',
  },
];

export function guidesIndexMetadata(): Metadata {
  return staticPageMetadata({
    title: 'How to read on iComics.wiki — guides for library & chapters',
    description:
      'Short how‑tos for the icomics.wiki manga reader: first visit setup, manga vs manhwa vs vertical webtoon layouts, catalogs and age‑gated shelves. Focused browser help—not iOS storefront apps.',
    path: '/guides',
  });
}

export function guideArticleMetadata(slug: string): Metadata {
  const g = GUIDES_ORDER.find((x) => x.slug === slug);
  if (!g) {
    return { title: 'Guide' };
  }

  return staticPageMetadata({
    title: g.title,
    description: g.description,
    path: `/guides/${g.slug}`,
  });
}
