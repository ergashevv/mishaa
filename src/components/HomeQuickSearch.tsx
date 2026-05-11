'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Search, X } from 'lucide-react';
import type { ComicListItem } from '@/lib/comic-types';
import type { MangaLanguage } from '@/lib/manga-language';
import { searchComicsWithClientCache } from '@/lib/comic-search-client-cache';
import { readStorageItem } from '@/lib/browser-storage';
import { translations, Lang } from '@/lib/translations';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const ADULT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'];
const MINOR_RATINGS = ['safe', 'suggestive'];

type HomeQuickSearchProps = {
  mangaLanguage: MangaLanguage;
  isAgeVerified: boolean;
  onDebouncedShelfFilter?: (query: string) => void;
};

export default function HomeQuickSearch({
  mangaLanguage,
  isAgeVerified,
  onDebouncedShelfFilter,
}: HomeQuickSearchProps) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].hero;

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 420);
  const [results, setResults] = useState<ComicListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    const timer =
      savedLang && translations[savedLang]
        ? window.setTimeout(() => setLang((c) => (savedLang !== c ? savedLang : c)), 0)
        : undefined;
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => {
      window.removeEventListener('langChange', onLang as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    onDebouncedShelfFilter?.(debouncedQuery.trim());
  }, [debouncedQuery, onDebouncedShelfFilter]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      const t = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;
    const loadingT = window.setTimeout(() => setLoading(true), 0);
    const ratings = isAgeVerified ? ADULT_RATINGS : MINOR_RATINGS;

    void searchComicsWithClientCache({
      source: 'mangadex',
      query: q,
      page: 0,
      mangaLanguage,
      ratings,
    })
      .then((page) => {
        if (!cancelled) {
          setResults(page.items.slice(0, 8));
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingT);
    };
  }, [debouncedQuery, isAgeVerified, mangaLanguage]);

  const trimmed = query.trim();
  const trimmedDebouncedForLink = debouncedQuery.trim();

  const libraryHref = useMemo(() => {
    const params = new URLSearchParams({
      tab: 'Manga Hub',
      ...(trimmedDebouncedForLink.length >= 2 ? { q: trimmedDebouncedForLink } : {}),
    });
    return `/library?${params.toString()}`;
  }, [trimmedDebouncedForLink]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!open) return;
      const el = searchBoxRef.current;
      if (el?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={searchBoxRef} className="relative z-30 mb-10 sm:mb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-white/25" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => trimmed.length >= 2 && setOpen(true)}
            placeholder={t.quickSearchPlaceholder}
            autoComplete="off"
            className="w-full rounded-2xl border border-neutral-200 bg-white py-4 pl-12 pr-12 text-sm font-semibold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#ff5a1f] dark:border-white/10 dark:bg-black/50 dark:text-white dark:placeholder:text-white/30"
            aria-label={t.quickSearchPlaceholder}
          />
          {query ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              onClick={() => {
                setQuery('');
                setOpen(false);
              }}
              aria-label="Clear"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
        <Link
          href={libraryHref}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-800 transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:text-[#ff5a1f]"
        >
          {t.viewAllInLibrary}
        </Link>
      </div>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-400 dark:text-white/25">
        {t.quickSearchHint}
      </p>

      {open && trimmed.length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-[5000] mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d0d0d] sm:left-auto sm:right-auto sm:min-w-[min(100%,28rem)]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-white/5">
            <span className="px-2 text-[9px] font-bold uppercase tracking-[0.35em] text-neutral-400 dark:text-white/35">
              {t.quickSearchResults}
            </span>
            <button
              type="button"
              className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              onClick={() => setOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#ff5a1f]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 dark:text-white/30">
                  {t.quickSearchSearching}
                </span>
              </div>
            ) : results.length === 0 ? (
              <div className="px-6 py-8 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 dark:text-white/25">
                {t.quickSearchNone}
              </div>
            ) : (
              results.map((comic) => (
                <button
                  key={`${comic.source}:${comic.id}`}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2 text-left transition hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/5"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/library/${comic.source}/${comic.id}`);
                  }}
                >
                  <div className="relative aspect-[2/3] h-12 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-neutral-900">
                    <Image
                      src={comic.coverUrl || '/logo.png'}
                      alt={`${comic.title} — cover`}
                      fill
                      sizes="48px"
                      quality={65}
                      unoptimized={imageUnoptimizedForSrc(comic.coverUrl || '/logo.png')}
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold uppercase tracking-tight text-neutral-900 dark:text-white">
                      {comic.title}
                    </div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-[#ff5a1f]">
                      {comic.source}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-white/20" />
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
