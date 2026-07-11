'use client';

import { useId } from 'react';
import { Loader2 } from 'lucide-react';

type LoadingTone = 'app' | 'library' | 'reader' | 'comic-detail';

/**
 * Zine loading shell — a paper canvas with a bold Anton "LOADING" + a red sticker caption.
 * The reader tone stays on the dark reading canvas. Announces `label` via aria-live.
 */
export default function LoadingRouteShell(props: {
  label: string;
  tone?: LoadingTone;
  spinnerClassName?: string;
}) {
  const { label, tone = 'app', spinnerClassName = 'h-11 w-11' } = props;
  const nid = useId();
  const textId = `${nid}-route-loading-msg`;
  const dark = tone === 'reader';
  const ink = dark ? '#E9E5EE' : 'var(--z-ink)';

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4"
      style={
        dark
          ? { background: '#0C0B10', color: ink }
          : {
              background: 'var(--z-paper)',
              color: ink,
              backgroundImage: 'radial-gradient(rgba(23,18,11,0.055) 1px, transparent 1.5px)',
              backgroundSize: '7px 7px',
            }
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby={textId}
    >
      <Loader2 className={`${spinnerClassName} animate-spin`} style={{ color: '#FF2D55' }} strokeWidth={2.5} aria-hidden />
      <span className="uppercase leading-[0.82]" style={{ fontFamily: 'var(--font-anton), Impact, sans-serif', fontSize: 'clamp(2rem,7vw,3.4rem)', color: ink }}>
        Loading
      </span>
      <span
        id={textId}
        className="inline-block -rotate-1 border-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ fontFamily: 'var(--font-space-mono), monospace', borderColor: ink, background: '#FF2D55', color: '#fff', boxShadow: `3px 3px 0 ${ink}` }}
      >
        {label}
      </span>
    </div>
  );
}
