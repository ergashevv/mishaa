import { readStorageItem, writeStorageItem } from '@/lib/browser-storage';

export const VISITOR_ID_KEY = 'ics_visitor_id';

/**
 * A stable per-browser id so the dashboard can tell "1,000 page views" from "1,000 people".
 * Random, first-party, never tied to an account and never joined with one — it only groups
 * one browser's own visits.
 */
export function getVisitorId(): string {
  const existing = readStorageItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  writeStorageItem(VISITOR_ID_KEY, generated);
  return generated;
}
