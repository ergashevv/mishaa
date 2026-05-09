import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Gallery — iComics.wiki visual catalog',
  description:
    'Featured artwork and highlights from the icomics.wiki community and catalog—part of the official icomics.wiki manga and comic reader experience.',
  path: '/gallery',
});

export default function GalleryLayout({ children }: { children: ReactNode }) {
  return children;
}
