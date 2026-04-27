'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PRINT_STANDARDS } from '@/constants/comic';

interface ProfessionalCanvasProps {
  children: React.ReactNode;
  settings: {
    format: typeof PRINT_STANDARDS[0];
    dpi: number;
    showGuides: boolean;
    showBleed: boolean;
    showRulers: boolean;
    showFlow: boolean;
  };
  isPreview?: boolean;
}

export function ProfessionalCanvas({ children, settings, isPreview }: ProfessionalCanvasProps) {
  const { format, dpi, showGuides, showBleed, showFlow } = settings;

  // Scale for web display
  const scale = 3.5; 
  const boardWidth = format.width * scale;
  const boardHeight = format.height * scale;
  const bleedPx = format.bleed * scale;
  const safePx = format.safeArea * scale;

  return (
    <div className="relative flex flex-col items-center group/canvas">
      
      {/* RULERS SYSTEM (Refining for professional look) */}
      {settings.showRulers && (
        <>
          {/* Horizontal Ruler */}
          <div className="absolute inset-x-0 -top-12 h-8 flex border-b border-white/10 pointer-events-none">
            {Array.from({ length: Math.ceil(format.width / 10) + 1 }).map((_, i) => (
              <div key={i} className="relative flex-1 border-l border-white/5 h-full">
                {i % 5 === 0 && (
                  <span className="absolute -top-4 left-1 text-[7px] font-mono text-white/20 uppercase tracking-tighter">{i * 10}MM</span>
                )}
                <div className={`absolute bottom-0 left-0 w-[1px] bg-white/10 ${i % 5 === 0 ? 'h-4' : 'h-2'}`} />
              </div>
            ))}
          </div>
          {/* Vertical Ruler */}
          <div className="absolute top-0 -left-12 w-8 bottom-0 flex flex-col border-r border-white/10 pointer-events-none">
            {Array.from({ length: Math.ceil(format.height / 10) + 1 }).map((_, i) => (
              <div key={i} className="relative flex-1 border-t border-white/5 w-full">
                {i % 5 === 0 && (
                  <span className="absolute left-[-45px] top-1 text-[7px] font-mono text-white/20 uppercase tracking-tighter -rotate-90">{i * 10}MM</span>
                )}
                <div className={`absolute top-0 right-0 h-[1px] bg-white/10 ${i % 5 === 0 ? 'w-4' : 'w-2'}`} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* THE PHYSICAL BOARD */}
      <div 
        className="relative bg-white shadow-[0_40px_120px_rgba(0,0,0,0.9)] transition-all duration-700 ease-out preserve-3d"
        style={{ 
          width: boardWidth, 
          height: boardHeight,
        }}
      >
        {/* CLEANER GRID (Less Distracting) */}
        <div className="absolute -inset-20 bg-[#0c0c0c] -z-10 rounded-[2.5rem] border border-white/5 flex items-center justify-center overflow-hidden">
           <div className="absolute inset-0" style={{ 
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
           }} />
        </div>

        {/* PAPER TEXTURE OVERLAY */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.02]" style={{
           backgroundImage: 'url("https://www.transparenttextures.com/patterns/p6.png")'
        }} />

        {/* BLEED AREA GUIDE */}
        {showBleed && (
          <div 
            className="absolute inset-0 border-[1px] border-dashed border-rose-500/50 pointer-events-none z-50 animate-pulse"
            style={{ margin: -bleedPx }}
          />
        )}

        {/* CROP MARKS / TRIM AREA (Professional technical marks) */}
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
           {/* Corner Trim Marks */}
           {[-1, 1].map(x => [-1, 1].map(y => (
             <div key={`${x}-${y}`} className="absolute w-8 h-8" style={{ 
               top: y === -1 ? 0 : 'auto', 
               bottom: y === 1 ? 0 : 'auto',
               left: x === -1 ? 0 : 'auto', 
               right: x === 1 ? 0 : 'auto'
             }}>
               <div className={`w-full h-[1px] bg-cyan-500/30 absolute ${y === -1 ? 'top-0' : 'bottom-0'}`} />
               <div className={`h-full w-[1px] bg-cyan-500/30 absolute ${x === -1 ? 'left-0' : 'right-0'}`} />
             </div>
           )))}
        </div>

        {/* SAFE AREA GUIDE */}
        {showGuides && (
          <div 
            className="absolute pointer-events-none z-40 border border-blue-500/20"
            style={{ 
              top: safePx, 
              left: safePx, 
              right: safePx, 
              bottom: safePx 
            }}
          >
             <div className="absolute top-1 left-2 text-[8px] text-blue-500/40 uppercase font-bold tracking-widest bg-blue-500/5 px-2 py-0.5 rounded">Safe_Zone_Active</div>
             {/* Technical crosshair in center of safe zone */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-blue-500/10">
                <div className="absolute top-1/2 inset-x-0 h-[1px] bg-blue-500/20" />
                <div className="absolute left-1/2 inset-y-0 w-[1px] bg-blue-500/20" />
             </div>
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="relative w-full h-full overflow-hidden z-10">
          {children}
        </div>

        {/* READING FLOW GUIDE (Cinematic Paths) */}
        {showFlow && (
          <svg className="absolute inset-0 pointer-events-none z-[100] opacity-60">
             <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                   <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent)" />
                </marker>
             </defs>
             <path 
                d={`M ${safePx + 40} ${safePx + 40} C ${boardWidth/2} ${safePx}, ${boardWidth/2} ${boardHeight/2}, ${boardWidth - safePx - 40} ${safePx + 40} S ${boardWidth/2} ${boardHeight}, ${boardWidth - safePx - 40} ${boardHeight - safePx - 40}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="8,8"
                markerEnd="url(#arrowhead)"
                className="animate-[dash_20s_linear_infinite]"
             />
             <text x={safePx + 50} y={safePx + 30} fill="var(--accent)" className="text-[10px] font-black italic tracking-widest uppercase">Visual_Entry</text>
          </svg>
        )}

        {/* TECHNICAL METADATA OVERLAY (Hidden in Preview) */}
        {!isPreview && (
          <div className="absolute -bottom-20 left-0 flex justify-between w-full p-4 border-t-2 border-white/5 bg-black/40 backdrop-blur-md rounded-b-3xl">
             <div className="flex gap-8">
                <div className="flex flex-col gap-1">
                   <span className="text-[7px] text-white/20 font-black uppercase tracking-[0.2em]">Technical_Format</span>
                   <span className="text-[10px] text-[var(--accent)] font-black italic">{format.label} // {format.width}x{format.height}MM</span>
                </div>
                <div className="flex flex-col border-l border-white/5 pl-8 gap-1">
                   <span className="text-[7px] text-white/20 font-black uppercase tracking-[0.2em]">Foundry_Res</span>
                   <span className="text-[10px] text-white/60 font-black tracking-widest">{dpi} DPI // CMYK:FOUNDRY_PRO</span>
                </div>
             </div>
             <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[8px] font-black text-green-500/80 uppercase tracking-widest">Live_Calibration_OK</span>
                </div>
                <span className="text-[7px] text-white/10 font-bold uppercase tracking-widest">Studio_Admin_Verified</span>
             </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -200;
          }
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
      `}</style>
    </div>
  );
}
