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
        <div className="relative">
           {/* Shadow Layer */}
           <p className="font-black italic uppercase tracking-tighter absolute top-1 left-1 opacity-40 blur-[2px]"
             style={{ fontSize: `${fs * 3}px`, fontFamily: 'Impact, sans-serif', color: '#000', transform: 'skewX(-20deg)' }}>
             {el.text || 'BOOM!'}
           </p>
           {/* Stroke Layer */}
           <p className="font-black italic uppercase tracking-tighter"
             style={{ 
               fontSize: `${fs * 3}px`, 
               fontFamily: 'Impact, sans-serif',
               color: el.color || '#facc15',
               transform: 'skewX(-20deg)',
               WebkitTextStroke: '6px #000',
               paintOrder: 'stroke fill'
             }}>
             {el.text || 'BOOM!'}
           </p>
           {/* Inner Glow/Highlight Layer */}
           <p className="font-black italic uppercase tracking-tighter absolute inset-0"
             style={{ 
               fontSize: `${fs * 3}px`, 
               fontFamily: 'Impact, sans-serif',
               color: el.color || '#facc15',
               transform: 'skewX(-20deg)',
               WebkitTextStroke: '1.5px rgba(255,255,255,0.8)',
             }}>
             {el.text || 'BOOM!'}
           </p>
        </div>
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

  if (el.type === 'shout') {
    return (
      <div className={`absolute ${posClass} z-30 flex flex-col items-center justify-center pointer-events-auto`} style={{ ...style, minWidth: '120px' }}>
        <div className="relative group cursor-move">
          <svg viewBox="0 0 100 60" className="w-full h-auto drop-shadow-[5px_5px_0_rgba(0,0,0,1)]">
            <path 
              d="M50,4 L58,18 L75,6 L70,25 L95,15 L80,40 L98,60 L70,50 L60,85 L45,55 L20,75 L30,45 L2,60 L15,35 L2,20 L30,25 L20,5 L45,20 Z" 
              fill={el.bgColor || "#ffef00"}
              stroke="black"
              strokeWidth="2.5"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center p-4">
             <p className="text-center uppercase leading-[0.9] font-black italic"
                style={{ fontSize: `${fs * 1.2}px`, color: el.color || '#000', fontFamily: 'Impact, sans-serif', maxWidth: '70%', WebkitTextStroke: '0.5px white' }}>
                {el.text || '!!!'}
             </p>
          </div>
        </div>
      </div>
    );
  }

  if (el.type === 'thought') {
    return (
      <div className={`absolute ${posClass} z-30 flex flex-col items-center justify-center pointer-events-auto`} style={{ ...style, minWidth: '100px' }}>
        <div className="relative group cursor-move">
          <svg viewBox="0 0 100 60" className="w-full h-auto drop-shadow-[3px_3px_0_rgba(0,0,0,0.2)]">
            <path 
              d="M20,40 C10,40 5,30 15,20 C10,10 25,0 40,10 C50,0 70,0 80,10 C95,5 95,25 85,35 C95,45 80,58 60,50 C50,60 30,60 20,45" 
              fill={el.bgColor || "white"}
              stroke="black"
              strokeWidth="1.5"
            />
            <circle cx="25" cy="55" r="5" fill="white" stroke="black" strokeWidth="1" />
            <circle cx="15" cy="62" r="3" fill="white" stroke="black" strokeWidth="1" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center p-4">
             <p className="text-center uppercase leading-[1.1] font-medium italic"
                style={{ fontSize: `${fs * 0.9}px`, color: el.color || '#444', fontFamily, maxWidth: '80%' }}>
                {el.text || '...'}
             </p>
          </div>
        </div>
      </div>
    );
  }

  // Standard Speech Bubble (Dynamic Vector Tail)
  const tx = el.tailX || 0;
  const ty = el.tailY || 40;

  return (
    <div className={`absolute ${posClass} z-30 flex flex-col items-center justify-center pointer-events-auto`} style={{ ...style, minWidth: '100px' }}>
      <div className="relative group cursor-move">
        {/* THE TAIL (Organic Vector) */}
        <svg className="absolute overflow-visible pointer-events-none" style={{ 
          width: '100px', height: '100px', left: '50%', top: '50%', 
          transform: 'translate(-50%, -50%)', zIndex: -1
        }}>
           <path 
             d={`M0,0 Q${tx/2},${ty} ${tx},${ty}`} 
             fill="white" stroke="black" strokeWidth="2.5" 
           />
        </svg>

        {/* SVG BUBBLE PATH */}
        <svg viewBox="0 0 100 60" className="w-full h-auto drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
           <path 
            d="M50,1 C25,1 1,14 1,30 C1,46 25,59 50,59 C75,59 99,46 99,30 C99,14 75,1 50,1 Z" 
            fill={el.bgColor || "white"}
            stroke="black"
            strokeWidth="2"
           />
        </svg>

        {/* TEXT OVERLAY */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
           <p className="text-center uppercase font-black leading-[1.0] tracking-tight"
              style={{ fontSize: `${fs}px`, color: el.color || '#000', fontFamily, maxWidth: '85%' }}>
              {el.text || '...'}
           </p>
        </div>
      </div>
    </div>
  );
}
