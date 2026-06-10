import { searchComics } from '@/actions/comic';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { submitIndexNowUrls } from '@/lib/indexnow';
import { GUIDES_ORDER } from '@/lib/guides/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Authorized when `CRON_SECRET` is configured — Vercel injects
 * `Authorization: Bearer <CRON_SECRET>` into scheduled invocations. When the
 * secret is unset we allow the request: the job only ever submits this site's
 * own URLs to IndexNow, so triggering it has no harmful side effect.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  return request.headers.get('authorization')?.trim() === `Bearer ${secret}`;
}

/** Hub routes that aggregate freshly-added content. */
const HUB_PATHS = [
  '/',
  '/library',
  '/reading',
  '/guides',
  '/icomics-wiki',
  '/faq',
  '/about',
  '/contact',
  '/link-to-us',
];

/**
 * Daily IndexNow ping (Bing/Yandex et al.) so newly-surfaced URLs are discovered
 * faster than crawl-only. Announces the hubs, the guide library, and the most-
 * followed catalog titles (which change as new chapters land). Bounded payload —
 * we intentionally do not blast the entire sitemap every day.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const origin = getPublicSiteUrl().replace(/\/$/, '');
  const urls = new Set<string>();

  for (const path of HUB_PATHS) {
    urls.add(path === '/' ? `${origin}/` : `${origin}${path}`);
  }
  for (const guide of GUIDES_ORDER) {
    urls.add(`${origin}/guides/${guide.slug}`);
  }

  try {
    const popular = await searchComics({ source: 'mangadex', page: 0, query: '' });
    for (const item of popular.items) {
      urls.add(`${origin}/library/mangadex/${item.id}`);
    }
  } catch (e) {
    console.error('IndexNow cron: catalog fetch failed', e);
  }

  const result = await submitIndexNowUrls([...urls]);
  return Response.json(
    { ok: result.ok, submitted: urls.size, indexNowStatus: result.status },
    { status: result.ok ? 200 : 502 },
  );
}
