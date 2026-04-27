import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Copy, MoreVertical, Maximize2, Zap, Layout, Move, Plus } from 'lucide-react';
import { Panel } from '@/types/comic';
import { SpeechBubble } from './SpeechBubble';

interface PanelCardProps {
  panel: Panel;
  index: number;
  isSelected: boolean;
  t: (key: string) => string;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddAfter: () => void;
  onAddText: (panelId: string, x: number, y: number) => void;
  onResize: (updates: any) => void;
  cursorMode?: 'move' | 'text' | 'hand';
  onMoveLeft: () => void;
  onMoveRight: () => void;
  colSpan: number;
  height: string;
  isPreview?: boolean;
  pageHeight?: number;
}

export function PanelCard({
  panel, index, isSelected, onClick, onDelete, onDuplicate, onAddAfter, onAddText, onResize, onMoveLeft, onMoveRight, colSpan, height, t, isPreview, pageHeight = 1000, cursorMode
}: PanelCardProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeStart = React.useRef({ x: 0, y: 0, w: 0, h: 0, col: 0 });

  const finalColSpan = panel.colSpan || colSpan;
  const isForge = !isPreview;

  const handleResizeStart = (e: React.MouseEvent, type: 'h' | 'v' | 'both') => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    resizeStart.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, col: finalColSpan };

    const handleMouseMove = (moveEvent: MouseEvent) => {
       const dX = moveEvent.clientX - resizeStart.current.x;
       const dY = moveEvent.clientY - resizeStart.current.y;
       
       if (type === 'v' || type === 'both') {
          let newH = Math.max(150, resizeStart.current.h + dY);
          if (pageHeight && Math.abs(newH - pageHeight) < 60) newH = pageHeight;
          onResize({ customHeight: `${newH}px` });
       }
       
       if (type === 'h' || type === 'both') {
          const colW = resizeStart.current.w / resizeStart.current.col;
          const colDelta = Math.round(dX / colW);
          const newCol = Math.max(3, Math.min(12, resizeStart.current.col + colDelta));
          onResize({ colSpan: newCol });
       }
    };

    const handleMouseUp = () => {
       setIsResizing(false);
       window.removeEventListener('mousemove', handleMouseMove);
       window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <motion.div
      onClick={(e) => {
        if (cursorMode === 'text') {
           const rect = e.currentTarget.getBoundingClientRect();
           const x = ((e.clientX - rect.left) / rect.width) * 100;
           const y = ((e.clientY - rect.top) / rect.height) * 100;
           onAddText(panel.id, x, y);
        } else {
           onClick();
        }
      }}
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group transition-all duration-500 overflow-visible flex flex-col ${
        isForge 
          ? `${isSelected ? 'z-50' : 'z-10'}`
          : 'rounded-none border-none'
      }`}
      style={{ 
        gridColumn: `span ${finalColSpan}`, 
        gridRowEnd: `span ${Math.ceil(parseInt(panel.customHeight || height) / 4)}`,
        height: panel.customHeight || height,
      }}
    >
      <div className={`relative w-full h-full overflow-hidden transition-all duration-700 ${
        isForge 
          ? `rounded-2xl border-2 ${isSelected ? 'border-[var(--accent)] shadow-[0_0_40px_rgba(255,77,0,0.2)] bg-black/40' : 'border-white/5 hover:border-white/20 bg-black/20'}`
          : 'rounded-none border-none bg-black'
      }`}>
        
        {panel.image ? (
          <div className="relative w-full h-full group/img overflow-hidden">
             <img src={panel.image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Scene" />
             {isForge && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-40" />}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0a0a0a] relative">
             <Layout className="text-white/5 group-hover:text-[var(--accent)]/20 transition-all duration-700" size={48} />
             {isForge && (
                <div className="flex flex-col items-center gap-1 opacity-20 group-hover:opacity-100 transition-all">
                   <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Grid_Phase_{index + 1}</span>
                   <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Awaiting_Forge_Input</span>
                </div>
             )}
          </div>
        )}

        {panel.status === 'loading' && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center gap-4 z-[100]">
             <div className="w-10 h-10 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin shadow-[0_0_20px_rgba(255,77,0,0.5)]" />
             <span className="text-[8px] font-black text-white uppercase tracking-[0.4em] animate-pulse">Forging_Art...</span>
          </div>
        )}

        {isForge && (
          <div className="absolute bottom-4 left-5 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
             <div className="px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-2">
                <span className="text-[8px] font-black text-[var(--accent)] uppercase">{finalColSpan}U</span>
                <div className="w-[1px] h-2 bg-white/10" />
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{panel.customHeight || height}</span>
             </div>
          </div>
        )}

        {isForge && isSelected && (
          <div className="absolute top-4 right-4 flex items-center gap-2 z-[60]">
             <div className="flex bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl">
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Duplicate">
                   <Copy size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-8 h-8 flex items-center justify-center text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all" title="Delete">
                   <Trash2 size={14} />
                </button>
             </div>
          </div>
        )}

        {isForge && isSelected && (
          <>
            <div onMouseDown={(e) => handleResizeStart(e, 'h')} className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize hover:bg-[var(--accent)]/60 transition-colors z-[120]" />
            <div onMouseDown={(e) => handleResizeStart(e, 'v')} className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize hover:bg-[var(--accent)]/60 transition-colors z-[120]" />
            <div onMouseDown={(e) => handleResizeStart(e, 'both')} className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-[130] flex items-center justify-center group/corner">
               <div className="w-3 h-3 border-r-2 border-b-2 border-[var(--accent)] scale-75 group-hover/corner:scale-110 transition-transform shadow-[2px_2px_10px_rgba(255,77,0,0.3)]" />
            </div>
          </>
        )}
      </div>

      <div className={`absolute inset-0 pointer-events-none z-50 ${isForge ? (panel.image ? '' : 'opacity-20') : ''}`}>
          {panel.textElements.map(el => (
            <SpeechBubble key={el.id} el={el} />
          ))}
      </div>

      <AnimatePresence>
        {isForge && isSelected && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-[100]">
             <button onClick={(e) => { e.stopPropagation(); onAddAfter(); }} className="w-8 h-8 rounded-full bg-[var(--accent)] text-white shadow-[0_0_20px_rgba(255,77,0,0.4)] flex items-center justify-center hover:scale-110 transition-all border-2 border-black">
                <Plus size={16} strokeWidth={3} />
             </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
