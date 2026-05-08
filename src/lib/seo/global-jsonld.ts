import { getPublicSiteUrl } from '@/lib/og-metadata';

/** Site-wide Organization — emitted once from root layout. */
export function buildOrganizationJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'iComics.wiki',
    url: u,
    logo: `${u}/logo.png`,
    sameAs: ['https://twitter.com/icomics.wiki', 'https://github.com/icomics.wiki'],
  };
}

/** WebSite + SearchAction (library search) — emitted once from root layout. */
export function buildWebSiteJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'iComics.wiki',
    url: u,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${u}/library?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
