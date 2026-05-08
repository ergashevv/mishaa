import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Contact',
  description:
    'Get in touch with iComics.wiki — feedback, partnerships, and general questions about the manga and comics reader.',
  path: '/contact',
});

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
