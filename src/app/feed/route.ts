import { buildSiteRssResponse } from '@/lib/rss/site-feed';

export async function GET() {
  return buildSiteRssResponse();
}
