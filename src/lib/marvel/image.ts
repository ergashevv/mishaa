/**
 * Marvel cover/thumbnail path → same-origin image proxy URL.
 * Returns empty string when upstream has no usable asset (caller may fall back to comic cover).
 */
export function normalizeMarvelImageToProxyUrl(
  image?: { path?: string; extension?: string },
): string {
  if (!image?.path || !image.extension) return '';
  const path = image.path.replace('http://', 'https://');
  const finalPath = path.includes('portrait_') ? path : `${path}/portrait_incredible`;
  const url = `${finalPath}.${image.extension}`;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

export function normalizeMarvelImageOrLogo(
  image?: { path?: string; extension?: string },
): string {
  return normalizeMarvelImageToProxyUrl(image) || '/logo.png';
}
