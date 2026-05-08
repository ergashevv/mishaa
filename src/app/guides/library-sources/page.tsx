import { Database } from 'lucide-react';
import GuideArticleShell from '@/components/guides/GuideArticleShell';
import { guideArticleMetadata } from '@/lib/guides/registry';

export const metadata = guideArticleMetadata('library-sources');

export default function LibrarySourcesGuidePage() {
  return (
    <GuideArticleShell
      badge="Sources & safety"
      icon={<Database size={14} className="text-[#ff4d00]" />}
      title="Library sources, safety settings, and age gate"
      subtitle="Understand why titles aggregate from multiple APIs, how restricted catalogs behave, and where readers manage verification."
      sections={[
        {
          eyebrow: 'Architecture',
          title: 'Multi-source aggregation',
          body:
            'iComics.wiki stitches metadata from partner indexes instead of hosting binaries centrally.\n\n' +
            'That keeps fresher chapter pipelines but means outages mirror upstream APIs—retry later when rate limits spike.',
        },
        {
          eyebrow: 'Restricted',
          title: 'Adult catalogs require verification',
          body:
            'Some connectors ship explicit material. Server middleware hides payloads until age_verified cookies flip true inside Settings.\n\n' +
            'Disable verification only if minors never share the device—cookies reset when clearing browser storage.',
        },
        {
          eyebrow: 'IDs',
          title: 'Stable URLs matter for SEO',
          body:
            'Title detail routes canonicalize resolved IDs (especially legacy numeric slugs migrated to UUID feeds).\n\n' +
            'When sharing externally, copy from the address bar after hydration completes so canonical tags align across crawlers.',
        },
        {
          eyebrow: 'Support',
          title: 'Broken chapter playbook',
          body:
            'Collect series title, chapter label, device browser version, and approximate timestamp.\n\n' +
            'Support triages faster when screenshots exclude spoiler panels—blur artwork but include reader chrome.',
        },
      ]}
      footerNote={
        'Still blocked?\n' +
        'Visit FAQ or Support from the footer for routing specifics.'
      }
    />
  );
}
