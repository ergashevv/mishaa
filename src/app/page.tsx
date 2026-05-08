import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import HomeClient from '@/components/HomeClient';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { getHomeData } from '@/lib/home-data';
import type { MangaLanguage } from '@/lib/manga-language';

const site = getPublicSiteUrl().replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Ultimate Manga, Manhwa & Hentai Library | iComics.wiki',
  description:
    'Explore a massive collection of Manga, Manhwa, and Adult stories. Read thousands of chapters online for free on iComics.wiki.',
  keywords:
    'read manga online, manhwa archive, adult comics, hentai library, manhwa wiki, free comic reader, digital comics library',
  openGraph: {
    title: 'Ultimate Manga, Manhwa & Hentai Library | iComics.wiki',
    description:
      'Access a massive collection of Manga, Manhwa, and Adult stories. High-fidelity reading experience.',
    url: site,
    siteName: 'iComics.wiki',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manga, Manhwa & Hentai Library | iComics.wiki',
    description: 'The ultimate destination for Manga, Manhwa, and Adult comic readers.',
  },
  alternates: {
    canonical: site,
  },
};

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

  return (
    <HomeClient
      initialData={initialData}
      initialAgeVerified={includeAdultContent}
      initialIsTouchDevice={initialIsTouchDevice}
      initialMangaLanguage={initialMangaLanguage}
    />
  );
}
