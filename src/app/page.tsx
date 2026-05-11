import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import HomeClient from '@/components/HomeClient';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { openGraphTwitterFromLogo } from '@/lib/seo/page-metadata';
import { getHomeData } from '@/lib/home-data';
import type { MangaLanguage } from '@/lib/manga-language';

const site = getPublicSiteUrl().replace(/\/$/, '');

const HOME_META_DESCRIPTION =
  'Read manga, hentai & doujin, manhwa & webtoons in your browser—search Japanese, Korean & Chinese titles (native script or romanization), plus English & Russian. MangaDex-style catalog metadata, fullscreen chapters, bookmarks. Age‑verified 18+ shelves. UI: EN, RU, JA, KO, ZH. icomics.wiki—independent reader, not MangaDex.org.';

export const metadata: Metadata = {
  title: 'Manga, hentai & manhwa online — MangaDex-style browser reader',
  description: HOME_META_DESCRIPTION,
  keywords: [
    'manga online',
    'hentai manga',
    'read manga browser',
    'MangaDex',
    'manhwa',
    'webtoon',
    'adult manga',
    'doujinshi online',
    'manga hentai',
    'icomics.wiki',
  ],
  ...openGraphTwitterFromLogo({
    origin: site,
    pageAbsoluteUrl: site,
    openGraphTitle: 'Manga, hentai & manhwa — read online (MangaDex-style catalog, browser)',
    twitterTitle: 'Manga, hentai & manhwa online · MangaDex-style reader',
    description: HOME_META_DESCRIPTION,
    openGraphDescription:
      'Manga, hentai & manhwa—search JP/KR/CN/EN/RU titles (romanization OK). MangaDex-style browser library, chapters, bookmarks. 18+ after age check. Not MangaDex.org.',
    twitterDescription:
      'Manga, hentai & manhwa online—Japanese, Korean, Chinese & romanized search. MangaDex-style reader. Age‑gated adult shelves. Not the MangaDex app.',
  }),
  alternates: {
    canonical: site,
  },
};

import { UI_LANG_COOKIE } from '@/lib/i18n/cookies';
import { isUiLang } from '@/lib/i18n/lang';
import { uiLangToPreferredMangaLanguage } from '@/lib/i18n/ui-lang-to-manga';
import { translations, type Lang } from '@/lib/translations';

const MANGA_QUERY_LANGS: MangaLanguage[] = [
  'en',
  'ja',
  'ko',
  'ru',
  'es',
  'fr',
  'de',
  'pt-br',
  'zh',
  'zh-hk',
  'th',
  'it',
  'all',
];

const normalizeLanguage = (
  queryLang: string | undefined,
  uiCookie: string | undefined
): MangaLanguage => {
  if (queryLang && (MANGA_QUERY_LANGS as readonly string[]).includes(queryLang)) {
    return queryLang as MangaLanguage;
  }
  if (isUiLang(uiCookie)) return uiLangToPreferredMangaLanguage(uiCookie);
  return 'en';
};

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const cookieStore = await cookies();
  const headerList = await headers();
  const userAgent = headerList.get('user-agent') || '';
  const includeAdultContent = cookieStore.get('age_verified')?.value === 'true';
  const initialIsTouchDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const uiCookie = cookieStore.get(UI_LANG_COOKIE)?.value;
  const initialMangaLanguage = normalizeLanguage(lang, uiCookie);
  const initialData = await getHomeData(initialMangaLanguage, { includeAdultContent });
  const copyLang: Lang = isUiLang(uiCookie) ? uiCookie : 'en';
  const homePrimaryHeading = translations[copyLang].hero.pageH1;

  return (
    <>
      {/* One H1 in initial HTML for crawlers (Bing/Google); visible hero title is h2 in HomeClient. */}
      <h1 className="sr-only">{homePrimaryHeading}</h1>
      <HomeClient
        initialData={initialData}
        initialAgeVerified={includeAdultContent}
        initialIsTouchDevice={initialIsTouchDevice}
        initialMangaLanguage={initialMangaLanguage}
      />
    </>
  );
}
