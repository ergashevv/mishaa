import { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/og-metadata';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteUrl().replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/profile/',
        '/settings/',
        '/auth/',
        '/admin/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
