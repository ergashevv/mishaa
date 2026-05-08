import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import LegalPage from '@/components/LegalPage';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Terms & Conditions',
  description:
    'Terms of use for iComics.wiki — acceptable use, access limits, accounts, and your responsibilities when using the reader.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage
      badge="Terms Of Use"
      title="Terms & Conditions"
      subtitle="These terms explain how iComics.wiki works, what users can do, and where the limits are."
      icon={<FileText size={14} className="text-[#ff4d00]" />}
      sections={[
        {
          eyebrow: 'Access',
          title: 'Use the site responsibly',
          body: 'You may browse, read, save bookmarks, and use the studio features for personal, non-destructive use. You agree not to abuse the platform, overload the APIs, or interfere with other users.',
        },
        {
          eyebrow: 'Account',
          title: 'Your profile is your responsibility',
          body: 'Keep your login details secure. If you use Google, email/password, or any future auth provider, you are responsible for activity under your account.',
        },
        {
          eyebrow: 'Content',
          title: 'Library content may change',
          body: 'Metadata, chapters, sources, and availability can change over time. We may update, remove, or reclassify content when needed for quality, safety, or compliance.',
        },
        {
          eyebrow: 'Restrictions',
          title: 'No scraping, cloning, or misuse',
          body: 'Do not resell content, mass-export data, or attempt to bypass safety controls. Adult content access is limited by age verification and may be revoked if used improperly.',
        },
      ]}
      footerNote="If you disagree with these terms, please stop using the site. For questions, use the support page or email info@icomics.wiki."
    />
  );
}
