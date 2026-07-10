import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/og-metadata';

export default function manifest(): MetadataRoute.Manifest {
  const base = getPublicSiteUrl().replace(/\/$/, '');
  return {
    name: 'iComics.wiki — Manga, Manhwa & Comics',
    short_name: 'iComics',
    description:
      'Browse and read manga, manhwa, webtoons, and comics online. Library catalog with multi-source chapters.',
    start_url: `${base}/`,
    display: 'standalone',
    background_color: '#0D0D10',
    theme_color: '#0D0D10',
    icons: [
      {
        src: `${base}/icon.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
