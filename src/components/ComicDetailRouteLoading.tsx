'use client';

import LoadingRouteShell from '@/components/LoadingRouteShell';
import { useResolvedLang } from '@/hooks/useResolvedLang';
import { translations } from '@/lib/translations';

/** `/library/[source]/[id]` segment loading. */
export default function ComicDetailRouteLoading() {
  const lang = useResolvedLang();
  return (
    <LoadingRouteShell
      tone="comic-detail"
      label={translations[lang].library.loadingComic}
      spinnerClassName="h-12 w-12"
    />
  );
}
