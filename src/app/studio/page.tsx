import type { Metadata } from "next";
import ComicCreator from '@/components/ComicCreator';
import Navbar from '@/components/Navbar';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const runtime = "edge";
export const metadata: Metadata = staticPageMetadata({
  title: 'Creative Studio',
  description:
    'AI-powered comic studio — sequential creation tools and a production-style workspace for building panels and stories.',
  path: '/studio',
});

export default function StudioPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#111111]">
      <Navbar />
      <div className="pt-16 sm:pt-20 pb-20">
        <ComicCreator />
      </div>
    </div>
  );
}
