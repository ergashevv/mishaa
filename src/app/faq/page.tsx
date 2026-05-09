import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { buildFaqPageJsonLd } from '@/lib/seo/build-faq-jsonld';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';
import FAQPageClient from './FAQPageClient';

const faqDesc =
  'Answers for icomics.wiki readers: browsing the manga library, age gate, bookmarks, RSS, optional account, HTTPS domain check, and how this site differs from the iOS iComics file app and unrelated “iComics wiki” Fandom wikis.';

export async function generateMetadata(): Promise<Metadata> {
  const site = getPublicSiteUrl().replace(/\/$/, '');
  const canonical = `${site}/faq`;
  return {
    title: 'FAQ — iComics.wiki reader help & wiki branding explained',
    description: faqDesc,
    alternates: { canonical },
    ...openGraphTwitterFromLogo({
      origin: site,
      pageAbsoluteUrl: canonical,
      openGraphTitle: 'FAQ — iComics.wiki help, branding & library topics',
      description: faqDesc,
    }),
  };
}

export default function FAQPage() {
  return (
    <>
      <JsonLd data={buildFaqPageJsonLd()} />
      <FAQPageClient />
    </>
  );
}
