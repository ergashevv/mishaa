/**
 * Open Graph / Telegram link-preview helpers.
 * External CDNs (e.g. MangaDex uploads) are often blocked or flaky for scrapers;
 * we already serve covers via /api/proxy/image — this ensures absolute URLs and
 * smaller derivatives so Telegram/Discord crawlers can reliably fetch images.
 */

const SITE_FALLBACK = 'https://icomics.wiki';

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * Canonical site origin for OG, RSS, sitemaps, and JSON-LD.
 * Order of preference:
 *   1. `NEXT_PUBLIC_SITE_URL` when explicitly set to a non-loopback host.
 *   2. The canonical production domain ({@link SITE_FALLBACK}).
 *
 * We intentionally do NOT fall back to the auto-assigned `*.vercel.app`
 * deployment host: emitting that as canonical/og:url/sitemap loc splits SEO
 * signal off the real domain (Google would index the vercel.app URL instead of
 * icomics.wiki and treat the custom domain as a duplicate).
 *
 * The loopback check used to be gated on `VERCEL === '1'` only, so a Cloudflare
 * build (which inlines the same `.env` used for local dev, where this var is
 * `http://localhost:3000`) shipped a sitemap of 22k+ localhost URLs to
 * production. Loopback is never a legitimate public site origin on any
 * platform, so the guard now applies unconditionally.
 */
export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      if (!isLoopbackHostname(u.hostname)) {
        return u.origin;
      }
    } catch {
      /* fall through */
    }
  }

  return SITE_FALLBACK;
}

export function toAbsoluteAssetUrl(pathOrUrl: string | undefined, siteUrl: string): string {
  const fallback = `${siteUrl}/logo.png`;
  if (!pathOrUrl) return fallback;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${path}`;
}

/**
 * MangaDex “original” covers can be very large; social crawlers often time out.
 * Prefer the `.512.jpg` derivative (same pattern as buildMangaDexCoverUrl medium).
 */
export function preferSocialPreviewCover(absImageUrl: string, siteUrl: string): string {
  const proxyPrefix = `${siteUrl}/api/proxy/image?url=`;
  if (!absImageUrl.startsWith(proxyPrefix)) return absImageUrl;

  let inner: string;
  try {
    inner = decodeURIComponent(absImageUrl.slice(proxyPrefix.length));
  } catch {
    return absImageUrl;
  }

  if (!inner.includes('uploads.mangadex.org/covers/')) return absImageUrl;
  if (inner.includes('.256.jpg') || inner.includes('.512.jpg')) return absImageUrl;

  const medium = `${inner}.512.jpg`;
  return `${proxyPrefix}${encodeURIComponent(medium)}`;
}

/** Open Graph defaults for routes without topical artwork (legal, FAQ, hubs, stale links). */
export function buildSiteLogoOgImage(siteUrl: string): { url: string; width: number; height: number; alt: string } {
  const origin = siteUrl.replace(/\/$/, '');
  return {
    url: `${origin}/logo.png`,
    width: 512,
    height: 512,
    alt: 'iComics.wiki logo',
  };
}

export function buildComicOpenGraphImage(
  coverUrl: string | undefined,
  siteUrl: string,
  title?: string,
): { url: string; width: number; height: number; alt: string } {
  const absolute = toAbsoluteAssetUrl(coverUrl, siteUrl);
  const url = preferSocialPreviewCover(absolute, siteUrl);
  return {
    url,
    width: 512,
    height: 728,
    alt: title ? `${title} — cover art on iComics.wiki` : 'Comic cover on iComics.wiki',
  };
}
