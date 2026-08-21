'use client';

/**
 * AppPromoReaderStrip — the reader route runs a different, older visual system (READER_THEMES:
 * dark/light/sepia panel tokens, not the Bold Pop Zine `.z-*` classes the rest of the site
 * uses), so this variant is styled entirely from those theme tokens instead. Meant only for
 * the chapter-end pause point (after the last page, before "Go to next chapter") — never
 * mid-page, so it doesn't interrupt the actual reading canvas.
 */

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { APP_PROMO_URL, APP_PROMO_ICON, APP_PROMO_HEADLINE, APP_PROMO_BODY_SHORT } from './app-promo-data';

type ReaderThemeColors = {
  panelBg: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
};

export default function AppPromoReaderStrip({ placement, theme }: { placement: string; theme: ReaderThemeColors }) {
  return (
    <a
      href={APP_PROMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('promo_banner_click', { placement, app: 'evenfall', variant: 'reader-strip' })}
      className="flex w-full items-center gap-3 rounded-card border px-4 py-3.5 transition-transform hover:-translate-y-0.5"
      style={{ backgroundColor: theme.panelBg, borderColor: theme.border }}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px]" style={{ border: `1px solid ${theme.border}` }}>
        <Image src={APP_PROMO_ICON} alt="" fill sizes="40px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: theme.muted }}>Ad</div>
        <div className="truncate text-[13px] font-semibold" style={{ color: theme.text }}>{APP_PROMO_HEADLINE}</div>
        <div className="hidden truncate text-[12px] sm:block" style={{ color: theme.muted }}>{APP_PROMO_BODY_SHORT}</div>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-btn px-3 py-2 text-[12px] font-semibold"
        style={{ backgroundColor: theme.accent, color: theme.onAccent }}
      >
        Get app <ExternalLink size={12} strokeWidth={2.5} />
      </span>
    </a>
  );
}
