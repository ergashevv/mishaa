import type { Metadata } from 'next';
import ComicCreator from '@/components/ComicCreator';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'AI Comic Creator',
  description:
    'Create sequential comic panels with AI-assisted image generation — story-first workflow on iComics.wiki.',
  path: '/comic',
});

export default function ComicPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-neutral-900 dark:bg-black dark:text-white">
      <ComicCreator />
    </main>
  );
}
