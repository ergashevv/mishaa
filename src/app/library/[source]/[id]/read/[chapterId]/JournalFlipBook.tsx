'use client';

/**
 * JournalFlipBook — real Apple-Books-style page turn for the reader's Journal mode, powered by
 * react-pageflip (StPageFlip): soft paper curl, corner drag, dynamic shadows, spread on wide
 * screens / single page on phones. The reader owns paging state; this just renders + flips and
 * reports the current page back via onFlip. Reading engine (progress, chapters) is unchanged.
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import HTMLFlipBook from 'react-pageflip';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type FlipApi = {
  next: () => void;
  prev: () => void;
  turnTo: (page: number) => void;
  current: () => number;
  atEnd: () => boolean;
  atStart: () => boolean;
};

type Props = {
  pages: string[];
  startPage: number;
  border: string;
  shellBg: string;
  onFlip: (pageIndex: number) => void;
};

const JournalFlipBook = forwardRef<FlipApi, Props>(function JournalFlipBook(
  { pages, startPage, border, shellBg, onFlip },
  ref,
) {
  const bookRef = useRef<any>(null);
  const pf = () => bookRef.current?.pageFlip?.();

  useImperativeHandle(ref, () => ({
    next: () => { try { pf()?.flipNext(); } catch { /* not ready */ } },
    prev: () => { try { pf()?.flipPrev(); } catch { /* not ready */ } },
    turnTo: (page: number) => { try { pf()?.turnToPage(page); } catch { /* not ready */ } },
    current: () => { try { return pf()?.getCurrentPageIndex?.() ?? 0; } catch { return 0; } },
    atEnd: () => {
      try {
        const p = pf();
        if (!p) return false;
        const total = p.getPageCount?.() ?? pages.length;
        const cur = p.getCurrentPageIndex?.() ?? 0;
        const portrait = p.getOrientation?.() === 'portrait';
        return cur >= total - (portrait ? 1 : 2);
      } catch { return false; }
    },
    atStart: () => { try { return (pf()?.getCurrentPageIndex?.() ?? 0) <= 0; } catch { return true; } },
  }), [pages.length]);

  return (
    <div className="flex w-full items-center justify-center overflow-hidden" style={{ height: 'calc(100dvh - 7.5rem)', marginTop: 'env(safe-area-inset-top,0px)' }}>
      <HTMLFlipBook
        ref={bookRef as any}
        width={520}
        height={780}
        size="stretch"
        minWidth={280}
        maxWidth={760}
        minHeight={400}
        maxHeight={1200}
        maxShadowOpacity={0.55}
        showCover={true}
        drawShadow={true}
        flippingTime={800}
        usePortrait={true}
        mobileScrollSupport={false}
        clickEventForward={true}
        useMouseEvents={true}
        swipeDistance={24}
        startPage={startPage}
        showPageCorners={true}
        disableFlipByClick={false}
        onFlip={(e: any) => onFlip(e?.data ?? 0)}
        className="ic-flipbook"
        style={{}}
      >
        {pages.map((src, i) => (
          <div key={i} className="ic-flip-page" style={{ background: shellBg }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Page ${i + 1}`}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: shellBg, border: `1px solid ${border}` }}
            />
          </div>
        ))}
      </HTMLFlipBook>
    </div>
  );
});

export default JournalFlipBook;
