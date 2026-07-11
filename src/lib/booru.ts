/**
 * Booru layer — a single config-driven registry for every image-board source.
 *
 * Adding a board is now a one-line entry in `BOORU_BOARDS`; all URL building,
 * rating/tag/image extraction and result mapping is derived from the board's
 * `style` (which upstream API dialect it speaks). The five supported dialects:
 *
 *  - `danbooru`  — `/posts.json?tags=&page=&limit=`  (Danbooru + clones, flat tag_string)
 *  - `e621`      — Danbooru-derived but tags come grouped by category (e621 software)
 *  - `gelbooru`  — `/index.php?page=dapi&s=post&q=index&json=1` (Gelbooru 0.2 + clones)
 *  - `moebooru`  — `/post.json?tags=&page=&limit=`            (Moebooru: yande.re, konachan)
 *  - `philomena` — `/api/v1/json/search/images?q=&per_page=`  (Derpibooru & forks)
 *
 * Everything here is pure/isomorphic (no network, no `next` imports) so it can be
 * shared by the server action, the proxy route and — types only — client code.
 */

export type BooruApiStyle = 'danbooru' | 'e621' | 'gelbooru' | 'moebooru' | 'philomena';

export const BOORU_SOURCE_SLUGS = [
  // existing
  'e621',
  'danbooru',
  'gelbooru',
  'rule34',
  // gelbooru 0.2 clones
  'xbooru',
  'tbib',
  'hypnohub',
  // danbooru / e621 family
  'aibooru',
  'e6ai',
  // moebooru
  'yandere',
  // philomena family
  'derpibooru',
  'furbooru',
  'ponybooru',
  'ponerpics',
  'manebooru',
  'twibooru',
] as const;

export type BooruSource = (typeof BOORU_SOURCE_SLUGS)[number];

interface BooruBoard {
  label: string;
  style: BooruApiStyle;
  /** Public site origin — used for external post links and as the image referer. */
  site: string;
  /** API origin when it differs from `site` (e.g. rule34 serves its API from api.rule34.xxx). */
  api?: string;
  /** Philomena search endpoint path (varies between the v1 fork and twibooru's v3). */
  searchPath?: string;
  /** Philomena single-item endpoint path template. */
  itemPath?: (id: string) => string;
  /** Philomena wraps results under `images` (v1) or `posts` (twibooru v3). */
  wrapKey?: 'images' | 'posts';
  /** Philomena filter id that unlocks explicit results for anonymous requests. */
  filterId?: number;
  /** Overrides the default browse query when the user hasn't typed one. */
  defaultQuery?: string;
  /** Extra image CDN hosts to allow-list in the image proxy (site host is added automatically). */
  imageHosts?: string[];
}

export const BOORU_BOARDS: Record<BooruSource, BooruBoard> = {
  e621: { label: 'e621', style: 'e621', site: 'https://e621.net', imageHosts: ['e621.net'] },
  danbooru: { label: 'Danbooru', style: 'danbooru', site: 'https://danbooru.donmai.us', imageHosts: ['donmai.us'] },
  gelbooru: { label: 'Gelbooru', style: 'gelbooru', site: 'https://gelbooru.com', imageHosts: ['gelbooru.com'] },
  rule34: { label: 'Rule34', style: 'gelbooru', site: 'https://rule34.xxx', api: 'https://api.rule34.xxx', imageHosts: ['rule34.xxx'] },

  xbooru: { label: 'Xbooru', style: 'gelbooru', site: 'https://xbooru.com', imageHosts: ['xbooru.com'] },
  tbib: { label: 'TBIB', style: 'gelbooru', site: 'https://tbib.org', imageHosts: ['tbib.org'] },
  hypnohub: { label: 'Hypnohub', style: 'gelbooru', site: 'https://hypnohub.net', imageHosts: ['hypnohub.net'] },

  aibooru: { label: 'AIBooru', style: 'danbooru', site: 'https://aibooru.online', imageHosts: ['aibooru.online', 'aibooru.download'] },
  e6ai: { label: 'e6AI', style: 'e621', site: 'https://e6ai.net', imageHosts: ['e6ai.net'] },

  yandere: { label: 'yande.re', style: 'moebooru', site: 'https://yande.re', imageHosts: ['yande.re'] },

  derpibooru: {
    label: 'Derpibooru',
    style: 'philomena',
    site: 'https://derpibooru.org',
    searchPath: '/api/v1/json/search/images',
    itemPath: (id) => `/api/v1/json/images/${id}`,
    wrapKey: 'images',
    filterId: 56027, // "Everything" — unlocks explicit for anonymous callers
    imageHosts: ['derpicdn.net'],
  },
  furbooru: {
    label: 'Furbooru',
    style: 'philomena',
    site: 'https://furbooru.org',
    searchPath: '/api/v1/json/search/images',
    itemPath: (id) => `/api/v1/json/images/${id}`,
    wrapKey: 'images',
    filterId: 2, // "Everything"
    imageHosts: ['furbooru.org', 'furrycdn.org'],
  },
  ponybooru: {
    label: 'Ponybooru',
    style: 'philomena',
    site: 'https://ponybooru.org',
    searchPath: '/api/v1/json/search/images',
    itemPath: (id) => `/api/v1/json/images/${id}`,
    wrapKey: 'images',
    filterId: 2,
    imageHosts: ['ponybooru.org', 'cdn.ponybooru.org'],
  },
  ponerpics: {
    label: 'Ponerpics',
    style: 'philomena',
    site: 'https://ponerpics.org',
    searchPath: '/api/v1/json/search/images',
    itemPath: (id) => `/api/v1/json/images/${id}`,
    wrapKey: 'images',
    filterId: 2,
    imageHosts: ['ponerpics.org'],
  },
  manebooru: {
    label: 'Manebooru',
    style: 'philomena',
    site: 'https://manebooru.art',
    searchPath: '/api/v1/json/search/images',
    itemPath: (id) => `/api/v1/json/images/${id}`,
    wrapKey: 'images',
    filterId: 2,
    imageHosts: ['manebooru.art'],
  },
  twibooru: {
    label: 'Twibooru',
    style: 'philomena',
    site: 'https://twibooru.org',
    searchPath: '/api/v3/search/posts',
    itemPath: (id) => `/api/v3/posts/${id}`,
    wrapKey: 'posts',
    // Twibooru returns nothing for the `explicit` tag — browse everything by default.
    defaultQuery: '*',
    imageHosts: ['twibooru.org', 'cdn.twibooru.org'],
  },
};

export interface BooruPostSummary {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  rating: string;
  source: BooruSource;
  tags: string[];
  externalUrl?: string;
}

/** Descriptive UA — e621/e926/e6ai reject requests without one. */
export const BOORU_FETCH_HEADERS: Record<string, string> = {
  'User-Agent': 'iComics.wiki/1.0 (booru client; contact support@icomics.wiki)',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Every image host the proxy must allow so board covers load. Derived from the registry. */
export const BOORU_IMAGE_HOSTS: string[] = Array.from(
  new Set(
    Object.values(BOORU_BOARDS).flatMap((board) => {
      const siteHost = board.site.replace(/^https?:\/\//, '');
      return [siteHost, ...(board.imageHosts ?? [])];
    }),
  ),
);

/** Maps an image host (including CDN subdomains) back to the board site to use as a Referer. */
export function booruRefererForHost(hostname: string): string | undefined {
  const host = hostname.toLowerCase();
  for (const board of Object.values(BOORU_BOARDS)) {
    const hosts = [board.site.replace(/^https?:\/\//, ''), ...(board.imageHosts ?? [])];
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return `${board.site}/`;
    }
  }
  return undefined;
}

function boardOf(source: BooruSource) {
  return BOORU_BOARDS[source];
}

function apiOrigin(source: BooruSource) {
  const board = boardOf(source);
  return board.api ?? board.site;
}

function normalizeUrl(url?: string | null) {
  if (!url) return '';
  return String(url).replace(/^http:\/\//, 'https://');
}

function proxyImageUrl(url: string) {
  if (!url) return '';
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function compactTags(tags: string[], fallback: string) {
  const unique = tags.filter(Boolean).slice(0, 3);
  if (unique.length === 0) return fallback;
  return unique.join(' ');
}

/**
 * Gelbooru-family boards spell ratings out (`explicit`); the Danbooru/e621/Moebooru
 * families use single letters (`e`). Normalise a user query so `rating:e` works everywhere.
 */
function normalizeRatingQuery(source: BooruSource, query: string) {
  if (!query) return query;
  const spellsOut = boardOf(source).style === 'gelbooru';
  const explicit = spellsOut ? 'rating:explicit' : 'rating:e';
  const questionable = spellsOut ? 'rating:questionable' : 'rating:q';
  const safe = spellsOut ? 'rating:safe' : 'rating:s';

  return query
    .replace(/\brating:(?:explicit|e)\b/gi, explicit)
    .replace(/\brating:(?:questionable|q)\b/gi, questionable)
    .replace(/\brating:(?:safe|s)\b/gi, safe);
}

function normalizeRatingValue(raw: string) {
  const v = raw.trim().toLowerCase();
  if (!v) return 'unknown';
  if (v === 'e' || v === 'explicit') return 'explicit';
  if (v === 'q' || v === 'questionable') return 'questionable';
  if (v === 's' || v === 'safe' || v === 'g' || v === 'general') return 'safe';
  if (v === 'sensitive') return 'questionable';
  return v;
}

const PHILOMENA_RATING_TAGS = ['explicit', 'questionable', 'suggestive', 'safe'];

function extractRating(source: BooruSource, post: any) {
  const style = boardOf(source).style;
  if (style === 'philomena') {
    const tags: string[] = Array.isArray(post?.tags) ? post.tags.map((t: any) => String(t).toLowerCase()) : [];
    const hit = PHILOMENA_RATING_TAGS.find((r) => tags.includes(r));
    return hit ? normalizeRatingValue(hit) : 'unknown';
  }
  const raw = String(post?.rating || post?.tag_string_rating || post?.post_rating || '');
  return normalizeRatingValue(raw);
}

function extractTags(source: BooruSource, post: any): string[] {
  const style = boardOf(source).style;

  if (style === 'e621') {
    const grouped = post?.tags;
    if (!grouped || typeof grouped !== 'object') return [];
    return [
      ...(grouped.general || []),
      ...(grouped.species || []),
      ...(grouped.character || []),
      ...(grouped.copyright || []),
      ...(grouped.artist || []),
      ...(grouped.lore || []),
      ...(grouped.meta || []),
    ].filter(Boolean);
  }

  if (style === 'philomena') {
    return (Array.isArray(post?.tags) ? post.tags : [])
      .map((t: any) => String(t).trim())
      .filter(Boolean);
  }

  if (style === 'danbooru') {
    return String(post?.tag_string || '')
      .split(/\s+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  // gelbooru + moebooru: flat space-separated `tags` string
  return String(post?.tags || '')
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const VIDEO_EXT = /\.(webm|mp4|m4v|swf|ogg|zip)(\?|$)/i;

/** Prefer the first still-image candidate; fall back to the first non-empty (e.g. a video sample). */
function pickCover(candidates: Array<string | undefined | null>): string {
  const list = candidates.map((c) => (c ? String(c) : '')).filter(Boolean);
  return list.find((c) => !VIDEO_EXT.test(c)) || list[0] || '';
}

/** Gelbooru 0.2 clones that omit `file_url` still expose `directory` + `image` (the filename). */
function gelbooruConstructedUrl(source: BooruSource, post: any): string {
  const dir = post?.directory;
  const image = post?.image;
  if ((dir === undefined || dir === null || dir === '') || !image) return '';
  return `${boardOf(source).site}//images/${dir}/${image}`;
}

function extractImageUrl(source: BooruSource, post: any) {
  const style = boardOf(source).style;
  let candidates: Array<string | undefined | null>;

  if (style === 'e621') {
    candidates = [post?.sample?.url, post?.preview?.url, post?.file?.url];
  } else if (style === 'danbooru') {
    candidates = [post?.large_file_url, post?.preview_file_url, post?.file_url];
  } else if (style === 'moebooru') {
    candidates = [post?.sample_url, post?.jpeg_url, post?.preview_url, post?.file_url];
  } else if (style === 'philomena') {
    const rep = post?.representations || {};
    candidates = [rep.medium, rep.large, rep.tall, rep.small, rep.full, post?.view_url, post?.image];
  } else {
    // gelbooru
    candidates = [post?.sample_url, post?.file_url, gelbooruConstructedUrl(source, post), post?.preview_url];
  }

  let candidate = pickCover(candidates);
  // Some Philomena boards (e.g. Ponerpics) return root-relative representation paths.
  if (candidate.startsWith('/')) candidate = `${boardOf(source).site}${candidate}`;

  return proxyImageUrl(normalizeUrl(candidate));
}

function extractExternalUrl(source: BooruSource, post: any) {
  const id = String(post?.id ?? '');
  if (!id) return '';
  const board = boardOf(source);
  switch (board.style) {
    case 'e621':
    case 'danbooru':
      return `${board.site}/posts/${id}`;
    case 'moebooru':
      return `${board.site}/post/show/${id}`;
    case 'philomena':
      return source === 'twibooru' ? `${board.site}/${id}` : `${board.site}/images/${id}`;
    default:
      // gelbooru
      return `${board.site}/index.php?page=post&s=view&id=${id}`;
  }
}

/** Unwrap the many single-post envelope shapes upstream boards return. */
function getBooruPost(payload: any) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (payload.image) return payload.image; // philomena v1 single image
  if (payload.post) return payload.post; // gelbooru single / twibooru v3 single
  if (payload.data?.post) return payload.data.post;
  if (payload.data) return payload.data;
  return payload;
}

export function normalizeBooruQuery(source: BooruSource, query: string) {
  return normalizeRatingQuery(source, query.trim());
}

export function getBooruDefaultQuery(source: BooruSource) {
  const board = boardOf(source);
  if (board.style === 'philomena') return board.defaultQuery || 'explicit';
  if (board.style === 'gelbooru') return 'rating:explicit';
  return 'rating:e';
}

/** Absolute upstream URL for a page of search results. */
export function buildBooruSearchUrl(
  source: BooruSource,
  params: { limit: number; page: number; query: string },
): string {
  const board = boardOf(source);
  const origin = apiOrigin(source);
  const normalizedQuery = normalizeBooruQuery(source, params.query);

  if (board.style === 'gelbooru') {
    const url = new URL(`${origin}/index.php`);
    url.searchParams.set('page', 'dapi');
    url.searchParams.set('s', 'post');
    url.searchParams.set('q', 'index');
    url.searchParams.set('json', '1');
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('pid', String(params.page));
    url.searchParams.set('tags', normalizedQuery || 'rating:explicit');
    return url.toString();
  }

  if (board.style === 'moebooru') {
    const url = new URL(`${origin}/post.json`);
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('page', String(params.page + 1));
    url.searchParams.set('tags', normalizedQuery);
    return url.toString();
  }

  if (board.style === 'philomena') {
    const url = new URL(`${origin}${board.searchPath}`);
    url.searchParams.set('q', normalizedQuery || board.defaultQuery || 'explicit');
    url.searchParams.set('per_page', String(params.limit));
    url.searchParams.set('page', String(params.page + 1));
    if (board.filterId) url.searchParams.set('filter_id', String(board.filterId));
    return url.toString();
  }

  // danbooru + e621 family
  const url = new URL(`${origin}/posts.json`);
  url.searchParams.set('limit', String(params.limit));
  url.searchParams.set('page', String(params.page + 1));
  url.searchParams.set('tags', normalizedQuery);
  return url.toString();
}

/** Absolute upstream URL for a single post by id. */
export function buildBooruPostUrl(source: BooruSource, id: string): string {
  const board = boardOf(source);
  const origin = apiOrigin(source);
  const encoded = encodeURIComponent(id);

  if (board.style === 'gelbooru') {
    const url = new URL(`${origin}/index.php`);
    url.searchParams.set('page', 'dapi');
    url.searchParams.set('s', 'post');
    url.searchParams.set('q', 'index');
    url.searchParams.set('json', '1');
    url.searchParams.set('id', id);
    return url.toString();
  }

  if (board.style === 'moebooru') {
    const url = new URL(`${origin}/post.json`);
    url.searchParams.set('tags', `id:${id}`);
    return url.toString();
  }

  if (board.style === 'philomena') {
    return `${origin}${board.itemPath!(id)}`;
  }

  // danbooru + e621 family
  return `${origin}/posts/${encoded}.json`;
}

export function mapBooruPost(source: BooruSource, post: any): BooruPostSummary {
  const tags = extractTags(source, post);
  const rating = extractRating(source, post);
  const coverUrl = extractImageUrl(source, post);
  const id = String(post?.id ?? post?.post_id ?? '');

  return {
    id,
    title: compactTags(tags, `${boardOf(source).label} #${id || 'post'}`),
    description: tags.slice(0, 16).join(', '),
    coverUrl,
    rating,
    source,
    tags,
    externalUrl: extractExternalUrl(source, post),
  };
}

export function mapBooruSearchResults(source: BooruSource, payload: any): BooruPostSummary[] {
  const wrapKey = boardOf(source).wrapKey;
  const posts = Array.isArray(payload)
    ? payload
    : wrapKey && Array.isArray(payload?.[wrapKey])
      ? payload[wrapKey]
      : Array.isArray(payload?.images)
        ? payload.images
        : Array.isArray(payload?.posts)
          ? payload.posts
          : Array.isArray(payload?.post)
            ? payload.post
            : Array.isArray(payload?.data?.posts)
              ? payload.data.posts
              : Array.isArray(payload?.data)
                ? payload.data
                : [];

  // Search endpoints return the post objects directly inside the array — do NOT unwrap
  // `.post`/`.image` here (on gelbooru, `post.image` is the filename string, not an object).
  return posts
    .filter(Boolean)
    .map((post: any) => mapBooruPost(source, post))
    .filter((post: BooruPostSummary) => Boolean(post.id) && Boolean(post.coverUrl));
}

export function mapBooruDetail(source: BooruSource, payload: any): BooruPostSummary | null {
  const post = getBooruPost(payload);
  if (!post) return null;
  const mapped = mapBooruPost(source, post);
  return mapped.id ? mapped : null;
}

export function booruDisplayLabel(source: BooruSource) {
  return boardOf(source).label;
}
