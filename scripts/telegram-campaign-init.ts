/**
 * Intensive Telegram campaign (run locally with production env):
 * ...
 * Usage:
 *   npm run telegram:campaign-init
 *   npm run telegram:campaign-init:dry
 *
 * Loads `.env.local` then `.env` via dotenv (no extra CLI).
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

import { startTelegramIntensiveCampaign } from '../src/lib/telegram';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const result = await startTelegramIntensiveCampaign({
    poolSize: 100,
    postsInWeek: 84,
    hoursBetweenPosts: 2,
    intensiveDays: 7,
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

main();
