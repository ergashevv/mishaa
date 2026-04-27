'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, RefreshCw, Zap, Settings2, X, Sparkles, 
  User, FilePlus, LayoutGrid, History, 
  ChevronLeft, ChevronRight, Download, MousePointer2,
  Maximize, Monitor, Smartphone, Type, Move, Hand, Layers
} from 'lucide-react';

import { useComicCreator } from '@/hooks/useComicCreator';
import { PanelCard } from './Comic/PanelCard';
import { ProfessionalCanvas } from './Comic/ProfessionalCanvas';
import { StoryArchitectModal } from './Comic/Modals/StoryArchitectModal';
import { CharacterForgeModal } from './Comic/Modals/CharacterForgeModal';
import { PRINT_STANDARDS } from '@/constants/comic';
import { translations } from '@/lib/translations';

export default function ComicCreator() {
  const engine = useComicCreator();
  const { 
    pages, activePageIndex, activePage, selectedPanelId, selectedPanel, 
    characters, studioSettings, setStudioSettings, title, setTitle, 
    addPage, setActivePageIndex, insertPanelAfter, addTextElement,
    draftPanels, addDraftPanel, setSelectedPanelId,
    saveToCloud, isSaving, lastSaved
  } = engine;
  
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [cursorMode, setCursorMode] = useState<'move' | 'hand'>('move');
  const [zoom, setZoom] = useState(0.8);
  const [lang, setLang] = useState('en');
  const t = (key: string) => translations[lang as keyof typeof translations]?.[key as keyof (typeof translations)['en']] || key;

  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [isCharacterForgeOpen, setIsCharacterForgeOpen] = useState(false);

  // -- KEYBOARD SHORTCUTS --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'v') setCursorMode('move');
      if (key === 'h') setCursorMode('hand');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // -- PHYSICAL GRID MATH ENGINE --
  const metrics = useMemo(() => {
    const scale = 3.5;
    const safeArea = studioSettings.format.safeArea * scale;
    const width = studioSettings.format.width * scale;
    const height = studioSettings.format.height * scale;
    
    return {
      safeTop: safeArea,
      safeLeft: safeArea,
      safeWidth: width - (safeArea * 2),
      safeHeight: height - (safeArea * 2)
    };
  }, [studioSettings.format]);

  const calculateGridHeight = (panelList: any[]) => {
    let rows = 0;
    let currentCols = 0;
    let maxHeightInRow = 0;

    panelList.forEach((p) => {
      const colSpan = p.colSpan || 6;
      const height = parseInt(p.customHeight || '400');

      if (currentCols + colSpan > 12) {
        rows += maxHeightInRow;
        currentCols = colSpan;
        maxHeightInRow = height;
      } else {
        currentCols += colSpan;
        maxHeightInRow = Math.max(maxHeightInRow, height);
      }
    });
    return rows + maxHeightInRow;
  };

  const totalUsedHeight = useMemo(() => calculateGridHeight(activePage.panels), [activePage.panels]);
  const isPageFull = totalUsedHeight >= metrics.safeHeight - 50;

  // -- PANNING ENGINE (Hand Tool) --
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // -- ZOOM ENGINE (Interactive Pinch & Wheel) --
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Figma logic: Pinch or Ctrl/Cmd + Scroll
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        const zoomStep = 0.005; // High-fidelity zoom granularity
        setZoom(prev => {
           const newZoom = prev - delta * zoomStep;
           return Math.max(0.1, Math.min(3, newZoom)); // Safe zoom bounds
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // -- AUTOMATIC CENTERING ON MOUNT --
  useEffect(() => {
     if (scrollRef.current) {
        const container = scrollRef.current;
        // Calculate center relative to massive 600vw container
        const centerX = (container.scrollWidth - container.clientWidth) / 2;
        const centerY = (container.scrollHeight - container.clientHeight) / 2;
        container.scrollLeft = centerX;
        container.scrollTop = centerY;
     }
  }, []); // Run once on mount

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTargetPanelRef = useRef<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      if (currentTargetPanelRef.current) {
         updatePanel(currentTargetPanelRef.current, { image: b64, status: 'success' });
         currentTargetPanelRef.current = null;
      } else {
         // Create a new draft with this image
         const id = Math.random().toString(36).substr(2, 9);
         const newPanel: any = { 
           id, prompt: 'Imported Asset', status: 'success', image: b64, textElements: [], 
           size: 'medium', colSpan: 6,
           draftX: (Math.random() - 0.5) * 400,
           draftY: (Math.random() - 0.5) * 400
         };
         engine.setPages(prev => prev.map((pg, i) => i === activePageIndex 
           ? { ...pg, panels: [...pg.panels, newPanel] } 
           : pg
         ));
         setSelectedPanelId(id);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (cursorMode !== 'hand') return;
    isDragging.current = true;
    const container = scrollRef.current;
    if (!container) return;
    startPos.current = {
       x: e.clientX,
       y: e.clientY,
       scrollLeft: container.scrollLeft,
       scrollTop: container.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || cursorMode !== 'hand') return;
    e.preventDefault();
    const container = scrollRef.current;
    if (!container) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    container.scrollLeft = startPos.current.scrollLeft - dx;
    container.scrollTop = startPos.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#020202] text-white font-sans selection:bg-[var(--accent)] selection:text-white overflow-hidden flex flex-col">
      
      {/* 🟢 TOP NAVIGATION BAR */}
      {/* 🟢 TOP NAVIGATION BAR (High-Contrast Chrome) */}
      <header className="h-18 px-8 flex items-center justify-between border-b border-white/10 bg-[#080808]/80 backdrop-blur-3xl z-[400] relative">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center font-black italic shadow-[0_10px_30px_rgba(255,77,0,0.4)]">ic</div>
               <div className="flex flex-col">
                  <input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-transparent border-none outline-none text-[11px] font-black tracking-[0.3em] uppercase text-white focus:text-[var(--accent)] transition-colors w-48"
                  />
                  <div className="flex items-center gap-2">
                     <span className="text-[7px] text-white/30 font-black uppercase tracking-widest leading-none">Foundry_System_v3.7_Pro</span>
                     {lastSaved && (
                        <span className="text-[6px] text-[var(--accent)]/60 font-black uppercase tracking-widest leading-none">• Synced_{lastSaved.toLocaleTimeString()}</span>
                     )}
                  </div>
               </div>
            </div>
            <div className="h-8 w-[1px] bg-white/10 mx-2" />
            <nav className="flex gap-10 items-center">
               <button className="text-[9px] font-black tracking-[0.4em] text-[var(--accent)] border-b-2 border-[var(--accent)] pb-1 uppercase">{t('edit_forge')}</button>
               <button className="text-[9px] font-black tracking-[0.4em] text-white/30 hover:text-white transition-all uppercase">{t('composition')}</button>
            </nav>
         </div>

         <div className="flex items-center gap-5">
            <button 
              onClick={() => saveToCloud()}
              disabled={isSaving}
              className={`h-10 px-5 border flex items-center gap-3 rounded-xl transition-all ${isSaving ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20'}`}
            >
               {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
               <span className="text-[8px] font-black uppercase tracking-widest">{isSaving ? 'Syncing...' : 'Cloud_Sync'}</span>
            </button>
            <div className="h-8 w-[1px] bg-white/10 mx-1" />
            <div className="flex flex-col items-end gap-1 px-2">
               <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.3em]">{t('page_allocation')}</span>
               <div className="flex items-center gap-3">
                  <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                     <motion.div initial={{ width: 0 }} animate={{ width: `${(totalUsedHeight / metrics.safeHeight) * 100}%` }} className="h-full bg-[var(--accent)] shadow-[0_0_10px_rgba(255,77,0,0.8)]" />
                  </div>
                  <span className="text-[9px] font-black text-[var(--accent)]">{Math.round((totalUsedHeight / metrics.safeHeight) * 100)}%</span>
               </div>
            </div>
            <button className="h-10 px-8 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[var(--accent)] hover:text-white transition-all shadow-2xl">
               {t('release_export')}
            </button>
         </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
         {/* 🔴 CAST REGISTRY (Obsidian Panel) */}
         <aside className="w-85 border-r border-white/10 bg-[#0a0a0a] flex flex-col z-[300] shadow-[10px_0_40px_rgba(0,0,0,0.5)]">
            <div className="p-8 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
               <h2 className="text-[9px] font-black text-white/30 uppercase tracking-[0.5em]">{t('cast_registry')}</h2>
               <button className="w-8 h-8 rounded-xl bg-white/5 hover:bg-[var(--accent)]/20 hover:text-[var(--accent)] flex items-center justify-center transition-all border border-white/5">
                  <Plus size={14} />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-none">
               {characters.map(char => (
                  <div key={char.id} className="group p-4 bg-white/[0.02] border border-white/5 hover:border-[var(--accent)]/30 rounded-2xl transition-all cursor-pointer flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 group-hover:scale-105 transition-transform">
                        <img src={char.imageUrl} className="w-full h-full object-cover" alt={char.name} />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[11px] font-black text-white group-hover:text-[var(--accent)] transition-colors">{char.name}</span>
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{char.role}</span>
                     </div>
                  </div>
               ))}
            </div>
            <div className="p-8 border-t border-white/5">
               <div className="w-8 h-8 rounded-full border-2 border-white/10 flex items-center justify-center text-[9px] font-black opacity-20 hover:opacity-100 transition-all cursor-pointer">N</div>
            </div>
         </aside>

         {/* 🟢 MINIMALIST TOOLBAR (TOP CENTER) */}
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[330] flex items-center gap-1 p-1 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl">
            <button 
              onClick={() => setCursorMode('move')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${cursorMode === 'move' ? 'bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(255,77,0,0.3)]' : 'text-white/40 hover:bg-white/5'}`}
              title="Move (V)"
            >
               <MousePointer2 size={18} />
            </button>
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <button 
              onClick={() => setCursorMode('hand')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${cursorMode === 'hand' ? 'bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(255,77,0,0.3)]' : 'text-white/40 hover:bg-white/5'}`}
              title="Hand (H)"
            >
               <Hand size={18} />
            </button>
         </div>

         {/* MAIN CANVAS VIEW (Deep Depth Space) */}
         <section 
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 relative overflow-auto bg-[#050505] scrollbar-none ${
               cursorMode === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
         >
            {/* The Infinite Drafting Orbit with Depth Gradient */}
            <div className="min-h-[600vh] w-[600vw] flex items-center justify-center relative p-[300vh] bg-[radial-gradient(circle_at_center,rgba(255,77,0,0.02)_0%,transparent_70%)]">
               
               {/* Global Background Grid (Technical Layout) */}
               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ 
                  backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                  backgroundSize: '100px 100px'
               }} />

               {/* 🚀 ARTBOARD SEQUENCE (The Active Focus Area) */}
               <div className="flex gap-[500px] items-start relative z-10">
                  {pages.map((page, pIdx) => (
                    <div key={page.id} className="relative group/artboard">
                       <div className="absolute -top-12 left-0 flex items-center gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/20 group-hover/artboard:text-[var(--accent)] transition-all">Artboard_Page_{pIdx + 1}</span>
                          <div className="h-[1px] w-64 bg-white/5 group-hover/artboard:bg-[var(--accent)]/20 transition-all" />
                       </div>

                       <motion.div animate={{ scale: zoom }} style={{ transformOrigin: 'top center' }}>
                          <ProfessionalCanvas settings={studioSettings} isPreview={viewMode === 'preview'}>
                             <div className="absolute z-20 overflow-hidden" style={{ top: metrics.safeTop, left: metrics.safeLeft, width: metrics.safeWidth, height: metrics.safeHeight }}>
                                <div className={`grid grid-cols-12 w-full content-start transition-all duration-700 ${viewMode === 'preview' ? 'gap-0' : 'gap-x-5 gap-y-0'} p-0 m-0`} style={{ gridAutoRows: '4px' }}>
                                   {page.panels.map((p, i) => (
                                      <PanelCard 
                                         key={p.id} panel={p} index={i} isSelected={selectedPanelId === p.id} t={t}
                                         isPreview={viewMode === 'preview'}
                                         cursorMode={cursorMode}
                                         onClick={() => { 
                                            if (viewMode === 'edit') {
                                               setActivePageIndex(pIdx);
                                               engine.setSelectedPanelId(p.id); 
                                            }
                                         }}
                                         onAddText={addTextElement}
                                         onDelete={() => deletePanel(p.id)}
                                         onDuplicate={() => duplicatePanel(p)}
                                         onAddAfter={() => insertPanelAfter(p.id)}
                                         onResize={(updates) => updatePanel(p.id, updates)}
                                         onMoveLeft={() => {}} onMoveRight={() => {}}
                                         colSpan={p.colSpan || 6} height={p.customHeight || '400px'} pageHeight={metrics.safeHeight}
                                      />
                                   ))}
                                </div>
                             </div>
                          </ProfessionalCanvas>
                       </motion.div>
                    </div>
                  ))}

                  {/* Add New Artboard */}
                  <div 
                    onClick={() => addPage()}
                    className="w-[450px] h-[650px] border-2 border-dashed border-white/5 rounded-[3rem] flex items-center justify-center cursor-pointer hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/[0.02] transition-all group/newp"
                  >
                     <div className="flex flex-col items-center gap-6 opacity-20 group-hover:opacity-100 transition-all">
                        <Plus size={40} className="text-white" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Assemble_Artboard</span>
                     </div>
                  </div>

               </div>

               {/* 🛸 FLOATING DRAFT ASSETS (Drag & Drop Workspace) */}
               {draftPanels.map((p, i) => (
                 <motion.div 
                   key={p.id}
                   drag={cursorMode === 'move'}
                   dragMomentum={false}
                   onDragEnd={(_, info) => {
                      const newX = (p.draftX || 0) + info.offset.x;
                      const newY = (p.draftY || 0) + info.offset.y;
                      updatePanel(p.id, { draftX: newX, draftY: newY });
                   }}
                   className={`absolute z-30 transition-shadow ${cursorMode === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                   style={{ 
                     left: `calc(50% + ${p.draftX || 0}px)`, 
                     top: `calc(50% + ${p.draftY || 0}px)`, 
                     width: '400px',
                     x: 0, y: 0
                   }}
                 >
                    <div className="absolute -top-10 left-0 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                       <span className="text-[9px] font-black uppercase text-white/40 tracking-[0.2em]">Draft_Asset_{i+1}</span>
                    </div>
                    <PanelCard 
                       panel={p} index={i} isSelected={selectedPanelId === p.id} t={t}
                       isPreview={false}
                       cursorMode={cursorMode}
                       onClick={() => setSelectedPanelId(p.id)}
                       onAddText={addTextElement}
                       onDelete={() => deletePanel(p.id)}
                       onDuplicate={() => duplicatePanel(p)}
                       onAddAfter={() => {}}
                       onResize={(updates) => updatePanel(p.id, updates)}
                       onMoveLeft={() => {}} onMoveRight={() => {}}
                       colSpan={6} 
                       height={p.customHeight || '300px'}
                    />
                 </motion.div>
               ))}
            </div>
         </section>

         {/* 🔴 FORGE CONTROLLER (Industrial Obsidian Panel) */}
         <aside className="w-96 border-l border-white/10 bg-[#0a0a0a] flex flex-col p-0 z-50 overflow-y-auto scrollbar-none shadow-[-10px_0_40px_rgba(0,0,0,0.5)]">
            <div className="p-8 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_15px_rgba(255,77,0,0.8)]" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/50">Prop_Forge_v3.7</h3>
               </div>
               <button onClick={() => engine.setSelectedPanelId(null)} className="text-white/20 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            <div className="p-8 flex-1 flex flex-col space-y-12">
               {selectedPanel ? (
                  <>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Scene_Blueprint</label>
                        <Zap size={14} className="text-[var(--accent)]" />
                     </div>
                     <textarea 
                        value={selectedPanel.prompt || ''}
                        onChange={(e) => updatePanel(selectedPanel.id, { prompt: e.target.value })}
                        className="w-full h-56 bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-sm text-white/90 outline-none focus:border-[var(--accent)] transition-all resize-none placeholder:text-white/10"
                        placeholder="Describe the cinematic layout and artistic vision..."
                     />
                  </div>

                  <div className="pt-8 border-t border-white/5 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1.5">
                           <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Dimensions</span>
                           <span className="text-[11px] font-black text-white">{selectedPanel.colSpan || 6}U Scale</span>
                        </div>
                        <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1.5">
                           <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Neural_Status</span>
                           <span className="text-[11px] font-black text-[var(--accent)] uppercase">{selectedPanel.status}</span>
                        </div>
                     </div>
                     <button onClick={() => updatePanel(selectedPanel.id, { colSpan: 12, customHeight: `${metrics.safeHeight}px`, size: 'mega' })} className="w-full py-4 bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[3px] rounded-xl hover:bg-white hover:text-black transition-all">Create_Splash_Master</button>
                  </div>

                  <button 
                     onClick={() => generatePanelImage(selectedPanel.id)}
                     disabled={!selectedPanel.prompt || selectedPanel.status === 'loading'}
                     className="flex-1 py-6 bg-[var(--accent)] text-white text-[11px] font-black uppercase tracking-[4px] rounded-2xl hover:brightness-110 shadow-[0_20px_40px_rgba(255,77,0,0.3)] disabled:opacity-20 transition-all"
                  >
                     Initiate_Neural_Forge
                  </button>
                  <button 
                     onClick={() => {
                        currentTargetPanelRef.current = selectedPanel.id;
                        fileInputRef.current?.click();
                     }}
                     className="w-20 py-6 bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all"
                     title="Upload Original Artwork"
                  >
                     <Monitor size={20} />
                  </button>
               </div>
                  </>
               ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-10 gap-8 opacity-20 mt-20">
                  <div className="w-20 h-20 border-2 border-dashed border-white/10 rounded-3xl flex items-center justify-center">
                     <MousePointer2 size={32} className="text-white" />
                  </div>
                  <div className="flex flex-col gap-4">
                     <span className="text-[12px] font-black uppercase tracking-[0.5em] text-white">System_Idle</span>
                     <p className="text-[9px] font-medium leading-relaxed uppercase tracking-widest text-white/40">Select a blueprint from any artboard or drafting zone to initiate sequence.</p>
                  </div>
               </div>
            )}
         </aside>
      </main>

      {/* 🟢 FLOATING INTERFACE CONTROLS */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-6">
         {/* Zoom HUD */}
         <div className="flex items-center bg-black/90 backdrop-blur-3xl border border-white/10 rounded-full p-2.5 shadow-2xl overflow-hidden hover:border-[var(--accent)]/40 transition-all">
            <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-xl font-light">-</button>
            <div className="px-8 flex flex-col items-center min-w-[100px]">
               <span className="text-[12px] font-black tracking-widest text-white">{(zoom * 100).toFixed(0)}%</span>
               <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Foundry_Scale</span>
            </div>
            <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-xl font-light">+</button>
            <div className="w-[1px] h-8 bg-white/10 mx-3" />
            <button 
               onClick={() => {
                  setZoom(0.8);
                  if (scrollRef.current) {
                     const container = scrollRef.current;
                     container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
                     container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
                  }
               }}
               className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white transition-all"
            >
               Reset_Center
            </button>
         </div>

         {/* Core Action Deck */}
         <div className="flex items-center gap-3 p-3 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl">
            <button 
               disabled={isPageFull}
               onClick={() => addPanel('medium')}
               className="h-16 px-12 bg-[var(--accent)] text-white rounded-[1.8rem] flex items-center gap-5 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,77,0,0.5)] active:scale-95 transition-all disabled:opacity-20 disabled:grayscale group/abtn overflow-hidden relative"
            >
               <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/abtn:translate-y-0 transition-all duration-500" />
               <Plus size={20} strokeWidth={3} className="relative z-10" />
               <span className="text-[11px] font-black uppercase tracking-[4px] relative z-10">Add_To_Template</span>
            </button>
            <button 
               onClick={() => addDraftPanel()}
               className="h-16 px-10 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 rounded-[1.8rem] flex items-center gap-4 transition-all group/dbtn"
            >
               <Layers size={18} className="group-hover/dbtn:text-[var(--accent)] transition-colors" />
               <span className="text-[11px] font-black uppercase tracking-[3px]">New_Draft_Asset</span>
            </button>
            <button 
               onClick={() => {
                  currentTargetPanelRef.current = null;
                  fileInputRef.current?.click();
               }}
               className="h-16 w-16 bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 rounded-[1.8rem] flex items-center justify-center transition-all group/ibtn"
               title="Import External Asset"
            >
               <FilePlus size={20} className="group-hover/ibtn:text-[var(--accent)]" />
            </button>
         </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload} 
      />

      <StoryArchitectModal isOpen={isArchitectOpen} onClose={() => setIsArchitectOpen(false)} onSynthesize={() => setIsArchitectOpen(false)} />
      <CharacterForgeModal isOpen={isCharacterForgeOpen} onClose={() => { setIsCharacterForgeOpen(false); }} onSave={(char) => { engine.setCharacters([...engine.characters, char]); setIsCharacterForgeOpen(false); }} />
    </div>
  );
}
