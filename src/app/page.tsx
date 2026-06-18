import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import HomeClient from '@/components/HomeClient';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { getHomeData } from '@/lib/home-data';
import type { MangaLanguage } from '@/lib/manga-language';
import { UI_LANG_COOKIE } from '@/lib/i18n/cookies';
import { isUiLang } from '@/lib/i18n/lang';
import { uiLangToPreferredMangaLanguage } from '@/lib/i18n/ui-lang-to-manga';
import { translations } from '@/lib/translations';
import {
  buildHomeMetadata,
  resolveUiLang,
} from '@/lib/seo/ui-locale-public';

const site = getPublicSiteUrl().replace(/\/$/, '');

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; ui?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const uiLang = resolveUiLang(cookieStore.get(UI_LANG_COOKIE)?.value, sp.ui);
  return buildHomeMetadata({
    site,
    uiLang,
    uiSearchParam: isUiLang(sp.ui) ? sp.ui : undefined,
  });
}

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
  // getHomeData throws when MangaDex is unavailable (to prevent caching empty shelves).
  // Catch here so SSR still renders — HomeClient falls back to client-side fetching.
  const initialData = await getHomeData(initialMangaLanguage, { includeAdultContent }).catch(() => ({}));
  const uiLang = isUiLang(uiCookie) ? uiCookie : 'en';
  const homePageH1 = translations[uiLang].hero.pageH1;

  return (
    <>
      <h1 className="sr-only">{homePageH1}</h1>
      <HomeClient
        initialData={initialData}
        initialAgeVerified={includeAdultContent}
        initialIsTouchDevice={initialIsTouchDevice}
        initialMangaLanguage={initialMangaLanguage}
      />
    </>
  );
}
