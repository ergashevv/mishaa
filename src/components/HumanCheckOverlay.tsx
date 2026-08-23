'use client';

import { useEffect, useRef, useState } from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { Check, Fingerprint } from 'lucide-react';

interface HumanCheckOverlayProps {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  verifiedLabel: string;
  footnote: string;
  onConfirm: () => void;
  zIndex?: number;
}

/**
 * A gate, not a dialog: no close button, no backdrop dismiss, no Escape handler. The single
 * affordance is the confirm button — that is what "can't continue without it" means.
 *
 * Styled in the Bold Pop Zine language the live site actually wears (paper card, 2.5px ink
 * outline, hard offset shadow, Anton poster caps), NOT the older `ic-dialog` tokens, which
 * survive only inside Read Mode. The wrapper carries `.zine` so the card inherits the zine
 * font stack, blue focus ring and yellow ::selection for free; the background shorthand is
 * re-declared here so it reads as a scrim instead of the paper canvas.
 */
export default function HumanCheckOverlay({
  eyebrow,
  title,
  description,
  confirmLabel,
  verifiedLabel,
  footnote,
  onConfirm,
  zIndex = 40000,
}: HumanCheckOverlayProps) {
  /**
   * Dismissal is driven by timers this component owns, NOT by `AnimatePresence`'s
   * exit-completion callback. A gate that fails to unmount locks every visitor out of the
   * whole site, so the unmount must not depend on an animation reporting back correctly.
   */
  const [phase, setPhase] = useState<'idle' | 'confirmed' | 'leaving'>('idle');
  const confirmed = phase !== 'idle';
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Freeze the page behind the gate so it can't be scrolled or read past.
    //
    // Both elements, deliberately: the root layout gives <html> an explicit height
    // (Tailwind `h-full`), which makes <html> the scrolling element. Overflow on <body>
    // is only propagated to the viewport when the root isn't itself the scroll container,
    // so locking <body> alone leaves the page fully scrollable behind the gate.
    const root = document.documentElement;
    const { body } = document;
    const previous = {
      rootOverflow: root.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
    };
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';

    buttonRef.current?.focus();

    // Keep keyboard focus inside the gate. Without this, Tab walks into the navbar links
    // behind the scrim and a keyboard user bypasses the whole thing.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      root.style.overflow = previous.rootOverflow;
      root.style.overscrollBehavior = previous.rootOverscroll;
      body.style.overflow = previous.bodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'confirmed') return undefined;
    // Hold the confirmed state briefly: it acknowledges the tap instead of blinking away,
    // and gives the beacon a moment to leave before the component unmounts.
    const timer = window.setTimeout(() => setPhase('leaving'), 460);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    // Matches the fade duration below; the parent unmounts us when it fires.
    const timer = window.setTimeout(onConfirm, 200);
    return () => window.clearTimeout(timer);
  }, [phase, onConfirm]);

  const handleClick = () => {
    if (phase !== 'idle') return;
    setPhase('confirmed');
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'leaving' ? 0 : 1 }}
        transition={{ duration: phase === 'leaving' ? 0.2 : 0.18, ease: 'easeOut' }}
        className="zine"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          boxSizing: 'border-box',
          minHeight: '100%',
          zIndex,
          // Ink wash + the same halftone grain the paper canvas uses, inverted.
          backgroundColor: 'rgba(23, 18, 11, 0.82)',
          backgroundImage: 'radial-gradient(rgba(242, 235, 216, 0.10) 1px, transparent 1.5px)',
          backgroundSize: '7px 7px',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="human-check-title"
        aria-describedby="human-check-body"
      >
        <m.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 22, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          // Snappy with a touch of overshoot — the sticker-press physics the zine buttons use.
          transition={{ type: 'spring', stiffness: 430, damping: 26, mass: 0.8 }}
          style={{
            width: '100%',
            maxWidth: 428,
            padding: '34px 28px 26px',
            textAlign: 'center',
            background: 'var(--z-card)',
            color: 'var(--z-ink)',
            border: 'var(--z-b) solid var(--z-ink)',
            borderRadius: 'var(--z-radius)',
            boxShadow: 'var(--z-sh-lg)',
            boxSizing: 'border-box',
          }}
        >
          {/* Tilted sticker — the zine idiom, used where a tilt can't hurt legibility. */}
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 62,
              height: 62,
              marginBottom: 18,
              background: 'var(--z-yellow)',
              color: 'var(--z-ink)',
              border: 'var(--z-b) solid var(--z-ink)',
              borderRadius: 'var(--z-radius)',
              boxShadow: 'var(--z-sh-sm)',
              transform: 'rotate(-4deg)',
            }}
          >
            <Fingerprint size={30} strokeWidth={2.25} />
          </span>

          <div
            className="z-kicker"
            style={{ color: 'var(--z-ink-2)', marginBottom: 10 }}
          >
            {eyebrow}
          </div>

          <h2
            id="human-check-title"
            className="z-display"
            style={{ fontSize: 'clamp(34px, 8vw, 44px)', margin: '0 0 14px' }}
          >
            {title}
          </h2>

          <p
            id="human-check-body"
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.55,
              color: 'var(--z-ink-2)',
              maxWidth: '34ch',
              marginInline: 'auto',
            }}
          >
            {description}
          </p>

          <button
            ref={buttonRef}
            type="button"
            onClick={handleClick}
            aria-live="polite"
            className={`z-btn ${confirmed ? 'z-btn--green' : 'z-btn--red'}`}
            style={{ width: '100%', marginTop: 24, fontSize: 16, padding: '15px 20px' }}
          >
            {confirmed ? <Check size={19} strokeWidth={3} aria-hidden /> : null}
            {confirmed ? verifiedLabel : confirmLabel}
          </button>

          <p
            className="z-kicker"
            style={{ margin: '18px 0 0', fontSize: 10.5, color: 'var(--z-ink-2)', opacity: 0.7 }}
          >
            {footnote}
          </p>
        </m.div>
      </m.div>
    </LazyMotion>
  );
}
