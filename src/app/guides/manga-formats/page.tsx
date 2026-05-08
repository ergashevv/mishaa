import { Layers } from 'lucide-react';
import GuideArticleShell from '@/components/guides/GuideArticleShell';
import { guideArticleMetadata } from '@/lib/guides/registry';

export const metadata = guideArticleMetadata('manga-formats');

export default function MangaFormatsGuidePage() {
  return (
    <GuideArticleShell
      badge="Formats"
      icon={<Layers size={14} className="text-[#ff4d00]" />}
      title="Manga vs manhwa vs webtoon"
      subtitle="Naming varies across publishers, but direction and composition patterns determine how each format reads on modern displays."
      sections={[
        {
          eyebrow: 'Classic manga',
          title: 'Right-to-left paging',
          body:
            'Japanese manga traditionally flows right-to-left across spreads. Readers swipe backward compared to Western comics.\n\n' +
            'Lettering density runs vertically sometimes—zoom sparingly or rely on reader gutter spacing tuned for mobile portrait.',
        },
        {
          eyebrow: 'Manhwa',
          title: 'Korean layout nuances',
          body:
            'Manhwa spans digital-first serialization with frequent panel grids tuned for tall smartphone canvases.\n\n' +
            'Colors trend saturated vs monochrome manga anthologies; translation bubbles usually remain horizontal for scanlator parity.',
        },
        {
          eyebrow: 'Webtoons',
          title: 'Vertical infinite canvas',
          body:
            'Webtoon-style strips stack panels vertically with generous gutters—ideal for tap-through scrolling.\n\n' +
            'Expect cliffhangers spaced intentionally mid-scroll; avoid jumping chapters mid-load because lazy artwork hydrates progressively.',
        },
        {
          eyebrow: 'Quality signals',
          title: 'Choosing readable editions',
          body:
            'Official scans beat aggressive compression fan uploads when judging artifacts.\n\n' +
            'If halftones shimmer or moiré appears, switch sources inside Library rather than forcing upscale filters.',
        },
      ]}
      footerNote={
        'Want catalog mechanics behind listings?\n' +
        '→ /guides/library-sources'
      }
    />
  );
}
