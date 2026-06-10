import type { LibrarySource } from '@/lib/comic-sources';
import type {
  MarvelCharacter,
  MarvelIssue,
  MarvelSeries,
  MarvelSeriesIssue,
} from '@/lib/marvel/types';

/** Single chapter row for any library source (normalized for UI + progress). */
export type ComicChapter = {
  id: string;
  title: string;
  chapterNum: string;
  volume?: string;
  externalUrl?: string;
  /** MangaDex feed `scanlation_group` name when requested. */
  scanlationGroup?: string;
};

/** Small related entry (e.g. MangaDex rails, nHentai related). */
export type ComicRelatedItem = {
  id: string;
  title: string;
  coverUrl: string;
  source: string;
  rating: string;
};

/**
 * Search / grid / category result — one shape for `searchComics` and library browser.
 */
export type ComicListItem = {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  rating: string;
  source: LibrarySource;
  issueNumber?: string;
  seriesName?: string;
  onSaleDate?: string;
  yearPage?: number;
  detailUrl?: string;
  pageCount?: number;
  creators?: { id: number; name: string; role: string }[];
  /** Source's last-updated timestamp (ISO 8601) — used for honest sitemap `lastmod`. */
  updatedAt?: string;
};

/**
 * Full detail payload from `getComicDetails` (all sources converge here).
 */
export type ComicDetail = {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  bannerUrl?: string;
  rating: string;
  genres: string[];
  status: string;
  year?: string;
  author?: string;
  source: LibrarySource;
  aniListId?: string;
  malId?: string | number;
  aniListData?: ComicDetailAniListData | null;
  jikanData?: ComicDetailJikanData | null;
  superheroData?: unknown;
  related?: ComicRelatedItem[];
  marvelIssue?: MarvelIssue;
  marvelSeries?: MarvelSeries;
  marvelSeriesIssues?: MarvelSeriesIssue[];
  marvelCharacters?: MarvelCharacter[];
  /** Present for `source === 'mangadex'` when `/statistics/manga/{id}` returns data. */
  mangaDexStats?: {
    follows: number | null;
    ratingBayesian: number | null;
    ratingAverage: number | null;
    unavailableChaptersCount?: number | null;
  };
};

export type ComicsSearchPage = {
  items: ComicListItem[];
  hasMore: boolean;
};

/** Subset used on detail UI (AniList merge / enrichment). */
export type ComicDetailAniListData = {
  description?: string;
  genres?: string[];
  averageScore?: number;
  popularity?: number;
  trending?: number;
  characters?: {
    edges?: Array<{
      role?: string;
      node?: {
        id?: string;
        image?: { large?: string };
        name?: { full?: string; userPreferred?: string };
      };
    }>;
  };
};

export type ComicDetailJikanData = {
  score?: number;
  members?: number;
  rank?: number | string;
};
