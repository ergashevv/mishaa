'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { imageUnoptimizedForSrc } from '@/lib/next-image-unoptimized';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Search, X } from 'lucide-react';
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
    // Set loading synchronously: the old deferred setTimeout(setLoading(true), 0) fired
    // AFTER a cache-hit promise had already run finally(setLoading(false)), so cached
    // queries showed "Searching…" forever.
    setLoading(true);
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
    <div ref={searchBoxRef} className="relative z-30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="ic-input-wrap has-icon relative flex-1">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              // Open as the user types (not only on focus) — with the old focus-only
              // trigger, typing into a freshly-focused empty input never opened results.
              setOpen(next.trim().length >= 2);
            }}
            onFocus={() => trimmed.length >= 2 && setOpen(true)}
            placeholder={t.quickSearchPlaceholder}
            autoComplete="off"
            className="ic-input pr-11"
            aria-label={t.quickSearchPlaceholder}
          />
          {query ? (
            <button
              type="button"
              className="ic-iconbtn ic-iconbtn--sm absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={() => {
                setQuery('');
                setOpen(false);
              }}
              aria-label="Clear"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
        <Link href={libraryHref} className="ic-btn ic-btn--secondary ic-btn--md shrink-0">
          {t.viewAllInLibrary}
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <p className="ic-eyebrow mt-2 normal-case tracking-[0.04em]">
        {t.quickSearchHint}
      </p>

      {open && trimmed.length >= 2 ? (
        <div className="qresults sm:right-auto sm:min-w-[min(100%,28rem)]">
          <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-2">
            <span className="ic-eyebrow">{t.quickSearchResults}</span>
            <button
              type="button"
              className="ic-iconbtn ic-iconbtn--sm"
              onClick={() => setOpen(false)}
              aria-label="Close results"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10">
                <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden />
                <span className="ic-eyebrow">{t.quickSearchSearching}</span>
              </div>
            ) : results.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <span className="ic-eyebrow">{t.quickSearchNone}</span>
              </div>
            ) : (
              <>
                {results.map((comic) => (
                  <Link
                    key={`${comic.source}:${comic.id}`}
                    href={`/library/${comic.source}/${comic.id}`}
                    prefetch={false}
                    className="qresult w-full text-left"
                    onClick={() => setOpen(false)}
                  >
                    <span className="qresult__thumb">
                      <Image
                        src={comic.coverUrl || '/logo.png'}
                        alt={`${comic.title} — cover`}
                        fill
                        sizes="30px"
                        quality={65}
                        unoptimized={imageUnoptimizedForSrc(comic.coverUrl || '/logo.png')}
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="qresult__t block truncate">{comic.title}</span>
                      <span className="qresult__m block">{comic.source}</span>
                    </span>
                  </Link>
                ))}
                <Link
                  href={libraryHref}
                  className="qresult qresult--all"
                  onClick={() => setOpen(false)}
                >
                  {t.viewAllInLibrary} →
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
