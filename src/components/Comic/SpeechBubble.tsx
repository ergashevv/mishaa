import React from 'react';
import { TextElement } from '@/types/comic';
import { POSITIONS } from '@/constants/comic';

export function SpeechBubble({ el }: { el: TextElement }) {
  const fs = el.fontSize || 12;
  const rot = el.rotation || 0;
  const fontFamily = el.fontFamily || 'Comic Neue, cursive'; // Using a web-safe comic-ish font for now
  const posClass = el.position ? (POSITIONS[el.position] || 'top-4 left-4') : '';
  const style: React.CSSProperties = {
    transform: `rotate(${rot}deg)`,
    top: el.y !== undefined ? `${el.y}%` : undefined,
    left: el.x !== undefined ? `${el.x}%` : undefined,
    position: (el.x !== undefined || el.y !== undefined) ? 'absolute' : undefined
  };

  if (el.type === 'sfx') {
    return (
      <div className={`absolute ${posClass} z-30 pointer-events-none select-none`} style={style}>
        <p className="font-black italic uppercase tracking-tighter filter drop-shadow-[4px_4px_0_#000]"
          style={{ 
            fontSize: `${fs * 2.5}px`, 
            fontFamily,
            color: el.color || '#facc15',
            transform: 'skewX(-15deg)',
            WebkitTextStroke: '2px #000'
          }}>
          {el.text || 'BOOM!'}
        </p>
      </div>
    );
  }

  if (el.type === 'caption') {
    return (
      <div className={`absolute z-20 border-2 border-black ${!el.x && 'left-1/2 -translate-x-1/2 top-4'}`}
        style={{ 
          ...style,
          background: el.bgColor || '#ffed00', 
          boxShadow: '4px 4px 0 rgba(0,0,0,1)' 
        }}>
        <p className="uppercase leading-tight font-bold text-center"
          style={{ fontSize: `${fs}px`, color: el.color || '#000', fontFamily }}>
          {el.text || '...'}
        </p>
      </div>
    );
  }

  // Standard Speech Bubble (SVG for perfect Oval)
  return (
    <div className={`absolute ${posClass} z-30 flex flex-col items-center justify-center pointer-events-auto`} style={{ ...style, minWidth: '100px' }}>
      <div className="relative group cursor-move">
        {/* SVG BUBBLE PATH */}
        <svg viewBox="0 0 100 60" className="w-full h-auto drop-shadow-[3px_3px_0_rgba(0,0,0,1)]">
           <path 
            d="M50,1 C25,1 1,14 1,30 C1,46 25,59 50,59 C58,59 66,58 73,55 L85,63 L82,51 C93,46 100,38 100,30 C100,14 75,1 50,1 Z" 
            fill={el.bgColor || "white"}
            stroke="black"
            strokeWidth="1.5"
           />
        </svg>

        {/* TEXT OVERLAY */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
           <p className="text-center uppercase leading-[1.1] font-bold"
              style={{ fontSize: `${fs}px`, color: el.color || '#000', fontFamily, maxWidth: '80%' }}>
              {el.text || '...'}
           </p>
        </div>
      </div>
    </div>
  );
}
