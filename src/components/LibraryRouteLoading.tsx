'use client';

import LoadingRouteShell from '@/components/LoadingRouteShell';
import { useResolvedLang } from '@/hooks/useResolvedLang';
import { translations } from '@/lib/translations';

/** Library Suspense fallback and `/library/loading.tsx` shell. */
export default function LibraryRouteLoading() {
  const lang = useResolvedLang();
  return (
    <LoadingRouteShell
      tone="library"
      label={translations[lang].library.loadingLibrary}
      spinnerClassName="h-10 w-10"
    />
  );
}
