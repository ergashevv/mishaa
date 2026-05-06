import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import HomeClient from '@/components/HomeClient';

export const metadata: Metadata = {
  title: 'AI-Powered Comic Creation & Digital Library',
  description: 'Explore a massive library of Manga, Manhwa, and Marvel comics. Read online, discover new series, and use our AI-powered studio to create your own visual narratives.',
  keywords: 'read manga online, manhwa wiki, marvel comics archive, free comic reader, ai comic creator, digital comics library',
  openGraph: {
    title: 'AI-Powered Comic Creation & Digital Library',
    description: 'Read thousands of comics online and create your own stories with AI.',
    url: 'https://icomics.wiki',
    siteName: 'iComics.wiki',
    images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          alt: 'iComics.wiki',
        },
      ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI-Powered Comic Creation & Digital Library',
    description: 'The ultimate synthesis environment for comic readers and creators.',
    images: ['/logo.png'],
  },
  alternates: {
    canonical: 'https://icomics.wiki',
  },
};

import JsonLd from '@/components/JsonLd';

import { getHomeData } from '@/lib/home-data';
import type { MangaLanguage } from '@/lib/manga-language';

const normalizeLanguage = (value: string | undefined): MangaLanguage => {
  return value === 'en' || value === 'ru' || value === 'es' || value === 'fr'
    ? value
    : 'en';
};

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const cookieStore = await cookies();
  const includeAdultContent = cookieStore.get('age_verified')?.value === 'true';
  const initialData = await getHomeData(normalizeLanguage(lang), { includeAdultContent });

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "iComics.wiki",
    "url": "https://icomics.wiki",
    "logo": "https://icomics.wiki/logo.png",
    "sameAs": [
      "https://twitter.com/icomics.wiki",
      "https://github.com/icomics.wiki"
    ]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "iComics.wiki",
    "url": "https://icomics.wiki",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://icomics.wiki/library?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <HomeClient initialData={initialData} initialAgeVerified={includeAdultContent} />
    </>
  );
}
