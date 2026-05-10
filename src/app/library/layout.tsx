import { Metadata } from 'next';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';

const siteUrl = getPublicSiteUrl().replace(/\/$/, '');

const META_DESC =
  'Manga, manhwa, webtoons, and adult/hentai-friendly titles (incl. MangaDex)—bookmarks, genres, chapters, fullscreen reader with progress on iComics.wiki.';

export const metadata: Metadata = {
  title: 'Browse manga, manhwa & webtoons — library search',
  description: META_DESC,
  ...openGraphTwitterFromLogo({
    origin: siteUrl,
    pageAbsoluteUrl: `${siteUrl}/library`,
    openGraphTitle: 'Manga & manhwa library search — chapters & bookmarks',
    twitterTitle: 'Library search — iComics.wiki manga reader',
    description: META_DESC,
    openGraphDescription:
      'Huge manga, manhwa, and adult/hentai-friendly index—bookmarks, chapters, synced reader progress.',
    twitterDescription:
      'Search manga, manhwa, age‑gated catalogs, bookmarks—fullscreen wiki reader.',
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
