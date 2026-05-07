export const runtime = 'nodejs';

import { runTelegramCron } from '@/lib/telegram';

export async function GET(request: Request) {
  return runTelegramCron(request, 'afternoon');
}
