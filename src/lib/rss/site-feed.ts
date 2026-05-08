import { getPublicSiteUrl } from '@/lib/og-metadata';
import { GUIDES_ORDER } from '@/lib/guides/registry';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Canonical URL for `<atom:link rel="self">` — keep `/feed.xml` for compatibility with readers & Search Console.
 */
function feedSelfLink(base: string): string {
  return `${base}/feed.xml`;
}

export function buildSiteRssResponse(): Response {
  const base = getPublicSiteUrl().replace(/\/$/, '');
  const feedSelf = feedSelfLink(base);

  const staticEntries = [
    {
      url: `${base}/`,
      title: 'iComics.wiki — manga, manhwa & comics reader',
      description:
        'Browse manga, manhwa, webtoons, and comics online. Reader-first library with multi-source chapters.',
      pubDate: new Date('2026-05-08T12:00:00.000Z'),
    },
    {
      url: `${base}/library`,
      title: 'Comic & manga library',
      description: 'Search and browse the multi-source comic library on iComics.wiki.',
      pubDate: new Date('2026-05-08T12:00:00.000Z'),
    },
    {
      url: `${base}/faq`,
      title: 'FAQ — manga & comic reader',
      description: 'Answers about reading on iComics.wiki, accounts, mobile reading, and library behavior.',
      pubDate: new Date('2026-05-08T12:00:00.000Z'),
    },
    ...GUIDES_ORDER.map((g) => ({
      url: `${base}/guides/${g.slug}`,
      title: g.title,
      description: g.description,
      pubDate: new Date(g.publishedIso),
    })),
  ];

  const channelItems = staticEntries
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`,
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>iComics.wiki</title>
    <link>${escapeXml(`${base}/`)}</link>
    <description>${escapeXml('Updates from iComics.wiki — library, guides, and reader resources.')}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedSelf)}" rel="self" type="application/rss+xml"/>
    ${channelItems}
  </channel>
</rss>`;

  return new Response(rss.trim(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
