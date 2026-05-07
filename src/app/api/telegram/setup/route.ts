export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { setTelegramBotProfile } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.TELEGRAM_SETUP_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await setTelegramBotProfile();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown setup error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
