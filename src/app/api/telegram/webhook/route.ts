export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramWebhookSecret, handleTelegramUpdate } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  const expectedSecret = getTelegramWebhookSecret();
  if (expectedSecret) {
    const webhookSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (webhookSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const update = await req.json();
    const result = await handleTelegramUpdate(update);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
