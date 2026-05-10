import { getPublicSiteUrl } from '@/lib/og-metadata';
import { ICS_SITE_DISPLAY_NAME } from '@/lib/seo/page-metadata';

const INDEXED_LANGUAGES = ['en-US', 'ru-RU'] as const;

/** Site-wide Organization — emitted once from root layout. */
export function buildOrganizationJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    inLanguage: [...INDEXED_LANGUAGES],
    availableLanguage: ['en', 'ru'],
    name: ICS_SITE_DISPLAY_NAME,
    alternateName: ['iComics wiki', 'icomics.wiki'],
    url: u,
    logo: `${u}/logo.png`,
    description:
      'Browser library for manga, manhwa, and web — catalog search, fullscreen reader, bookmarks, bilingual UI, Telegram, guides & RSS.',
    disambiguatingDescription:
      'This domain hosts the icomics.wiki reader — not the iOS “iComics” comic file app, not Hey Kids Comics on Fandom, and not Marvel’s discontinued Icon Comics line.',
    sameAs: ['https://t.me/icomicsuz'],
  };
}

/** WebSite + SearchAction (library search) — emitted once from root layout. */
export function buildWebSiteJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    inLanguage: [...INDEXED_LANGUAGES],
    availableLanguage: ['en', 'ru'],
    name: ICS_SITE_DISPLAY_NAME,
    alternateName: ['icomics wiki', 'iComics wiki online library'],
    url: u,
    description:
      'Official icomics.wiki — browse catalogs with age gates, read chapters fullscreen, resume where you stopped. FAQs & feed explain how we differ from the old iOS iComics app.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${u}/library?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
