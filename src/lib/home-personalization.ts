import { isAdultComic } from '@/lib/age-verification';
import type { StoredBookmark, StoredReadingHistoryEntry } from '@/lib/library-storage';

export type PersonalizableComic = {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  source?: string;
  href?: string;
  meta?: string;
  rating?: string;
  timestamp?: number;
  progressPercent?: number;
  genres?: string[];
};

export type HomePreferenceProfile = {
  sessionId: string;
  seed: number;
  genreWeights: Record<string, number>;
  viewedKeys: string[];
  skippedKeys: string[];
  savedKeys: string[];
  updatedAt: number;
};

export const HOME_PROFILE_STORAGE_KEY = 'home_preference_profile';
export const HOME_PROFILE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 45;
export const PREFERRED_HOME_GENRES = ['romance', 'fantasy'];

const ADULT_SOURCE_SET = new Set(['nhentai', 'e621', 'danbooru', 'gelbooru', 'rule34']);

const normalize = (value: string | undefined | null) => String(value || '').trim().toLowerCase();

export const comicKey = (comic: Pick<PersonalizableComic, 'source' | 'id'>) =>
  `${normalize(comic.source) || 'unknown'}:${comic.id}`;

export const isAdultPersonalizedComic = (comic: PersonalizableComic) => {
  const source = normalize(comic.source);
  return ADULT_SOURCE_SET.has(source) || isAdultComic({ source, rating: comic.rating });
};

export const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const seededUnit = (seed: number, value: string) => {
  const mixed = hashString(`${seed}:${value}`);
  return mixed / 4294967295;
};

export const createAnonymousSessionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const createDefaultHomeProfile = (sessionId = createAnonymousSessionId()): HomePreferenceProfile => ({
  sessionId,
  seed: hashString(sessionId),
  genreWeights: {
    romance: 3.4,
    fantasy: 3.1,
  },
  viewedKeys: [],
  skippedKeys: [],
  savedKeys: [],
  updatedAt: Date.now(),
});

const parseJsonObject = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readRawStorage = (key: string) => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeRawStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const isFreshProfile = (profile: HomePreferenceProfile) =>
  Date.now() - Number(profile.updatedAt || 0) < HOME_PROFILE_MAX_AGE_MS;

export const readHomePreferenceProfile = () => {
  const raw = parseJsonObject(readRawStorage(HOME_PROFILE_STORAGE_KEY));
  if (!raw) return createDefaultHomeProfile();

  const sessionId = typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : createAnonymousSessionId();
  const profile: HomePreferenceProfile = {
    sessionId,
    seed: Number.isFinite(Number(raw.seed)) ? Number(raw.seed) : hashString(sessionId),
    genreWeights: raw.genreWeights && typeof raw.genreWeights === 'object' && !Array.isArray(raw.genreWeights)
      ? Object.fromEntries(
          Object.entries(raw.genreWeights as Record<string, unknown>)
            .map(([key, value]) => [normalize(key), Number(value)])
            .filter(([key, value]) => Boolean(key) && Number.isFinite(value))
        )
      : {},
    viewedKeys: Array.isArray(raw.viewedKeys) ? raw.viewedKeys.map(String).slice(-160) : [],
    skippedKeys: Array.isArray(raw.skippedKeys) ? raw.skippedKeys.map(String).slice(-160) : [],
    savedKeys: Array.isArray(raw.savedKeys) ? raw.savedKeys.map(String).slice(-160) : [],
    updatedAt: Number(raw.updatedAt || 0),
  };

  if (!isFreshProfile(profile)) return createDefaultHomeProfile(sessionId);

  return {
    ...profile,
    genreWeights: {
      romance: 3.4,
      fantasy: 3.1,
      ...profile.genreWeights,
    },
  };
};

export const persistHomePreferenceProfile = (profile: HomePreferenceProfile) => {
  writeRawStorage(HOME_PROFILE_STORAGE_KEY, JSON.stringify({
    ...profile,
    viewedKeys: profile.viewedKeys.slice(-160),
    skippedKeys: profile.skippedKeys.slice(-160),
    savedKeys: profile.savedKeys.slice(-160),
    updatedAt: Date.now(),
  }));
};

export const inferComicGenres = (comic: PersonalizableComic, shelfKey = '') => {
  const haystack = [
    shelfKey,
    comic.meta,
    comic.title,
    comic.description,
    ...(comic.genres || []),
  ].map(normalize).join(' ');

  const genres = new Set<string>();
  PREFERRED_HOME_GENRES.forEach((genre) => {
    if (haystack.includes(genre)) genres.add(genre);
  });

  if (haystack.includes('webtoon') || haystack.includes('long strip')) genres.add('webtoon');
  if (haystack.includes('manhwa') || haystack.includes('korean')) genres.add('manhwa');
  if (haystack.includes('doujin') || haystack.includes('18+') || haystack.includes('mature')) genres.add('adult');
  if (haystack.includes('new') || haystack.includes('latest') || haystack.includes('recent')) genres.add('fresh');
  if (haystack.includes('trend') || haystack.includes('popular')) genres.add('popular');

  return Array.from(genres);
};

export const mergeActivityIntoProfile = (
  profile: HomePreferenceProfile,
  history: Record<string, StoredReadingHistoryEntry>,
  bookmarks: StoredBookmark[],
) => {
  const genreWeights = { ...profile.genreWeights };
  const viewedKeys = new Set(profile.viewedKeys);
  const savedKeys = new Set(profile.savedKeys);

  Object.entries(history).forEach(([key, entry]) => {
    viewedKeys.add(key);
    const source = entry.comicSource || key.split(':')[0];
    const comic: PersonalizableComic = {
      id: String(entry.id || key.split(':')[1] || ''),
      source,
      title: entry.comicTitle || entry.chapterTitle || entry.title || '',
      description: entry.chapterTitle || '',
    };

    inferComicGenres(comic).forEach((genre) => {
      genreWeights[genre] = (genreWeights[genre] || 0) + 0.6;
    });
  });

  bookmarks.forEach((bookmark) => {
    const key = comicKey(bookmark);
    savedKeys.add(key);
    inferComicGenres({
      id: bookmark.id,
      source: bookmark.source,
      title: bookmark.title || '',
      rating: bookmark.rating,
    }).forEach((genre) => {
      genreWeights[genre] = (genreWeights[genre] || 0) + 1;
    });
  });

  return {
    ...profile,
    genreWeights,
    viewedKeys: Array.from(viewedKeys).slice(-160),
    savedKeys: Array.from(savedKeys).slice(-160),
    updatedAt: Date.now(),
  };
};

export const rankComicsForHome = <T extends PersonalizableComic>(
  comics: T[],
  options: {
    profile: HomePreferenceProfile;
    ageVerified: boolean;
    shelfKey?: string;
    pageIndex?: number;
    seenKeys?: Set<string>;
    adultPenalty?: number;
  },
) => {
  const seenKeys = options.seenKeys || new Set<string>();
  const viewedKeys = new Set(options.profile.viewedKeys);
  const skippedKeys = new Set(options.profile.skippedKeys);
  const savedKeys = new Set(options.profile.savedKeys);
  const pageIndex = options.pageIndex || 0;

  return comics
    .filter((comic) => {
      const key = comicKey(comic);
      if (!comic.id || !comic.title || seenKeys.has(key)) return false;
      return options.ageVerified || !isAdultPersonalizedComic(comic);
    })
    .map((comic) => {
      const key = comicKey(comic);
      const genres = inferComicGenres(comic, options.shelfKey);
      const preferredGenreScore = genres.reduce((score, genre) => score + (options.profile.genreWeights[genre] || 0), 0);
      const romanceFantasyBoost = genres.some((genre) => PREFERRED_HOME_GENRES.includes(genre)) ? 5 : 0;
      const savedBoost = savedKeys.has(key) ? 4 : 0;
      const viewedPenalty = viewedKeys.has(key) ? -2.2 : 0;
      const skippedPenalty = skippedKeys.has(key) ? -3.5 : 0;
      const adultPenalty = isAdultPersonalizedComic(comic)
        ? (options.adultPenalty ?? (pageIndex < 2 ? -12 : -4))
        : 0;
      const freshness = Number(comic.timestamp || 0) > 0 ? Math.min(2, (Date.now() - Number(comic.timestamp)) / -86400000) : 0;
      const randomness = seededUnit(options.profile.seed + pageIndex, key) * 3.2;

      return {
        comic,
        score: preferredGenreScore + romanceFantasyBoost + savedBoost + freshness + randomness + viewedPenalty + skippedPenalty + adultPenalty,
      };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ comic }) => comic);
};

export const dedupeComics = <T extends PersonalizableComic>(comics: T[]) => {
  const seen = new Set<string>();
  return comics.filter((comic) => {
    const key = comicKey(comic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
