export type BooruSource = 'e621' | 'danbooru' | 'gelbooru';

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

const BOORU_LABELS: Record<BooruSource, string> = {
  e621: 'e621',
  danbooru: 'Danbooru',
  gelbooru: 'Gelbooru',
};

function normalizeUrl(url?: string | null) {
  if (!url) return '';
  return String(url).replace(/^http:\/\//, 'https://');
}

function proxyImageUrl(url: string) {
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function compactTags(tags: string[], fallback: string) {
  const unique = tags.filter(Boolean).slice(0, 3);
  if (unique.length === 0) return fallback;
  return unique.join(' ');
}

function normalizeRatingQuery(source: BooruSource, query: string) {
  if (!query) return query;

  const explicit = source === 'gelbooru' ? 'rating:explicit' : 'rating:e';
  const questionable = source === 'gelbooru' ? 'rating:questionable' : 'rating:q';
  const safe = source === 'gelbooru' ? 'rating:safe' : 'rating:s';

  return query
    .replace(/\brating:(?:explicit|e)\b/gi, explicit)
    .replace(/\brating:(?:questionable|q)\b/gi, questionable)
    .replace(/\brating:(?:safe|s)\b/gi, safe);
}

function extractRating(source: BooruSource, post: any) {
  const raw = String(post?.rating || post?.tag_string_rating || post?.post_rating || '').trim();
  if (!raw) return 'unknown';
  if (source === 'gelbooru') {
    if (raw === 'e' || raw.toLowerCase() === 'explicit') return 'explicit';
    if (raw === 'q' || raw.toLowerCase() === 'questionable') return 'questionable';
    if (raw === 's' || raw.toLowerCase() === 'safe') return 'safe';
    return raw.toLowerCase();
  }

  if (raw === 'e' || raw.toLowerCase() === 'explicit') return 'explicit';
  if (raw === 'q' || raw.toLowerCase() === 'questionable') return 'questionable';
  if (raw === 's' || raw.toLowerCase() === 'safe') return 'safe';
  return raw.toLowerCase();
}

function extractTags(source: BooruSource, post: any) {
  if (source === 'e621') {
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

  if (source === 'danbooru') {
    return String(post?.tag_string || '')
      .split(/\s+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return String(post?.tags || '')
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function extractImageUrl(source: BooruSource, post: any) {
  const candidate = source === 'e621'
    ? post?.file?.url || post?.sample?.url || post?.preview?.url
    : source === 'danbooru'
      ? post?.file_url || post?.large_file_url || post?.preview_file_url
      : post?.file_url || post?.sample_url || post?.preview_url;

  return proxyImageUrl(normalizeUrl(candidate));
}

function extractExternalUrl(source: BooruSource, post: any) {
  const id = String(post?.id ?? '');
  if (!id) return '';

  if (source === 'e621') return `https://e621.net/posts/${id}`;
  if (source === 'danbooru') return `https://danbooru.donmai.us/posts/${id}`;
  return `https://gelbooru.com/index.php?page=post&s=view&id=${id}`;
}

function getBooruPost(post: any) {
  if (!post) return null;
  if (post.post) return post.post;
  if (post.data?.post) return post.data.post;
  if (post.data) return post.data;
  return post;
}

export function normalizeBooruQuery(source: BooruSource, query: string) {
  return normalizeRatingQuery(source, query.trim());
}

export function getBooruDefaultQuery(source: BooruSource) {
  if (source === 'gelbooru') return 'rating:explicit';
  return 'rating:e';
}

export function mapBooruPost(source: BooruSource, post: any): BooruPostSummary {
  const tags = extractTags(source, post);
  const rating = extractRating(source, post);
  const coverUrl = extractImageUrl(source, post);
  const id = String(post?.id ?? post?.post_id ?? '');

  return {
    id,
    title: compactTags(tags, `${BOORU_LABELS[source]} #${id || 'post'}`),
    description: tags.slice(0, 16).join(', '),
    coverUrl,
    rating,
    source,
    tags,
    externalUrl: extractExternalUrl(source, post),
  };
}

export function mapBooruSearchResults(source: BooruSource, payload: any): BooruPostSummary[] {
  const posts = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.posts)
      ? payload.posts
      : Array.isArray(payload?.post)
        ? payload.post
        : Array.isArray(payload?.data?.posts)
          ? payload.data.posts
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

  return posts
    .map((post: any) => getBooruPost(post))
    .filter(Boolean)
    .map((post: any) => mapBooruPost(source, post))
    .filter((post: BooruPostSummary) => Boolean(post.id));
}

export function mapBooruDetail(source: BooruSource, payload: any): BooruPostSummary | null {
  const post = getBooruPost(payload);
  if (!post) return null;
  return mapBooruPost(source, post);
}

export function booruDisplayLabel(source: BooruSource) {
  return BOORU_LABELS[source];
}
