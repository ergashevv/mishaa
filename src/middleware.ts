import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { UI_LANG_COOKIE } from '@/lib/i18n/cookies';
import { isUiLang } from '@/lib/i18n/lang';
import { UI_LANG_SEARCH_PARAM } from '@/lib/seo/hreflang-urls';
import { withIcsGeoRequestHeaders } from '@/lib/regional/geo-headers';
import { suggestedUiLangFromCountry } from '@/lib/i18n/suggested-ui-lang';
import { resolveRegionSignals } from '@/lib/regional/resolve-region';

const COOKIE_SECURE = process.env.NODE_ENV === 'production';

const cookieDefaults = {
  path: '/' as const,
  maxAge: 60 * 60 * 24 * 400,
  sameSite: 'lax' as const,
  secure: COOKIE_SECURE,
};

/** Dot-path routes (`feed.xml`) sometimes skip registration on Edge adapters; RSS is served from `/feed`. */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === '/feed.xml') {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.rewrite(url);
  }

  const headers = withIcsGeoRequestHeaders(request);
  const res = NextResponse.next({ request: { headers } });

  const country = request.headers.get('x-vercel-ip-country') ?? '';
  const signals = resolveRegionSignals(country);
  // Client-readable region UX flags. RegionalShell reads these AFTER hydration so the root
  // layout no longer needs cookies()/headers() (which forced the whole app dynamic).
  res.cookies.set('ics_analytics_consent_required', signals.analyticsConsentRequired ? '1' : '0', cookieDefaults);
  res.cookies.set('ics_east_age_copy', signals.eastAsiaAgeCopy ? '1' : '0', cookieDefaults);
  res.cookies.set('ics_europe_age_copy', signals.europeAgeCopy ? '1' : '0', cookieDefaults);

  const uiParam = request.nextUrl.searchParams.get(UI_LANG_SEARCH_PARAM);
  const fromUiQuery = isUiLang(uiParam) ? uiParam : null;

  if (fromUiQuery) {
    res.cookies.set(UI_LANG_COOKIE, fromUiQuery, cookieDefaults);
  } else if (!request.cookies.get(UI_LANG_COOKIE)?.value) {
    const suggested = suggestedUiLangFromCountry(country);
    res.cookies.set(UI_LANG_COOKIE, suggested, cookieDefaults);
  }

  return res;
}

export const config = {
  matcher: [
    '/feed.xml',
    '/((?!_next/static|_next/image|api|favicon.ico|icon.png|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
