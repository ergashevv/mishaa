import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = staticPageMetadata({
  title: 'Superhero catalog',
  description:
    'Explore superhero characters and related comics on iComics.wiki — browse profiles tied to the reader library.',
  path: '/superheroes',
});

export default function SuperheroesLayout({ children }: { children: ReactNode }) {
  return children;
}
