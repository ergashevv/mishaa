import { Metadata } from 'next';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';

const siteUrl = getPublicSiteUrl().replace(/\/$/, '');

const META_DESC =
  'Manga, manhwa, webtoons, and adult/hentai-friendly titles (incl. MangaDex)—plus bookmarks and shelves. Covers, genres, chapters, fullscreen reader with progress on iComics.wiki. Optional Marvel superhero issues when you browse that shelf.';

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
      'Huge manga, manhwa, and adult/hentai-friendly index (MangaDex)—bookmarks & reader progress. Western superhero comics are an extra shelf.',
    twitterDescription:
      'Search manga, manhwa, age-verified catalogs, bookmarks—fullscreen reader. Superhero shelf optional.',
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
