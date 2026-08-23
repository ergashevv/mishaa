'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import HumanCheckOverlay from './HumanCheckOverlay';
import {
  getVisitorId,
  hasVerifiedBefore,
  persistHumanVerification,
  readHumanVerification,
  reportHumanVerification,
  shouldSkipHumanCheck,
} from '@/lib/human-check/client';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

/** The dashboard reads this log; gating it would lock us out of our own numbers. */
const EXEMPT_PREFIXES = ['/admin'];

export default function HumanCheckGate() {
  const pathname = usePathname();
  const [showGate, setShowGate] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const shownAtRef = useRef(0);
  const repeatRef = useRef(false);

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (event: Event) => {
      const nextLang = (event as CustomEvent<Lang>).detail;
      if (translations[nextLang]) setLang(nextLang);
    };

    window.addEventListener('langChange', handleLang as EventListener);
    return () => window.removeEventListener('langChange', handleLang as EventListener);
  }, []);

  useEffect(() => {
    if (EXEMPT_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return;
    if (shouldSkipHumanCheck()) return;
    if (readHumanVerification()) return;

    repeatRef.current = hasVerifiedBefore();
    shownAtRef.current = Date.now();
    setShowGate(true);
    // Runs once per mount, not on every client-side navigation: a reader who confirmed on the
    // homepage must not be re-gated when they open a chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = useCallback(() => {
    persistHumanVerification();
    reportHumanVerification({
      visitorId: getVisitorId(),
      decidedMs: shownAtRef.current ? Date.now() - shownAtRef.current : 0,
      repeatVisit: repeatRef.current,
    });
    setShowGate(false);
  }, []);

  const copy = translations[lang]?.humanCheck ?? translations.en.humanCheck;

  return (
    <>
      {showGate && (
        <HumanCheckOverlay
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirmLabel}
          verifiedLabel={copy.verifiedLabel}
          footnote={copy.footnote}
          onConfirm={handleConfirm}
          // Above the 18+ age gate (30000) so the human check is always the first thing asked.
          zIndex={40000}
        />
      )}
    </>
  );
}
