import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Your profile',
  description: 'Manage your public profile and avatar on iComics.wiki.',
  path: '/profile',
  robots: { index: false, follow: true },
});

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
