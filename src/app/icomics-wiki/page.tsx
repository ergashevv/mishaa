import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { buildWikiLandingPageJsonLd } from '@/lib/seo/wiki-landing-jsonld';
import { ICS_SITE_DISPLAY_NAME, openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';
import IcomicsWikiClient from './IcomicsWikiClient';

const path = '/icomics-wiki';

export async function generateMetadata(): Promise<Metadata> {
  const site = getPublicSiteUrl().replace(/\/$/, '');
  const canonical = `${site}${path}`;
  const description =
    '“iComics wiki” here means icomics.wiki: the manga, manhwa, and webtoon browser library—not the discontinued iOS comic file manager, not hey kids comics Fan wikis, and not unrelated app stores listings. Confirm you are on https://icomics.wiki, then use search and guides.';
  return {
    title: 'What “iComics wiki” is (and is not) — official icomics.wiki',
    description,
    alternates: { canonical },
    ...openGraphTwitterFromLogo({
      origin: site,
      pageAbsoluteUrl: canonical,
      openGraphTitle: `Official ${ICS_SITE_DISPLAY_NAME} — not the iOS app or Fan wikis`,
      description,
    }),
  };
}

export default function IcomicsWikiLandingPage() {
  return (
    <>
      <JsonLd data={buildWikiLandingPageJsonLd()} />
      <IcomicsWikiClient />
    </>
  );
}
