export const runtime = "edge";
import { NextRequest, NextResponse } from 'next/server';

function isSafeId(value: string) {
  return /^[A-Za-z0-9._-]+$/.test(value);
}

function imageResponse(res: Response) {
  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const id = searchParams.get('id') || '';

  try {
    if (action === 'search') {
      const q = searchParams.get('q') || '';
      const page = Math.max(Number(searchParams.get('page') || '0'), 0);
      const limit = Math.min(Math.max(Number(searchParams.get('limit') || '36'), 1), 100);
      const searchFilter = q.includes('collection:') || q.includes('subject:')
        ? `(${q})`
        : q
          ? `(${q}) AND (collection:comic_books_archive OR subject:"Comic Books") AND -subject:magazine AND -subject:fanzine`
          : '(collection:comic_books_archive OR subject:"Comic Books") AND -subject:magazine AND -subject:fanzine';
      const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`${searchFilter} AND mediatype:texts`)}&fl[]=identifier,title,description,downloads,avg_rating&sort[]=downloads+desc&rows=${limit}&page=${page + 1}&output=json`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const body = await res.text();
      return new NextResponse(body, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'application/json',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    if (!isSafeId(id)) {
      return NextResponse.json({ error: 'Invalid archive identifier' }, { status: 400 });
    }

    if (action === 'metadata') {
      const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`, {
        next: { revalidate: 3600 },
      });
      const body = await res.text();
      return new NextResponse(body, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'application/json',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    if (action === 'cover') {
      const res = await fetch(`https://archive.org/services/img/${encodeURIComponent(id)}`, {
        next: { revalidate: 86400 },
      });
      return imageResponse(res);
    }

    if (action === 'download') {
      const file = searchParams.get('file');
      if (!file || file.includes('://') || file.includes('..') || file.includes('/')) {
        return NextResponse.json({ error: 'Invalid archive file' }, { status: 400 });
      }

      const res = await fetch(`https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(file)}`, {
        next: { revalidate: 86400 },
      });
      return imageResponse(res);
    }

    if (action === 'page') {
      const page = Math.max(Number(searchParams.get('page') || '0'), 0);
      const file = searchParams.get('file');
      const size = searchParams.get('size') || '8';
      const fullsize = searchParams.get('fullsize') || '1';
      const url = new URL(`https://archive.org/services/img/${encodeURIComponent(id)}/${page}`);
      url.searchParams.set('scale', size);
      url.searchParams.set('fullsize', fullsize);
      if (file && !file.includes('://') && !file.includes('..') && !file.includes('/')) {
        url.searchParams.set('file', file);
      }

      const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
      return imageResponse(res);
    }

    return NextResponse.json({ error: 'Invalid archive action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown archive proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
