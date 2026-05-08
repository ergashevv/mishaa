import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'About iComics.wiki',
  description:
    'Learn what iComics.wiki is: a reader-first manga, manhwa, and comics library with multi-source chapters and optional creator tools.',
  path: '/about',
});

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
