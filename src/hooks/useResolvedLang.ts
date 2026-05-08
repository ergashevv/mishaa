'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { readStorageItem } from '@/lib/browser-storage';
import { translations, type Lang } from '@/lib/translations';

function readLang(): Lang {
  const stored = readStorageItem('lang') as Lang | null;
  if (stored && translations[stored]) return stored;
  return 'en';
}

/**
 * Resolves the Settings UI language (`localStorage.key === "lang"`).
 * Server / first paint snapshot is always `en`; after hydration the client stores the real value and
 * reacts to the `langChange` event so loading states stay in sync without a full reload.
 */
export function useResolvedLang(): Lang {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener('langChange', onStoreChange as EventListener);
    return () => window.removeEventListener('langChange', onStoreChange as EventListener);
  }, []);
  return useSyncExternalStore(subscribe, readLang, () => 'en' as const);
}
