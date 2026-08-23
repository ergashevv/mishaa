export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAllProgress,
  deleteProgress,
  findProgress,
  listProgress,
  upsertProgress,
} from '@/lib/db/reading-progress-repo';
import { getSession } from '@/lib/auth';
import {
  calculateReadingProgressPercent,
  deriveReadingProgressStatus,
  ReadingProgressInput,
} from '@/lib/reading-progress';

const parseNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toPayload = (body: Record<string, unknown>): ReadingProgressInput => ({
  source: typeof body.source === 'string' ? body.source : '',
  comicId: typeof body.comicId === 'string' ? body.comicId : '',
  comicTitle: typeof body.comicTitle === 'string' ? body.comicTitle : undefined,
  comicCoverUrl: typeof body.comicCoverUrl === 'string' ? body.comicCoverUrl : undefined,
  chapterId: typeof body.chapterId === 'string' ? body.chapterId : undefined,
  chapterTitle: typeof body.chapterTitle === 'string' ? body.chapterTitle : undefined,
  chapterIndex: parseNumber(body.chapterIndex, 0),
  chapterCount: parseNumber(body.chapterCount, 0),
  currentPage: parseNumber(body.currentPage, 0),
  totalPages: parseNumber(body.totalPages, 0),
  scrollProgress: parseNumber(body.scrollProgress, 0),
  viewMode: body.viewMode === 'flow' || body.viewMode === 'journal' || body.viewMode === 'classic'
    ? body.viewMode
    : 'classic',
  timestamp: parseNumber(body.timestamp, Date.now()),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ items: [], progress: null }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const comicId = searchParams.get('comicId');

    if (source && comicId) {
      const progress = await findProgress(session.id, source, comicId);

      return NextResponse.json({ progress });
    }

    const items = await listProgress(session.id);

    return NextResponse.json({ items });
  } catch (error: unknown) {
    console.error('Reading progress GET error:', error);
    return NextResponse.json({ error: 'Failed to load reading progress' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const payload = toPayload(body as Record<string, unknown>);
    if (!payload.source || !payload.comicId) {
      return NextResponse.json({ error: 'Missing source or comicId' }, { status: 400 });
    }

    const progressPercent = calculateReadingProgressPercent(payload);
    const progressStatus = deriveReadingProgressStatus(progressPercent);

    const record = await upsertProgress({
      userId: session.id,
      source: payload.source,
      comicId: payload.comicId,
      comicTitle: payload.comicTitle || null,
      comicCoverUrl: payload.comicCoverUrl || null,
      chapterId: payload.chapterId || null,
      chapterTitle: payload.chapterTitle || null,
      currentPage: payload.currentPage || 0,
      totalPages: payload.totalPages || 0,
      chapterIndex: payload.chapterIndex || 0,
      chapterCount: payload.chapterCount || 0,
      progressPercent,
      progressStatus,
    });

    return NextResponse.json({ progress: record });
  } catch (error: unknown) {
    console.error('Reading progress POST error:', error);
    return NextResponse.json({ error: 'Failed to save reading progress' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const comicId = searchParams.get('comicId');

    if (source && comicId) {
      await deleteProgress(session.id, source, comicId);
      return NextResponse.json({ success: true });
    }

    await deleteAllProgress(session.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Reading progress DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete reading progress' }, { status: 500 });
  }
}
