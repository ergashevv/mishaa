import { getPublicSiteUrl } from '@/lib/og-metadata';
import { ICS_SITE_DISPLAY_NAME } from '@/lib/seo/page-metadata';

/** Site-wide Organization — emitted once from root layout. */
export function buildOrganizationJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ICS_SITE_DISPLAY_NAME,
    url: u,
    logo: `${u}/logo.png`,
    description:
      'Reader-focused catalog and reading app for manga, manhwa, webtoons, and Marvel comics — chapters, progress, and optional creator tools.',
  };
}

/** WebSite + SearchAction (library search) — emitted once from root layout. */
export function buildWebSiteJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: ICS_SITE_DISPLAY_NAME,
    url: u,
    description:
      'Read manga and comics online — multi-source catalog, chapter reader, bookmarks, Marvel and MangaDex, plus guides and RSS at icomics.wiki.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${u}/library?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
