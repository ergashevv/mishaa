'use client';

import LoadingRouteShell from '@/components/LoadingRouteShell';
import { useResolvedLang } from '@/hooks/useResolvedLang';
import { translations } from '@/lib/translations';

/** Root segment loading (`/src/app/loading.tsx`) — label follows Settings language. */
export default function AppRouteLoading() {
  const lang = useResolvedLang();
  return (
    <LoadingRouteShell
      tone="app"
      label={translations[lang].common.appLoading}
      spinnerClassName="h-11 w-11"
    />
  );
}
