import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import LegalPage from '@/components/LegalPage';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Content policy',
  description:
    'Content safety policy for iComics.wiki — adult age gate, reports, moderation, and how we handle unsafe or infringing material.',
  path: '/content-policy',
});

export default function ContentPolicyPage() {
  return (
    <LegalPage
      badge="Content Policy"
      title="Content Safety Policy"
      subtitle="This page explains how we handle adult content, reports, moderation, and user safety."
      icon={<ShieldAlert size={14} className="text-[#ff4d00]" />}
      sections={[
        {
          eyebrow: 'Age Gate',
          title: 'Adult material is gated',
          body: 'Some sources contain 18+ content. Access is blocked unless age verification is enabled. You can toggle it in Settings and it may be cleared if you disable it.',
        },
        {
          eyebrow: 'Reports',
          title: 'Broken or unsafe content should be reported',
          body: 'Use Support to report broken chapters, incorrect metadata, unsafe material, or copyright concerns. Include the comic title, source, and a short description so we can act quickly.',
        },
        {
          eyebrow: 'Moderation',
          title: 'We may hide or remove items',
          body: 'Items that violate policy, are broken, or create legal risk may be hidden from search and listings. We aim to keep the library useful and safe for legitimate users.',
        },
        {
          eyebrow: 'User Controls',
          title: 'You control your local data',
          body: 'Bookmarks, reading history, language preferences, and age verification live in your browser. You can clear them from Settings at any time.',
        },
      ]}
      footerNote="If you need help with a specific item, open the comic page and use the report flow. That gives us the fastest path to investigate."
    />
  );
}
