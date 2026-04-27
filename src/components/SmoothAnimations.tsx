'use client';

import { useEffect, useRef } from 'react';

type DepthLayer = {
  element: HTMLElement;
  baseTransform: string;
  depth: number;
};

type TiltCard = {
  element: HTMLElement;
  baseTransform: string;
  currentRotateX: number;
  currentRotateY: number;
};

const FINE_POINTER_QUERY = '(pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const LERP_FACTOR = 0.08; 

const getBaseTransform = (element: HTMLElement) => {
  if (!Object.hasOwn(element.dataset, 'baseTransform')) {
    element.dataset.baseTransform = element.style.transform || '';
  }
  return element.dataset.baseTransform ?? '';
};

const appendTransform = (baseTransform: string, motionTransform: string) => {
  return [baseTransform, motionTransform].filter(Boolean).join(' ');
};

export default function SmoothAnimations() {
  const animationFrameRef = useRef<number | null>(null);
  const depthLayersRef = useRef<DepthLayer[]>([]);
  const tiltCardsRef = useRef<TiltCard[]>([]);
  
  const mouseRef = useRef({
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  });

  const easedRef = useRef({
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
    active: false
  });

  useEffect(() => {
    const finePointer = window.matchMedia(FINE_POINTER_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const root = document.documentElement;

    const collectAnimatedElements = () => {
      depthLayersRef.current = Array.from(document.querySelectorAll<HTMLElement>('[data-depth]')).map(
        (element) => ({
          element,
          baseTransform: getBaseTransform(element),
          depth: Number(element.dataset.depth || 20),
        })
      );

      tiltCardsRef.current = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt-card]')).map(
        (element) => ({
          element,
          baseTransform: getBaseTransform(element),
          currentRotateX: 0,
          currentRotateY: 0
        })
      );
    };

    const resetTransforms = () => {
      depthLayersRef.current.forEach(({ element, baseTransform }) => {
        element.style.transform = baseTransform;
      });

      tiltCardsRef.current.forEach(({ element, baseTransform }) => {
        element.style.transform = baseTransform;
      });
    };

    const updateVisuals = () => {
      const { x, y } = easedRef.current;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      
      root.style.setProperty('--mouse-x', `${x}px`);
      root.style.setProperty('--mouse-y', `${y}px`);

      if (!finePointer.matches || reducedMotion.matches) {
        resetTransforms();
        return;
      }

      const globalMoveX = (x / winW - 0.5); 
      const globalMoveY = (y / winH - 0.5);

      depthLayersRef.current.forEach(({ element, baseTransform, depth }) => {
        const moveX = globalMoveX * depth;
        const moveY = globalMoveY * depth;
        const rotateX = globalMoveY * -4;
        const rotateY = globalMoveX * 4;

        element.style.transform = appendTransform(
          baseTransform,
          `translate3d(${moveX}px, ${moveY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
        );
      });

      tiltCardsRef.current.forEach((card) => {
        const { element, baseTransform } = card;
        const rect = element.getBoundingClientRect();
        const padding = 60;
        const isNearby =
          x >= rect.left - padding &&
          x <= rect.right + padding &&
          y >= rect.top - padding &&
          y <= rect.bottom + padding;

        let targetX = 0;
        let targetY = 0;
        let targetScale = 1;
        let targetZ = 0;

        if (isNearby) {
          const xPercent = (x - rect.left) / rect.width - 0.5;
          const yPercent = (y - rect.top) / rect.height - 0.5;
          targetX = yPercent * -14;
          targetY = xPercent * 14;
          targetScale = 1.02;
          targetZ = 20;
        }

        // Use internal LERP for the specific card rotation to prevent feedback jumps
        card.currentRotateX += (targetX - card.currentRotateX) * 0.15;
        card.currentRotateY += (targetY - card.currentRotateY) * 0.15;

        if (Math.abs(card.currentRotateX) < 0.01 && Math.abs(card.currentRotateY) < 0.01 && !isNearby) {
            element.style.transform = baseTransform;
        } else {
            element.style.transform = appendTransform(
              baseTransform,
              `rotateX(${card.currentRotateX}deg) rotateY(${card.currentRotateY}deg) translateZ(${targetZ}px) scale(${targetScale})`
            );
        }
      });
    };

    const tick = () => {
      const dx = mouseRef.current.x - easedRef.current.x;
      const dy = mouseRef.current.y - easedRef.current.y;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || tiltCardsRef.current.length > 0) {
        easedRef.current.x += dx * LERP_FACTOR;
        easedRef.current.y += dy * LERP_FACTOR;
        updateVisuals();
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    const handlePointerMove = (event: PointerEvent) => {
      mouseRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      
      if (!easedRef.current.active) {
        easedRef.current.active = true;
        animationFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const handlePointerLeave = () => {
      resetTransforms();
    };

    const handleResize = () => {
      collectAnimatedElements();
    };

    const mutationObserver = new MutationObserver(() => {
      collectAnimatedElements();
    });

    collectAnimatedElements();
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    updateVisuals();

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      mutationObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        <div className="ambient-mouse-light absolute top-[var(--mouse-y)] left-[var(--mouse-x)] w-[620px] h-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>
    </>
  );
}
