'use client';

/**
 * AppPromoGridCard — a poster-sized promo tile shaped exactly like the comic cards it sits
 * among (same z-box/z-cover frame, same caption row), so it reads as one more item in the
 * shelf rather than a foreign banner. Meant to be spliced into infinite grids (browse,
 * discovery) every N items. Still honestly tagged "AD" in the same corner spot the real
 * cards use for a content-rating tag.
 */

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { APP_PROMO_URL, APP_PROMO_ICON, APP_PROMO_NAME } from './app-promo-data';

export default function AppPromoGridCard({ placement, rot = 0 }: { placement: string; rot?: number }) {
  return (
    <a
      href={APP_PROMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('promo_banner_click', { placement, app: 'evenfall', variant: 'grid-card' })}
      className="z-box z-pop group relative block overflow-hidden"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <span className="z-cover relative flex items-center justify-center bg-[#0b0b0d]">
        <span className="relative h-[52%] w-[52%] overflow-hidden rounded-[16px] border-2 border-white/15 shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
          <Image src={APP_PROMO_ICON} alt="" fill sizes="120px" className="object-cover" />
        </span>
        <span className="absolute right-2 top-2 z-tag z-tag--purple !text-[10px] !px-1.5 !py-1">AD</span>
        <span className="pointer-events-none absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full border-[2.5px] border-[var(--z-ink)] bg-[var(--z-purple)] text-white opacity-0 shadow-[2px_2px_0_var(--z-ink)] transition-opacity duration-150 group-hover:opacity-100">
          <ExternalLink size={15} strokeWidth={2.5} />
        </span>
      </span>
      <span className="flex min-h-[3.2rem] flex-col justify-center px-2.5 py-2">
        <span className="line-clamp-2 text-[13px] font-extrabold leading-[1.12] text-[var(--z-ink)]">Get {APP_PROMO_NAME}</span>
        <span className="mt-0.5 truncate text-[10px] font-bold uppercase text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>App Store</span>
      </span>
    </a>
  );
}
