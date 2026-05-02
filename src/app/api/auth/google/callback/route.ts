import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
  createGoogleSession,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  GOOGLE_STATE_COOKIE,
} from '@/lib/google-oauth';

const redirectToAuthError = (error: string) =>
  NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error)}`, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const cookieStore = await cookies();
    const savedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;

    cookieStore.delete(GOOGLE_STATE_COOKIE);

    if (!code || !state || !savedState || state !== savedState) {
      return redirectToAuthError('google_state_mismatch');
    }

    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleProfile(tokens.access_token);
    await createGoogleSession(profile);

    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    return redirectToAuthError('google_login_failed');
  }
}
