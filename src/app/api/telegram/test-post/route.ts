export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

import {
  getTelegramOutboundDiagnostics,
  sendTelegramChannelTestPost,
} from '@/lib/telegram';

function authorizeTestPost(request: Request): boolean {
  const auth = request.headers.get('authorization')?.trim();
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice('Bearer '.length).trim();
  const setup = process.env.TELEGRAM_SETUP_SECRET?.trim();
  const cron = process.env.CRON_SECRET?.trim();
  return (Boolean(setup) && token === setup) || (Boolean(cron) && token === cron);
}

/** GET: verify auth + env (no Telegram message). POST: one test post to the channel. */
export async function GET(request: Request) {
  if (!authorizeTestPost(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    ping: true,
    ...getTelegramOutboundDiagnostics(),
    hint: 'Send POST with the same Authorization header to publish one 🔧 Test post.',
  });
}

/** POST: send one random featured comic to the channel (caption label 🔧 Test post). Same auth as setup (TELEGRAM_SETUP_SECRET) or CRON_SECRET. */
export async function POST(request: Request) {
  if (!authorizeTestPost(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendTelegramChannelTestPost();
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
