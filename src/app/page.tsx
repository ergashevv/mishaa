import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import HomeClient from '@/components/HomeClient';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';
import { getHomeData } from '@/lib/home-data';
import type { MangaLanguage } from '@/lib/manga-language';

const site = getPublicSiteUrl().replace(/\/$/, '');

const HOME_META_DESCRIPTION =
  'Search and read manga, manhwa, and webtoons in your browser—MangaDex-scale titles plus age‑verified & hentai‑style catalogs, bookmarks, synced progress, guides, and RSS. Official icomics.wiki (not the iOS “iComics” comic file app).';

export const metadata: Metadata = {
  title: 'Read manga & manhwa online — browser library',
  description: HOME_META_DESCRIPTION,
  ...openGraphTwitterFromLogo({
    origin: site,
    pageAbsoluteUrl: site,
    openGraphTitle: 'Manga & manhwa reader — browse chapters on iComics.wiki',
    twitterTitle: 'Manga & manhwa reader | iComics.wiki',
    description: HOME_META_DESCRIPTION,
    openGraphDescription:
      'Official icomics.wiki: search manga, manhwa, and webtoons; save progress and use fullscreen reading. Learn how we differ from the iOS iComics app in FAQ.',
    twitterDescription:
      'Browser manga/manhwa library with bookmarks, RSS, guides—official icomics.wiki (disambiguated in FAQ /icomics-wiki).',
  }),
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
