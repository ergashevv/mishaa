import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Support',
  description:
    'Help with iComics.wiki — broken chapters, account issues, content reports, and how to get unstuck while reading.',
  path: '/support',
});

export default function SupportLayout({ children }: { children: ReactNode }) {
  return children;
}
