/**
 * Validates the `path` query for `/api/proxy/nhentai` before joining to `https://{mirror}/api/{path}`.
 * Blocks SSRF-style abuse (absolute URLs, traversal, control chars).
 */
export function isAllowedNHentaiProxyApiPath(rawPath: string): boolean {
  if (!rawPath || rawPath.length > 4096) return false;
  if (rawPath.includes('..') || rawPath.includes('://') || /[\r\n\u0000]/.test(rawPath)) return false;

  const noQuery = rawPath.split('?')[0] ?? '';
  const base = noQuery.replace(/\/+$/, '');

  if (base === 'v2/search' || base.startsWith('v2/search/')) return true;
  if (/^v2\/galleries\/[A-Za-z0-9_-]+$/.test(base)) return true;
  if (/^gallery\/[A-Za-z0-9_-]+$/.test(base)) return true;

  return false;
}

/**
 * Validates `path` for `/api/proxy/nhentai/image`: relative CDN keys or absolute HTTPS URLs on nHentai image hosts only.
 */
export function isAllowedNHentaiImageCdnPath(rawPath: string): boolean {
  if (!rawPath || rawPath.length > 2048) return false;
  if (/[\r\n\u0000]/.test(rawPath)) return false;

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    decoded = rawPath;
  }

  decoded = decoded.trim().split(/[?#]/)[0] ?? '';
  if (decoded.includes('..')) return false;

  if (/^https?:\/\//i.test(decoded)) {
    let u: URL;
    try {
      u = new URL(decoded);
    } catch {
      return false;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const hostOk = /^([a-z0-9-]+\.)*nhentai\.(net|xxx|to)$/i.test(u.hostname);
    if (!hostOk) return false;
    const p = u.pathname.replace(/^\/+/, '');
    return /^galleries\/[A-Za-z0-9._/-]+$/i.test(p);
  }

  const normalized = decoded.replace(/^\/+/, '');
  return /^galleries\/[A-Za-z0-9._/-]+$/i.test(normalized);
}
