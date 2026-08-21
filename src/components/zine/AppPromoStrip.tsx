'use client';

/**
 * AppPromoStrip — the compact, single-line sibling of AppPromoBanner. Same sticker-card
 * language, a fraction of the height, so it fits inside tight spots (footer, auth page,
 * the reading shelf) without competing with the page's real content. Always rendered on
 * its own cream `.z-box` card so it reads clearly regardless of the surface behind it
 * (the footer is dark ink, everywhere else is paper).
 */

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { APP_PROMO_URL, APP_PROMO_ICON, APP_PROMO_HEADLINE, APP_PROMO_BODY_SHORT } from './app-promo-data';

export default function AppPromoStrip({ placement }: { placement: string }) {
  return (
    <a
      href={APP_PROMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('promo_banner_click', { placement, app: 'evenfall', variant: 'strip' })}
      className="z-box z-pop group flex items-center gap-3 p-3 transition-transform hover:-translate-y-0.5"
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] border-2 border-[var(--z-ink)] sm:h-12 sm:w-12">
        <Image src={APP_PROMO_ICON} alt="" fill sizes="48px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="z-tag z-tag--purple !text-[9px] !px-1.5 !py-0.5">AD</span>
        <span className="ml-2 text-[13px] font-extrabold leading-tight text-[var(--z-ink)]">{APP_PROMO_HEADLINE}</span>
        <span className="hidden text-[12px] font-semibold text-[var(--z-ink-2)] sm:inline"> {APP_PROMO_BODY_SHORT}</span>
      </div>
      <span className="hidden shrink-0 sm:block">
        <span className="z-btn z-btn--purple z-btn--sm inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-[11px]">
          Get the app <ExternalLink size={12} strokeWidth={3} />
        </span>
      </span>
      <span className="shrink-0 sm:hidden">
        <ExternalLink size={16} strokeWidth={2.5} className="text-[var(--z-ink-2)]" />
      </span>
    </a>
  );
}
