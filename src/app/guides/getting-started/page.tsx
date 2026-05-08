import { Compass } from 'lucide-react';
import GuideArticleShell from '@/components/guides/GuideArticleShell';
import { guideArticleMetadata } from '@/lib/guides/registry';

export const metadata = guideArticleMetadata('getting-started');

export default function GettingStartedGuidePage() {
  return (
    <GuideArticleShell
      badge="Getting started"
      icon={<Compass size={14} className="text-[#ff4d00]" />}
      title="Getting started with the iComics.wiki reader"
      subtitle="Use this checklist on your first visit: find titles quickly, open a stable chapter reader, and keep mobile scrolling smooth."
      sections={[
        {
          eyebrow: 'Browse',
          title: 'Start from the library, not random URLs',
          body:
            'Open Library from the top navigation. Use tabs or filters to narrow sources before searching.\n\n' +
            'Why this matters: the catalog merges multiple backends (for example MangaDex listings or Marvel issues). Starting inside Library keeps IDs and chapter feeds aligned so links resolve reliably.',
        },
        {
          eyebrow: 'Reader',
          title: 'Detail page versus chapter reader',
          body:
            'Every series has a detail route that lists chapters and metadata. Picking Read sends you into the chapter URL (/read/[chapterId]) which loads pages sequentially.\n\n' +
            'If images stall briefly on cold CDN caches, wait or reload once—the proxy prefers compressed previews where social crawlers need smaller payloads.',
        },
        {
          eyebrow: 'Mobile',
          title: 'Scroll modes and rotation',
          body:
            'On phones, try locking portrait orientation for paginated manga spreads or rotating landscape only after enabling responsive spreads.\n\n' +
            'Large balloon dialogue scales automatically when pinch-zoom stays disabled—prefer adjusting brightness rather than zoom unless impaired vision demands it.',
        },
        {
          eyebrow: 'Accounts',
          title: 'Optional bookmark syncing',
          body:
            'Anonymous browsing works out of the box. Signing in allows bookmarks and synced preferences.\n\n' +
            'Age verification persists via cookie toggled inside Settings—clear cookies only after disabling Adult catalogs intentionally.',
        },
      ]}
      footerNote={
        'Next step: compare manga versus vertical scrolling titles so expectations match each layout.\n' +
        '→ /guides/manga-formats'
      }
    />
  );
}
