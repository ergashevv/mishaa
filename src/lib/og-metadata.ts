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
 * On Vercel, `NEXT_PUBLIC_*` is baked at build time — if it points to localhost by mistake,
 * we fall back to deployment/production host so public feeds never advertise loopback URLs.
 */
export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      const onVercel = process.env.VERCEL === '1';
      if (!(onVercel && isLoopbackHostname(u.hostname))) {
        return u.origin;
      }
    } catch {
      /* fall through */
    }
  }

  for (const key of ['VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const) {
    const h = process.env[key]?.trim();
    if (!h) continue;
    const host = h.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (host) {
      return `https://${host}`;
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
    alt: title ? `${title} — cover` : 'Comic cover',
  };
}
