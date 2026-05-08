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
    title: 'Reading guides',
    description:
      'Practical guides for using iComics.wiki: getting started, comic formats, library sources, and reader settings.',
    path: '/guides',
    keywords: [
      'manga reading guide',
      'how to read webtoon',
      'manhwa vs manga',
      'comic reader tutorial',
      'iComics.wiki guides',
      'digital comics help',
      'library age gate',
    ],
  });
}

const GUIDE_KEYWORDS: Record<string, readonly string[]> = {
  'getting-started': [
    'iComics.wiki getting started',
    'manga reader first visit',
    'open comic chapters',
    'mobile manga reading',
  ],
  'manga-formats': [
    'manga vs manhwa',
    'manga vs webtoon',
    'scroll direction comic',
    'long strip webtoon',
    'reading direction',
  ],
  'library-sources': [
    'MangaDex library',
    'comic catalog sources',
    'age verification reader',
    '18+ manga settings',
    'restricted content manga',
  ],
};

export function guideArticleMetadata(slug: string): Metadata {
  const g = GUIDES_ORDER.find((x) => x.slug === slug);
  if (!g) {
    return { title: 'Guide' };
  }
  return staticPageMetadata({
    title: g.title,
    description: g.description,
    path: `/guides/${g.slug}`,
    ...(GUIDE_KEYWORDS[g.slug]?.length ? { keywords: [...GUIDE_KEYWORDS[g.slug]] } : {}),
  });
}
