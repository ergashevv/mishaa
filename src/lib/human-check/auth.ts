import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'ics_admin';

/** Length-independent, branch-free compare so a wrong token leaks no timing signal. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function getAdminToken(): string | null {
  const token = process.env.ADMIN_DASHBOARD_TOKEN;
  // An unset token must lock the dashboard, never open it.
  return token && token.length >= 16 ? token : null;
}

export function isValidAdminToken(candidate: string | null | undefined): boolean {
  const token = getAdminToken();
  if (!token || !candidate) return false;
  return safeEqual(candidate, token);
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminToken(store.get(ADMIN_COOKIE)?.value);
}
