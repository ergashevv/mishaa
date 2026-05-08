import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Sign in',
  description: 'Sign in or create an account for bookmarks and synced preferences on iComics.wiki.',
  path: '/auth',
  robots: { index: false, follow: true },
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
