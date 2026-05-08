/** nHentai public API mirrors (JSON / HTML). Same order everywhere for predictable failover. */
export const NHENTAI_API_MIRRORS = ['nhentai.net', 'nhentai.xxx', 'nhentai.to'] as const;

export type NHentaiMirrorHost = (typeof NHENTAI_API_MIRRORS)[number];

/** HTML `/g/{id}/` scraping: order tuned for upstream availability vs JSON mirrors. */
export const NHENTAI_HTML_GALLERY_MIRRORS: readonly string[] = ['nhentai.to', 'nhentai.xxx'];

/** Headers for `/api/v2/*` JSON (search, galleries, etc.). */
export const NHENTAI_JSON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://nhentai.net/',
};

/** HTML gallery pages (`/g/{id}/`) for legacy extraction. */
export const NHENTAI_HTML_GALLERY_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export const NHENTAI_IMAGE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://nhentai.net/',
};
