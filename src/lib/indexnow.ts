import { getPublicSiteUrl } from '@/lib/og-metadata';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

/** Fallback matches `public/<key>.txt` — override with `INDEXNOW_KEY` in env if you rotate the key. */
const DEFAULT_INDEXNOW_KEY = '3275031d0a124a54a34198daff4136d9';

export function getIndexNowKey(): string {
  return process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY;
}

export function indexNowKeyLocation(): string {
  const origin = getPublicSiteUrl().replace(/\/$/, '');
  return `${origin}/${getIndexNowKey()}.txt`;
}

/**
 * Notify IndexNow-enabled engines about URL changes. Same host as {@link getPublicSiteUrl} only.
 * @see https://www.indexnow.org/documentation
 */
export async function submitIndexNowUrls(urlList: string[]): Promise<{
  ok: boolean;
  status: number;
  body: string;
}> {
  const siteOrigin = getPublicSiteUrl().replace(/\/$/, '');
  const siteUrl = new URL(siteOrigin.endsWith('/') ? siteOrigin : `${siteOrigin}/`);
  const host = siteUrl.hostname;
  const key = getIndexNowKey();
  const keyLocation = `${siteOrigin}/${key}.txt`;

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const raw of urlList) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) continue;
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      continue;
    }
    if (u.hostname !== host) continue;
    if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
    const href = u.href;
    if (seen.has(href)) continue;
    seen.add(href);
    normalized.push(href);
  }

  if (normalized.length === 0) {
    return { ok: false, status: 422, body: 'No valid URLs for this site host' };
  }

  const payload = {
    host,
    key,
    keyLocation,
    urlList: normalized.slice(0, 10_000),
  };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 2_000) };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IndexNow fetch failed';
    return { ok: false, status: 502, body: message };
  }
}
