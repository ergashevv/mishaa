import type { Metadata } from 'next';
import { buildSiteLogoOgImage, getPublicSiteUrl } from '@/lib/og-metadata';

/** Product name for `siteName` / JSON-LD (keep in sync across OG + breadcrumbs). */
export const ICS_SITE_DISPLAY_NAME = 'iComics.wiki' as const;

const ICS_OG_LOCALE = 'en_US' as const;

function normalizedOrigin(): string {
  return getPublicSiteUrl().replace(/\/$/, '');
}

/**
 * Canonical Open Graph + Twitter cards using `/logo.png` (same dimensions as `buildSiteLogoOgImage`).
 * Separates OG vs Twitter headline/body where marketing copy legitimately differs.
 */
export function openGraphTwitterFromLogo(input: {
  origin: string;
  pageAbsoluteUrl: string;
  openGraphTitle: string;
  /** Defaults to openGraphTitle. */
  twitterTitle?: string;
  /** Used for OG when `openGraphDescription` omitted and for Twitter when `twitterDescription` omitted. */
  description?: string;
  openGraphDescription?: string;
  twitterDescription?: string;
  ogType?: 'website' | 'article';
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  const logo = buildSiteLogoOgImage(input.origin);
  const ogTitle = input.openGraphTitle;
  const twTitle = input.twitterTitle ?? input.openGraphTitle;
  const fallbackDesc =
    input.description ?? input.openGraphDescription ?? input.twitterDescription ?? ICS_SITE_DISPLAY_NAME;
  const ogDesc = input.openGraphDescription ?? input.description ?? fallbackDesc;
  const twDesc = input.twitterDescription ?? input.description ?? ogDesc;

  return {
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      url: input.pageAbsoluteUrl,
      siteName: ICS_SITE_DISPLAY_NAME,
      locale: ICS_OG_LOCALE,
      type: input.ogType ?? 'website',
      images: [logo],
    },
    twitter: {
      card: 'summary_large_image',
      title: twTitle,
      description: twDesc,
      images: [logo.url],
    },
  };
}

/** Standard metadata for static marketing/info routes (canonical + OG + Twitter + logo image). */
export function staticPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  robots?: Metadata['robots'];
  keywords?: Metadata['keywords'];
}): Metadata {
  const url = `${normalizedOrigin()}${opts.path.startsWith('/') ? opts.path : `/${opts.path}`}`;
  const base: Metadata = {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    ...openGraphTwitterFromLogo({
      origin: normalizedOrigin(),
      pageAbsoluteUrl: url,
      openGraphTitle: opts.title,
      description: opts.description,
    }),
  };
  if (opts.robots !== undefined) {
    base.robots = opts.robots;
  }
  if (opts.keywords !== undefined) {
    base.keywords = opts.keywords;
  }
  return base;
}
