import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://icomics.wiki').replace(/\/$/, '');
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/studio/edit/',
        '/profile/',
        '/settings/',
        '/auth/',
        '/admin/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
