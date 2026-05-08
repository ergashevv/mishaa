import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Gallery',
  description:
    'Browse featured artwork and visuals from the iComics.wiki community and catalog highlights.',
  path: '/gallery',
});

export default function GalleryLayout({ children }: { children: ReactNode }) {
  return children;
}
