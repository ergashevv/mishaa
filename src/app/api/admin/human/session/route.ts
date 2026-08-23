/** `runtime = 'edge'` compiles to a stub with no entrypoint on opennextjs-cloudflare — always nodejs. */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, getAdminToken, isValidAdminToken } from '@/lib/human-check/auth';

const DASHBOARD_PATH = '/admin/human';

function redirect(request: Request, query = '') {
  // 303 so the browser re-issues the follow-up as GET instead of replaying the POST.
  return NextResponse.redirect(new URL(`${DASHBOARD_PATH}${query}`, request.url), 303);
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const intent = String(form?.get('intent') ?? 'login');

  if (intent === 'logout') {
    const response = redirect(request);
    response.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  }

  const submitted = String(form?.get('token') ?? '');

  if (!getAdminToken()) return redirect(request, '?error=unconfigured');
  if (!isValidAdminToken(submitted)) return redirect(request, '?error=invalid');

  const response = redirect(request);
  response.cookies.set(ADMIN_COOKIE, submitted, {
    path: '/',
    // httpOnly keeps the token out of reach of any script on the page (including a future XSS).
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
