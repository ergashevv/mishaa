import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import LegalPage from '@/components/LegalPage';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'DMCA & copyright',
  description:
    'Copyright and DMCA information for iComics.wiki — how to submit takedown notices and what we need to process claims.',
  path: '/dmca',
});

export default function DmcaPage() {
  return (
    <LegalPage
      badge="DMCA"
      title="Copyright Notice"
      subtitle="Use this page for copyright takedowns, ownership disputes, and formal removal requests."
      icon={<Scale size={14} className="text-[#ff4d00]" />}
      sections={[
        {
          eyebrow: 'Notice',
          title: 'Tell us what needs review',
          body: 'Send the exact page or comic URL, the copyright owner name, the material you believe is infringing, and a short explanation of your claim.',
        },
        {
          eyebrow: 'Contact',
          title: 'Use the support channel',
          body: 'For now, send notices to info@icomics.wiki or use the support form with category EXPORT_FAILURE or a similar issue label and mention DMCA in the details.',
        },
        {
          eyebrow: 'Response',
          title: 'We will review and act where appropriate',
          body: 'Valid notices may lead to removal, redaction, or further investigation. We may ask for more information if the request is incomplete.',
        },
        {
          eyebrow: 'Counter',
          title: 'You can include a counter notice',
          body: 'If you believe content was removed by mistake, provide the relevant page, your contact info, and a concise explanation of why the material should remain available.',
        },
      ]}
      footerNote="This page is informational and does not replace legal advice. For urgent matters, contact us directly at info@icomics.wiki."
    />
  );
}
