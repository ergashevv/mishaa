import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildGoogleAuthUrl, GOOGLE_STATE_COOKIE } from '@/lib/google-oauth';

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured' },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
