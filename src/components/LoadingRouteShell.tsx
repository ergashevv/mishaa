'use client';

import { useId } from 'react';
import { Loader2 } from 'lucide-react';

type LoadingTone = 'app' | 'library' | 'reader' | 'comic-detail';

const outerByTone: Record<LoadingTone, string> = {
  app: 'min-h-dvh justify-center bg-app',
  library: 'min-h-dvh justify-center bg-app',
  reader: 'min-h-dvh justify-center bg-app',
  'comic-detail': 'min-h-dvh justify-center bg-app',
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

  const captionClasses = 'ic-eyebrow max-w-[min(92vw,28rem)] text-center';

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
          className={`${spinnerClassName} shrink-0 animate-spin text-accent`}
          aria-hidden
        />
        <p id={textId} className={captionClasses}>
          {label}
        </p>
      </div>
    </div>
  );
}
