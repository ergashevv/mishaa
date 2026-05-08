import { NextResponse } from 'next/server';
import { getSession, type SessionUser } from '@/lib/auth';

export type RequireSessionResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

export async function requireSession(): Promise<RequireSessionResult> {
  const user = await getSession();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, user };
}
