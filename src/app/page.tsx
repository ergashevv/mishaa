import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import HomeClient from '@/components/HomeClient';

export const metadata: Metadata = {
  title: 'Ultimate Manga, Manhwa & Hentai Library | iComics.wiki',
  description: 'Explore a massive collection of Manga, Manhwa, and Adult stories. Read thousands of chapters online for free on iComics.wiki.',
  keywords: 'read manga online, manhwa archive, adult comics, hentai library, manhwa wiki, free comic reader, digital comics library',
  openGraph: {
    title: 'Ultimate Manga, Manhwa & Hentai Library | iComics.wiki',
    description: 'Access a massive collection of Manga, Manhwa, and Adult stories. High-fidelity reading experience.',
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
    title: 'Manga, Manhwa & Hentai Library | iComics.wiki',
    description: 'The ultimate destination for Manga, Manhwa, and Adult comic readers.',
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
  const headerList = await headers();
  const userAgent = headerList.get('user-agent') || '';
  const includeAdultContent = cookieStore.get('age_verified')?.value === 'true';
  const initialIsTouchDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const initialMangaLanguage = normalizeLanguage(lang);
  const initialData = await getHomeData(initialMangaLanguage, { includeAdultContent });

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
      <HomeClient
        initialData={initialData}
        initialAgeVerified={includeAdultContent}
        initialIsTouchDevice={initialIsTouchDevice}
        initialMangaLanguage={initialMangaLanguage}
      />
    </>
  );
}
