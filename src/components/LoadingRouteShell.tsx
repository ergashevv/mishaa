'use client';

import { useId } from 'react';
import { Loader2 } from 'lucide-react';

type LoadingTone = 'app' | 'library' | 'reader' | 'comic-detail';

const outerByTone: Record<LoadingTone, string> = {
  app: 'min-h-dvh justify-center bg-zinc-50 dark:bg-black',
  library:
    'min-h-screen justify-center bg-zinc-50 font-black uppercase tracking-[0.5em] text-neutral-300 dark:bg-black dark:text-white/20',
  reader: 'min-h-screen justify-center bg-zinc-50 dark:bg-[#020202]',
  'comic-detail': 'min-h-screen justify-center bg-zinc-50 dark:bg-[#05060a]',
};

/**
 * Accessible loading shell: announces `label` via `aria-live`; spinner is purely decorative (`aria-hidden`).
 */
export default function LoadingRouteShell(props: {
  label: string;
  tone?: LoadingTone;
  spinnerClassName?: string;
}) {
  const { label, tone = 'app', spinnerClassName = 'h-11 w-11' } = props;
  const nid = useId();
  const textId = `${nid}-route-loading-msg`;

  const captionClasses =
    tone === 'library'
      ? ''
      : tone === 'reader'
        ? 'max-w-[min(92vw,28rem)] text-center text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-400 dark:text-white/20'
        : tone === 'comic-detail'
          ? 'max-w-[min(92vw,28rem)] text-center text-[10px] font-bold uppercase tracking-[0.45em] text-neutral-400 dark:text-white/25'
          : 'text-center text-[10px] font-black uppercase tracking-[0.45em] text-neutral-400 dark:text-white/30';

  return (
    <div
      className={`flex flex-col items-center px-4 py-14 sm:py-16 ${outerByTone[tone]}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby={textId}
    >
      <div className="flex flex-col items-center gap-4 sm:gap-6">
        <Loader2
          className={`${spinnerClassName} shrink-0 animate-spin text-[#ff4d00]`}
          aria-hidden
        />
        <p id={textId} className={captionClasses}>
          {label}
        </p>
      </div>
    </div>
  );
}
