import { getPublicSiteUrl } from '@/lib/og-metadata';
import { ICS_SITE_DISPLAY_NAME } from '@/lib/seo/page-metadata';

/** WebPage for /icomics-wiki — reinforces entity + “wiki” query context without duplicating FAQ body in schema. */
export function buildWikiLandingPageJsonLd() {
  const u = getPublicSiteUrl().replace(/\/$/, '');
  const pageUrl = `${u}/icomics-wiki`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${ICS_SITE_DISPLAY_NAME} — online comic & manga wiki library`,
    url: pageUrl,
    description:
      'Official explainer for icomics.wiki: a web reader catalog and help hub. Not the iOS iComics file app; not Fandom’s Hey Kids Comics wiki.',
    isPartOf: {
      '@type': 'WebSite',
      name: ICS_SITE_DISPLAY_NAME,
      url: u,
    },
    about: {
      '@type': 'Organization',
      name: ICS_SITE_DISPLAY_NAME,
      url: u,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: u },
        { '@type': 'ListItem', position: 2, name: 'What is iComics.wiki', item: pageUrl },
      ],
    },
  };
}
