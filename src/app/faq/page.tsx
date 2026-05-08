import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { buildFaqPageJsonLd } from '@/lib/seo/build-faq-jsonld';
import FAQPageClient from './FAQPageClient';

const faqDesc =
  'Answers about reading manga, manhwa, and comics free on iComics.wiki — mobile reading, accounts, and how the library works.';

export async function generateMetadata(): Promise<Metadata> {
  const site = getPublicSiteUrl().replace(/\/$/, '');
  const canonical = `${site}/faq`;
  return {
    title: 'FAQ — Manga & comic reader',
    description: faqDesc,
    alternates: { canonical },
    openGraph: {
      title: 'FAQ | iComics.wiki',
      description: faqDesc,
      url: canonical,
      siteName: 'iComics.wiki',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'FAQ | iComics.wiki',
      description: faqDesc,
    },
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
