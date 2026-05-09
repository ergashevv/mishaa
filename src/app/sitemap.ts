import { MetadataRoute } from 'next';
import { searchComics, getChapters } from '@/actions/comic';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { GUIDES_ORDER } from '@/lib/guides/registry';

/** MangaDex listing pages merged into sitemap (36 titles per page via SEARCH_PAGE_LIMIT). */
const MANGA_SITEMAP_MAX_PAGES = 55;

/** Marvel API pagination (issues list). */
const MARVEL_SITEMAP_MAX_PAGES = 45;

/** Sample chapter URLs for long-tail discovery (first listing page → subset of titles × capped chapters). */
const CHAPTER_SITEMAP_TITLE_CAP = 12;

const CHAPTERS_PER_TITLE_CAP = 18;

function routeEntry(
  baseUrl: string,
  path: string,
  opts: { changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number },
): MetadataRoute.Sitemap[0] {
  return {
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicSiteUrl().replace(/\/$/, '');

  const staticPaths = [
    '',
    '/about',
    '/icomics-wiki',
    '/gallery',
    '/comic',
    '/library',
    '/contact',
    '/faq',
    '/support',
    '/superheroes',
    '/privacy',
    '/terms',
    '/content-policy',
    '/dmca',
    '/guides',
    '/reading',
    ...GUIDES_ORDER.map((g) => `/guides/${g.slug}`),
  ];

  const staticRoutes = staticPaths.map((route) =>
    routeEntry(baseUrl, route, {
      changeFrequency:
        route === '' || route === '/library'
          ? 'daily'
          : route.startsWith('/guides') || route === '/reading'
            ? 'monthly'
            : 'weekly',
      priority:
        route === ''
          ? 1
          : route === '/library'
            ? 0.9
            : route === '/icomics-wiki'
              ? 0.8
              : route === '/faq' || route === '/contact'
              ? 0.72
              : route.startsWith('/guides') || route === '/reading'
                ? 0.75
                : 0.6,
    }),
  );

  const byUrl = new Map<string, MetadataRoute.Sitemap[0]>();
  for (const entry of staticRoutes) {
    byUrl.set(entry.url, entry);
  }

  try {
    const mangaResults = await Promise.allSettled(
      Array.from({ length: MANGA_SITEMAP_MAX_PAGES }, (_, page) =>
        searchComics({
          source: 'mangadex',
          page,
          query: '',
        }),
      ),
    );

    const mangaPages = mangaResults
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof searchComics>>> => r.status === 'fulfilled')
      .map((r) => r.value);

    if (mangaPages.length === 0 && mangaResults.some((r) => r.status === 'rejected')) {
      console.error(
        'Sitemap: all MangaDex listing fetches failed',
        mangaResults.find((r) => r.status === 'rejected'),
      );
    }

    for (const page of mangaPages) {
      for (const item of page.items) {
        const url = `${baseUrl}/library/mangadex/${item.id}`;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }
    }

    for (let page = 0; page < MARVEL_SITEMAP_MAX_PAGES; page++) {
      const marvelPage = await searchComics({ source: 'marvel', page, query: '' });
      for (const item of marvelPage.items) {
        const url = `${baseUrl}/library/marvel/${item.id}`;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.65,
          });
        }
      }
      if (!marvelPage.hasMore || marvelPage.items.length === 0) {
        break;
      }
    }

    const spotlightTitles = (mangaPages[0]?.items ?? []).slice(0, CHAPTER_SITEMAP_TITLE_CAP);
    for (const item of spotlightTitles) {
      const chapters = await getChapters('mangadex', item.id);
      for (const ch of chapters.slice(0, CHAPTERS_PER_TITLE_CAP)) {
        const url = `${baseUrl}/library/mangadex/${item.id}/read/${ch.id}`;
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.55,
          });
        }
      }
    }

    return [...byUrl.values()];
  } catch (e) {
    console.error('Sitemap generation error:', e);
    return staticRoutes;
  }
}
