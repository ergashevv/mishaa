import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Privacy Policy',
  description:
    'How iComics.wiki handles your data, cookies, age verification, and privacy choices when you use the reader.',
  path: '/privacy',
});

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
