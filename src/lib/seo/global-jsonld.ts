import { getPublicSiteUrl } from '@/lib/og-metadata';
import { ICS_SITE_DISPLAY_NAME } from '@/lib/seo/page-metadata';

/** Site-wide Organization — emitted once from root layout. */
export function buildOrganizationJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ICS_SITE_DISPLAY_NAME,
    alternateName: ['iComics wiki', 'icomics.wiki'],
    url: u,
    logo: `${u}/logo.png`,
    description:
      'Manga, manhwa, and vertical webtoon reader on icomics.wiki—library discovery, bookmarks & progress, multilingual UI, Telegram, guides & FAQ, RSS—not the discontinued iOS “iComics” comic file reader and not unrelated wiki hosts.',
    disambiguatingDescription:
      'Official web library at icomics.wiki — not the DRM-free iOS “iComics” file reader app (icomics.net), not the Hey Kids Comics Fandom wiki, and not Marvel’s defunct Icon Comics imprint.',
    sameAs: ['https://t.me/icomicsuz'],
  };
}

/** WebSite + SearchAction (library search) — emitted once from root layout. */
export function buildWebSiteJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: ICS_SITE_DISPLAY_NAME,
    alternateName: ['icomics wiki', 'iComics wiki online library'],
    url: u,
    description:
      'Manga and manhwa reader on icomics.wiki—browse mixed catalogs with age gates, fullscreen chapters, progress & bookmarks, guides, FAQ, RSS (/feed maps from /feed.xml), and Telegram (sameAs link). Not the discontinued iOS iComics file reader or unrelated fan wikis.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${u}/library?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
