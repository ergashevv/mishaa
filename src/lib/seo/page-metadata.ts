import type { Metadata } from 'next';
import { getPublicSiteUrl } from '@/lib/og-metadata';

function siteOrigin(): string {
  return getPublicSiteUrl().replace(/\/$/, '');
}

/** Standard metadata for static marketing/info routes (canonical + OG + Twitter). */
export function staticPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  robots?: Metadata['robots'];
}): Metadata {
  const url = `${siteOrigin()}${opts.path.startsWith('/') ? opts.path : `/${opts.path}`}`;
  const base: Metadata = {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: 'iComics.wiki',
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
    },
  };
  if (opts.robots !== undefined) {
    base.robots = opts.robots;
  }
  return base;
}
