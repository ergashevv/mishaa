import { Metadata } from 'next';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';

const siteUrl = getPublicSiteUrl().replace(/\/$/, '');

const META_DESC =
  'Find manga (MangaDex), Marvel comics, and your saved bookmarks in one place. Preview covers, genres, chapters, then read in fullscreen with resume and bookmarks on iComics.wiki.';

export const metadata: Metadata = {
  title: 'Library',
  description: META_DESC,
  keywords: [
    'manga library',
    'read manga online',
    'Marvel comics online',
    'manhwa reader',
    'webtoon library',
    'comic catalog',
    'iComics.wiki',
  ],
  ...openGraphTwitterFromLogo({
    origin: siteUrl,
    pageAbsoluteUrl: `${siteUrl}/library`,
    openGraphTitle: 'Comic & manga library | iComics.wiki',
    twitterTitle: 'iComics.wiki — manga & comics library',
    description: META_DESC,
    openGraphDescription:
      'Browse thousands of manga and manhwa titles, Marvel issues, and personal shelves — chapters, synopsis, ratings, reader with progress.',
    twitterDescription:
      'Search manga, Marvel, bookmarks. Open chapters in a reader-first fullscreen mode with synced progress.',
  }),
  alternates: {
    canonical: `${siteUrl}/library`,
  },
};

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
