import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Dot-path routes (`feed.xml`) sometimes skip registration on Edge adapters; RSS is served from `/feed`. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/feed.xml') {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/feed.xml',
};
