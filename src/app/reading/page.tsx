import ReadingHubClient from '@/app/reading/ReadingHubClient';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata = staticPageMetadata({
  title: 'Reading hub — guides, RSS & progress',
  description:
    'Start here for icomics.wiki: step‑by‑step guides, RSS for new chapters, FAQs, Support, and why “iComics wiki” on this domain is not other apps or wiki hosts.',
  path: '/reading',
});

export default function ReadingHubPage() {
  return <ReadingHubClient />;
}
