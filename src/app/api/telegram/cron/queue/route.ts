import { runTelegramQueueCron } from '@/lib/telegram';

export const runtime = 'nodejs';

/** Every ~15 min: send next due queued comic during intensive week; ends campaign + cancels backlog when window expires. */
export async function GET(request: Request) {
  return runTelegramQueueCron(request);
}
