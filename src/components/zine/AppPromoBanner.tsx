'use client';

/**
 * AppPromoBanner — a sponsored App Store cross-promo card, built natively in the Bold Pop
 * Zine language (z-box sticker card, hard ink shadow, poster caps) so it reads as part of
 * the site rather than a bolted-on ad unit. Honestly labeled "AD" — no disguising it as
 * editorial content. One shared component, dropped into the three highest-traffic surfaces
 * (browse, series detail, home) so the accent color and copy stay identical everywhere.
 */

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

const APP_STORE_URL = 'https://apps.apple.com/uz/app/evenfall-movie-night-picker/id6794722280';

export default function AppPromoBanner({ placement }: { placement: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('promo_banner_click', { placement, app: 'evenfall' })}
      className="z-box z-pop group block -rotate-1 p-4 transition-transform hover:rotate-0 sm:p-5"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border-[2.5px] border-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)] sm:h-20 sm:w-20">
          <Image src="/promo/evenfall-icon.jpg" alt="" fill sizes="80px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="z-tag z-tag--purple mb-1.5 inline-block -rotate-2 !text-[10px]">AD · APP OF THE WEEK</span>
          <h3 className="z-display text-[1.25rem] leading-[0.9] sm:text-[1.6rem]">Stuck picking a movie tonight?</h3>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-[var(--z-ink-2)] sm:text-[14px]">
            Evenfall picks one film you can actually stream, in seconds. Free on the App Store.
          </p>
        </div>
        {/* `.z-btn` sets its own `display` outside any @layer, which beats Tailwind's
            layered `hidden`/`sm:*` utilities. Put the responsive show/hide on a plain
            wrapper instead of on the `.z-btn` element itself. */}
        <span className="hidden shrink-0 sm:block">
          <span className="z-btn z-btn--purple z-btn--sm inline-flex items-center gap-1.5">
            Get the app <ExternalLink size={14} strokeWidth={3} />
          </span>
        </span>
      </div>
      <span className="mt-4 block sm:hidden">
        <span className="z-btn z-btn--purple z-btn--sm flex w-full items-center justify-center gap-1.5">
          Get the app <ExternalLink size={14} strokeWidth={3} />
        </span>
      </span>
    </a>
  );
}
