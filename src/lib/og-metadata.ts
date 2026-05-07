/**
 * Open Graph / Telegram link-preview helpers.
 * External CDNs (e.g. MangaDex uploads) are often blocked or flaky for scrapers;
 * we already serve covers via /api/proxy/image — this ensures absolute URLs and
 * smaller derivatives so Telegram/Discord crawlers can reliably fetch images.
 */

const SITE_FALLBACK = 'https://icomics.wiki';

export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return SITE_FALLBACK;
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return SITE_FALLBACK;
  }
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
