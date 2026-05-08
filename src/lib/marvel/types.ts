export type MarvelCreator = {
  role: string;
  name: string;
  id?: number;
};

export type MarvelCharacter = {
  id: number;
  name?: string;
  description?: string;
  thumbnail?: { path: string; extension: string };
};

export type MarvelSeries = {
  id: number;
  title?: string;
  description?: string;
  startYear?: number;
  endYear?: number;
  modified?: string;
  cover?: { path?: string; extension?: string };
  thumbnail?: { path?: string; extension?: string };
};

export type MarvelSeriesIssue = {
  id: number;
  title: string;
  issueNumber: string;
  detailUrl: string;
  seriesId: number;
  seriesName: string;
  onSaleDate?: string;
  unlimitedDate?: string;
  yearPage?: number;
  cover?: { path?: string; extension?: string };
};

export type MarvelIssue = {
  id: number;
  digitalId?: number;
  title: string;
  issueNumber?: string;
  description?: string;
  modified?: string;
  pageCount?: number;
  detailUrl?: string;
  seriesId?: number;
  seriesName?: string;
  onSaleDate?: string;
  unlimitedDate?: string;
  yearPage?: number;
  cover?: { path?: string; extension?: string };
  thumbnail?: { path?: string; extension?: string };
  creators?: MarvelCreator[];
};
