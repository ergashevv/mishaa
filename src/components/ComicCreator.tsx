'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, RefreshCw, Zap, Settings2, X, Sparkles, 
  User, FilePlus, LayoutGrid, History, 
  ChevronLeft, ChevronRight, Download, MousePointer2,
  Maximize, Monitor, Smartphone, Type, Move, Hand, Layers,
  Undo2, Redo2, BrainCircuit
} from 'lucide-react';

import { useComicCreator } from '@/hooks/useComicCreator';
import { PanelCard } from './Comic/PanelCard';
import { ProfessionalCanvas } from './Comic/ProfessionalCanvas';
import { ComicMasthead } from './Comic/ComicMasthead';
import { StoryArchitectModal } from './Comic/Modals/StoryArchitectModal';
import { CharacterForgeModal } from './Comic/Modals/CharacterForgeModal';
import { OnboardingWizard } from './Comic/Modals/OnboardingWizard';
import { GlobalLogicHUD } from './Comic/GlobalLogicHUD';
import { PRINT_STANDARDS } from '@/constants/comic';
import { translations } from '@/lib/translations';

export default function ComicCreator() {
  const engine = useComicCreator();
  const { 
    pages, activePageIndex, activePage, selectedPanelId, selectedPanel, 
    characters, studioSettings, setStudioSettings, title, setTitle, 
    updatePanel, addPanel, deletePanel, duplicatePanel, generatePanelImage, 
    addPage, setActivePageIndex, insertPanelAfter, addTextElement,
    draftPanels, addDraftPanel, setSelectedPanelId,
    saveToCloud, isSaving, lastSaved,
    undo, redo, canUndo, canRedo
  } = engine;
  
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [activeRightTab, setActiveRightTab] = useState<'properties' | 'layers' | 'neural'>('properties');
  const [cursorMode, setCursorMode] = useState<'move' | 'hand'>('move');
  const [zoom, setZoom] = useState(0.8);
  const [lang, setLang] = useState('en');
  const t = (key: string): string => {
    const val = (translations[lang as keyof typeof translations] as any)?.[key];
    return typeof val === 'string' ? val : key;
  };

  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [isCharacterForgeOpen, setIsCharacterForgeOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [storyInput, setStoryInput] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setIsOnboardingOpen(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsOnboardingOpen(false);
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    try {
      await engine.synthesizeStory(storyInput);
      setIsArchitectOpen(false);
      setStoryInput('');
    } catch (err) {
      console.error("Synthesis failed:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // -- KEYBOARD SHORTCUTS --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'v') setCursorMode('move');
      if (key === 'h') setCursorMode('hand');
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
         if (e.shiftKey) redo();
         else undo();
      }
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
    <div className="fixed inset-0 z-[1000] bg-[var(--studio-bg)] text-[var(--studio-text)] font-sans selection:bg-[var(--accent)] selection:text-white overflow-hidden flex flex-col">
      
      {/* 🟢 TOP NAVIGATION BAR */}
      <header className="h-20 px-10 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl z-[400] relative">
         <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent pointer-events-none" />
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center font-black italic shadow-[0_10px_30px_rgba(255,77,0,0.4)]">ic</div>
               <div className="flex flex-col">
                  <input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-transparent border-none outline-none text-[11px] font-black tracking-[0.3em] uppercase text-[var(--studio-text)] focus:text-[var(--accent)] transition-colors w-48"
                  />
                  <div className="flex items-center gap-2">
                     <span className="text-[7px] text-[var(--studio-text-dim)] font-black uppercase tracking-widest leading-none">Foundry_System_v3.7_Pro</span>
                     {lastSaved && (
                        <span className="text-[6px] text-[var(--accent)]/60 font-black uppercase tracking-widest leading-none">• Synced_{lastSaved.toLocaleTimeString()}</span>
                     )}
                  </div>
               </div>
            </div>
            <div className="h-8 w-[1px] bg-white/10 mx-2" />
            <nav className="flex gap-10 items-center">
               <button className="text-[9px] font-black tracking-[0.4em] text-[var(--accent)] border-b-2 border-[var(--accent)] pb-1 uppercase">{t('edit_forge')}</button>
               <button className="text-[9px] font-black tracking-[0.4em] text-[var(--studio-text-dim)] hover:text-[var(--studio-text)] transition-all uppercase">{t('composition')}</button>
            </nav>
         </div>

         <div className="flex items-center gap-5">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
               <button 
                  onClick={() => setViewMode('edit')}
                  className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${viewMode === 'edit' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
               >
                  Forge_Mode
               </button>
               <button 
                  onClick={() => setViewMode('preview')}
                  className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${viewMode === 'preview' ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
               >
                  Reader_Sim
               </button>
            </div>
            <div className="h-8 w-[1px] bg-white/10 mx-1" />
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
               <span className="text-[7px] font-black text-[var(--studio-text-dim)] uppercase tracking-[0.3em]">{t('page_allocation')}</span>
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
      </header>

      <main className="flex-1 flex overflow-hidden relative">
         {/* 🔴 CAST REGISTRY (Obsidian Panel) */}
         <aside className="w-85 border-r border-white/5 bg-[#080808] flex flex-col z-[300] shadow-[10px_0_40px_rgba(0,0,0,0.2)]">
            <div className="p-8 flex items-center justify-between border-b border-white/5 bg-black/20">
               <div className="flex flex-col">
                  <h2 className="text-[9px] font-black text-[var(--studio-text-dim)] uppercase tracking-[0.5em]">{t('global_assets')}</h2>
                  <span className="text-[6px] font-black text-[var(--accent)] uppercase tracking-widest mt-1">{t('registry_sync')}</span>
               </div>
               <button 
                  onClick={() => setIsCharacterForgeOpen(true)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-[var(--accent)] hover:text-white flex items-center justify-center transition-all border border-white/10"
               >
                  <Plus size={14} />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-none">
               {characters.map(char => (
                  <motion.div 
                     key={char.id} 
                     whileHover={{ x: 4 }}
                     className="group p-3 bg-white/[0.02] border border-white/5 hover:border-[var(--accent)]/30 rounded-xl transition-all cursor-pointer flex items-center gap-4"
                  >
                     <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 group-hover:scale-105 transition-transform bg-black">
                        <img src={char.imageUrl} className="w-full h-full object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500" alt={char.name} />
                     </div>
                     <div className="flex flex-col flex-1 truncate">
                        <span className="text-[10px] font-black text-white/80 group-hover:text-white transition-colors truncate">{char.name}</span>
                        <span className="text-[7px] font-black text-white/20 uppercase tracking-widest truncate">{char.role}</span>
                     </div>
                  </motion.div>
               ))}
            </div>
            {/* TECHNICAL READOUT (PRO DETAIL) */}
            <div className="p-8 border-t border-white/5 bg-black/20">
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                     <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">{t('system_latent')}</span>
                     <span className="text-[7px] font-black text-green-500 uppercase tracking-widest">Optimized</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex flex-col gap-1">
                        <span className="text-[6px] font-black text-white/20 uppercase">{t('vram_usage')}</span>
                        <span className="text-[8px] font-black text-white/60">4.2GB / 12GB</span>
                     </div>
                     <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex flex-col gap-1">
                        <span className="text-[6px] font-black text-white/20 uppercase">{t('forge_core')}</span>
                        <span className="text-[8px] font-black text-white/60">Active_v3.7</span>
                     </div>
                  </div>
               </div>
            </div>
         </aside>

         {/* 🟢 MINIMALIST TOOLBAR (TOP CENTER) */}
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[330] flex items-center gap-1 p-1 bg-[var(--studio-panel)]/80 backdrop-blur-3xl border border-[var(--studio-border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
            <button 
              onClick={() => setCursorMode('move')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${cursorMode === 'move' ? 'bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(255,77,0,0.3)]' : 'text-[var(--studio-text-dim)] hover:bg-[var(--studio-bg)]'}`}
              title="Move (V)"
            >
               <MousePointer2 size={18} />
            </button>
            <div className="w-[1px] h-6 bg-[var(--studio-border)] mx-1" />
            <button 
              onClick={() => setCursorMode('hand')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${cursorMode === 'hand' ? 'bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(255,77,0,0.3)]' : 'text-[var(--studio-text-dim)] hover:bg-[var(--studio-bg)]'}`}
              title="Hand (H)"
            >
               <Hand size={18} />
            </button>
            <div className="w-[1px] h-6 bg-[var(--studio-border)] mx-1" />
            <button 
              onClick={() => undo()}
              disabled={!canUndo}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${canUndo ? 'text-[var(--studio-text)] hover:bg-[var(--studio-bg)]' : 'text-white/5 opacity-20'}`}
              title="Undo (Ctrl+Z)"
            >
               <Undo2 size={16} />
            </button>
            <button 
              onClick={() => redo()}
              disabled={!canRedo}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${canRedo ? 'text-[var(--studio-text)] hover:bg-[var(--studio-bg)]' : 'text-white/5 opacity-20'}`}
              title="Redo (Ctrl+Shift+Z)"
            >
               <Redo2 size={16} />
            </button>
         </div>

         {/* MAIN CANVAS VIEW (Deep Depth Space) */}
         <section 
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 relative overflow-auto bg-[var(--studio-bg)]/50 scrollbar-none ${
               cursorMode === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
         >
            {/* The Infinite Drafting Orbit with Depth Gradient */}
            <div className="min-h-[600vh] w-[600vw] flex items-center justify-center relative p-[300vh] bg-[radial-gradient(circle_at_center,rgba(255,77,0,0.02)_0%,transparent_70%)]">
               
               {/* Global Background Grid (Technical Layout) */}
               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ 
                  backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)`,
                  backgroundSize: '100px 100px'
               }} />

               {/* 🚀 ARTBOARD SEQUENCE (The Active Focus Area) */}
               <div className="flex gap-[500px] items-start relative z-10">
                  {pages.map((page, pIdx) => (
                    <div key={page.id} className="relative group/artboard">
                        <div className="absolute -top-12 left-0 flex items-center gap-3">
                           <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--studio-text-dim)] group-hover/artboard:text-[var(--accent)] transition-all">Artboard_Page_{pIdx + 1}</span>
                           <div className="h-[1px] w-64 bg-[var(--studio-border)] group-hover/artboard:bg-[var(--accent)]/20 transition-all" />
                        </div>

                       <motion.div animate={{ scale: zoom }} style={{ transformOrigin: 'top center' }}>
                          <ProfessionalCanvas settings={studioSettings} isPreview={viewMode === 'preview'}>
                             {page.isCover && (
                                <ComicMasthead 
                                  title={title} 
                                  issue={page.issueNumber || '1'} 
                                  price={page.price || '$3.99'} 
                                  month={page.releaseMonth || 'APR'} 
                                />
                             )}
                             <div className="absolute z-20 overflow-hidden" style={{ top: metrics.safeTop, left: metrics.safeLeft, width: metrics.safeWidth, height: metrics.safeHeight, backgroundColor: studioSettings.gutterColor || 'transparent' }}>
                                <div 
                                  className={`grid grid-cols-12 w-full content-start transition-all duration-700 p-0 m-0`} 
                                  style={{ 
                                     gridAutoRows: '4px', 
                                     gap: viewMode === 'preview' ? '0px' : `${studioSettings.gutterWidth || 0}px` 
                                  }}
                                >
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

                  {/* Add New Artboard & Page Settings */}
                  <div className="flex flex-col gap-6 items-center">
                     <div 
                       onClick={() => addPage()}
                       className="w-[450px] h-[650px] border-2 border-dashed border-[var(--studio-border)] rounded-[2.5rem] flex items-center justify-center cursor-pointer hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/[0.02] transition-all group/newp"
                     >
                        <div className="flex flex-col items-center gap-6 opacity-20 group-hover:opacity-100 transition-all">
                           <Plus size={60} className="text-[var(--studio-text)]" />
                           <span className="text-[10px] font-black uppercase tracking-[0.4em]">Assemble_Artboard</span>
                        </div>
                     </div>
                     
                     <button 
                       onClick={() => {
                          const newPages = pages.map((pg, i) => i === activePageIndex ? { ...pg, isCover: !pg.isCover } : pg);
                          engine.setPages(newPages);
                       }}
                       className={`w-full py-5 border rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activePage.isCover ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-xl translate-y-[-2px]' : 'bg-[var(--studio-panel)] border-[var(--studio-border)] text-[var(--studio-text-dim)] hover:text-[var(--studio-text)]'}`}
                     >
                        {activePage.isCover ? '✓_Cover_Mode_Active' : 'Convert_To_Cover_Art'}
                     </button>
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
                       <span className="text-[9px] font-black uppercase text-[var(--studio-text-dim)] tracking-[0.2em]">Draft_Asset_{i+1}</span>
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

         {/* 🔴 MATRIX EDITOR (Top Level Sidebar) */}
         <aside className="w-96 border-l border-white/5 bg-[#0a0a0a] flex flex-col z-[300] shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
            {/* Tab Switcher */}
            <div className="flex border-b border-white/5 bg-black/40">
               {['properties', 'layers', 'neural'].map(tab => (
                  <button 
                     key={tab}
                     onClick={() => setActiveRightTab(tab as any)}
                     className={`flex-1 py-5 text-[9px] font-black uppercase tracking-[0.4em] transition-all ${activeRightTab === tab ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-white/20 hover:text-white'}`}
                  >
                     {t(tab)}
                  </button>
               ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col">
               <div className="p-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_15px_rgba(255,77,0,0.8)]" />
                     <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/60">{t('matrix_editor')}</h3>
                  </div>
                  <button onClick={() => engine.setSelectedPanelId(null)} className="text-white/20 hover:text-white transition-colors"><X size={16} /></button>
               </div>

            <div className="p-8 flex-1 flex flex-col space-y-12">
               {selectedPanel ? (
                  <>
                     <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                           <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)]">Scene_Description</label>
                           <Zap size={14} className="text-[var(--accent)]" />
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                           {characters.map(char => (
                              <button 
                                key={char.id}
                                onClick={() => {
                                   const isTagged = selectedPanel.characterIds?.includes(char.id);
                                   const newIds = isTagged ? selectedPanel.characterIds?.filter(id => id !== char.id) : [...(selectedPanel.characterIds || []), char.id];
                                   let newPrompt = selectedPanel.prompt;
                                   if (!isTagged && char.promptBase) newPrompt = `${char.promptBase}, ${newPrompt}`;
                                   updatePanel(selectedPanel.id, { characterIds: newIds, prompt: newPrompt });
                                }}
                                className={`p-1.5 rounded-lg border text-[7px] font-black uppercase ${selectedPanel.characterIds?.includes(char.id) ? 'bg-[var(--accent)] text-white' : 'bg-black/20 text-white/40'}`}
                              >
                                 {char.name}
                              </button>
                           ))}
                        </div>
                               <textarea 
                            value={selectedPanel.prompt || ''}
                            onChange={(e) => updatePanel(selectedPanel.id, { prompt: e.target.value })}
                            className="w-full h-56 bg-black/40 border border-white/5 rounded-2xl p-6 text-sm text-[var(--studio-text)] outline-none focus:border-[var(--accent)] transition-all resize-none placeholder:text-white/10 font-medium leading-relaxed"
                            placeholder="Describe the cinematic layout and artistic vision..."
                         />
                         <button 
                           onClick={async () => {
                              // AI Suggestion Logic
                              setIsSaving(true);
                              try {
                                 const res = await fetch('/api/ai/suggest-panel', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                       context: storyInput || activePage.title,
                                       characters: characters,
                                       currentPrompt: selectedPanel.prompt 
                                    })
                                 });
                                 const data = await res.json();
                                 if (data.suggestion) updatePanel(selectedPanel.id, { prompt: data.suggestion });
                              } catch (err) { console.error(err); }
                              finally { setIsSaving(false); }
                           }}
                           className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-[0.3em] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all flex items-center justify-center gap-3"
                         >
                            <Sparkles size={12} />
                            Neural_Logic_Suggestion
                         </button>

                     </div>

                     <div className="pt-8 border-t border-[var(--studio-border)] space-y-6">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)]">Cinematic_Aesthetic</label>
                           <div className="grid grid-cols-4 gap-2">
                              {[
                                { id: 'none', label: 'Raw' },
                                { id: 'halftone', label: 'Classic' },
                                { id: 'noir', label: 'Noir' },
                                { id: 'warm', label: 'Filmic' }
                              ].map(f => (
                                <button 
                                  key={f.id}
                                  onClick={() => updatePanel(selectedPanel.id, { filter: f.id })}
                                  className={`py-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${selectedPanel.filter === f.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-[var(--studio-bg)] border-[var(--studio-border)] text-[var(--studio-text-dim)] hover:border-white/20'}`}
                                >
                                  {f.label}
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)]">Panel_Geometry_&_Dimension</label>
                            <div className="grid grid-cols-2 gap-3">
                               {[
                                 { id: 'none', label: 'Standard_Box', clip: 'none' },
                                 { id: 'diag-r', label: 'Agile_Cut_R', clip: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' },
                                 { id: 'diag-l', label: 'Agile_Cut_L', clip: 'polygon(15% 0, 100% 0, 100% 100%, 0 100%)' },
                                 { id: 'hero', label: 'Heroic_Banner', clip: 'polygon(0 10%, 100% 0, 100% 90%, 0 100%)' }
                               ].map(c => (
                                 <button 
                                   key={c.id}
                                   onClick={() => updatePanel(selectedPanel.id, { clipPath: c.clip })}
                                   className={`py-4 px-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${selectedPanel.clipPath === c.clip ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--studio-bg)] border-[var(--studio-border)] text-[var(--studio-text-dim)]'}`}
                                 >
                                    <div className="w-8 h-4 border border-current opacity-40 rounded-[2px]" style={{ clipPath: c.clip }} />
                                    <span className="text-[7px] font-black uppercase tracking-widest">{c.label}</span>
                                 </button>
                               ))}
                            </div>
                            
                            {/* Advanced Transform HUD */}
                            <div className="pt-4 grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1">
                                     <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Rotation</span>
                                     <span className="text-[8px] font-black text-[var(--accent)]">{(selectedPanel.rotation || 0)}°</span>
                                  </div>
                                  <input 
                                    type="range" min="-15" max="15" step="1" 
                                    value={selectedPanel.rotation || 0}
                                    onChange={(e) => updatePanel(selectedPanel.id, { rotation: parseInt(e.target.value) })}
                                    className="w-full accent-[var(--accent)] opacity-60 hover:opacity-100 transition-all" 
                                  />
                               </div>
                               <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1">
                                     <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Depth_Layer</span>
                                     <span className="text-[8px] font-black text-[var(--accent)]">Lvl_{selectedPanel.zIndex || 10}</span>
                                  </div>
                                  <input 
                                    type="range" min="1" max="100" step="1" 
                                    value={selectedPanel.zIndex || 10}
                                    onChange={(e) => updatePanel(selectedPanel.id, { zIndex: parseInt(e.target.value) })}
                                    className="w-full accent-[var(--accent)] opacity-60 hover:opacity-100 transition-all" 
                                  />
                               </div>
                            </div>

                            {/* Neural Post-Process (Pro Detailing) */}
                            <div className="pt-6 border-t border-[var(--studio-border)] space-y-4">
                               <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)]">Neural_Image_Post_Process</label>
                               <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                     <div className="flex justify-between items-center px-1">
                                        <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Brightness</span>
                                        <span className="text-[8px] font-black text-[var(--accent)]">{selectedPanel.brightness || 100}%</span>
                                     </div>
                                     <input 
                                       type="range" min="50" max="200" step="1" 
                                       value={selectedPanel.brightness || 100}
                                       onChange={(e) => updatePanel(selectedPanel.id, { brightness: parseInt(e.target.value) })}
                                       className="w-full accent-[var(--accent)] opacity-60 hover:opacity-100 transition-all" 
                                     />
                                  </div>
                                  <div className="space-y-2">
                                     <div className="flex justify-between items-center px-1">
                                        <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Contrast</span>
                                        <span className="text-[8px] font-black text-[var(--accent)]">{selectedPanel.contrast || 100}%</span>
                                     </div>
                                     <input 
                                       type="range" min="50" max="200" step="1" 
                                       value={selectedPanel.contrast || 100}
                                       onChange={(e) => updatePanel(selectedPanel.id, { contrast: parseInt(e.target.value) })}
                                       className="w-full accent-[var(--accent)] opacity-60 hover:opacity-100 transition-all" 
                                     />
                                  </div>
                               </div>
                            </div>

                            {/* Structural Detailing (Pro Borders) */}
                            <div className="pt-6 border-t border-[var(--studio-border)] space-y-4">
                               <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)]">Structural_Detailing</label>
                               <div className="grid grid-cols-3 gap-3">
                                  <div className="flex flex-col gap-2">
                                     <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Ink_Weight</span>
                                     <input 
                                       type="number" value={selectedPanel.borderWidth ?? 2}
                                       onChange={(e) => updatePanel(selectedPanel.id, { borderWidth: parseInt(e.target.value) })}
                                       className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-2 text-[10px] font-black text-center" 
                                     />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                     <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Corner_Rad</span>
                                     <input 
                                       type="number" value={selectedPanel.borderRadius || 0}
                                       onChange={(e) => updatePanel(selectedPanel.id, { borderRadius: parseInt(e.target.value) })}
                                       className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-2 text-[10px] font-black text-center" 
                                     />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                     <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Ink_Color</span>
                                     <input 
                                       type="color" value={selectedPanel.borderColor || '#000000'}
                                       onChange={(e) => updatePanel(selectedPanel.id, { borderColor: e.target.value })}
                                       className="w-full h-8 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden" 
                                     />
                                  </div>
                               </div>
                            </div>

                            {/* Cinematic Camera Framing (Pro Composition) */}
                            <div className="pt-6 border-t border-[var(--studio-border)] space-y-4">
                               <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)]">Cinematic_Camera_Framing</label>
                               <div className="space-y-4">
                                  <div className="space-y-2">
                                     <div className="flex justify-between items-center px-1">
                                        <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Optical_Zoom</span>
                                        <span className="text-[8px] font-black text-[var(--accent)]">{((selectedPanel.imageScale || 1) * 100).toFixed(0)}%</span>
                                     </div>
                                     <input 
                                       type="range" min="1" max="3" step="0.01" 
                                       value={selectedPanel.imageScale || 1}
                                       onChange={(e) => updatePanel(selectedPanel.id, { imageScale: parseFloat(e.target.value) })}
                                       className="w-full accent-[var(--accent)]" 
                                     />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Pan_X</span>
                                        <input 
                                          type="range" min="-50" max="50" step="1" 
                                          value={selectedPanel.imageX || 0}
                                          onChange={(e) => updatePanel(selectedPanel.id, { imageX: parseInt(e.target.value) })}
                                          className="w-full accent-[var(--accent)]" 
                                        />
                                     </div>
                                     <div className="space-y-2">
                                        <span className="text-[7px] font-black uppercase text-[var(--studio-text-dim)]">Pan_Y</span>
                                        <input 
                                          type="range" min="-50" max="50" step="1" 
                                          value={selectedPanel.imageY || 0}
                                          onChange={(e) => updatePanel(selectedPanel.id, { imageY: parseInt(e.target.value) })}
                                          className="w-full accent-[var(--accent)]" 
                                        />
                                     </div>
                                  </div>
                               </div>
                            </div>
                         </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl flex flex-col gap-1.5">
                              <span className="text-[8px] font-black text-[var(--studio-text-dim)] uppercase tracking-widest">Dimensions</span>
                              <span className="text-[11px] font-black text-[var(--studio-text)]">{selectedPanel.colSpan || 6}U Scale</span>
                           </div>
                           <div className="p-5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl flex flex-col gap-1.5">
                              <span className="text-[8px] font-black text-[var(--studio-text-dim)] uppercase tracking-widest">Neural_Status</span>
                              <span className="text-[11px] font-black text-[var(--accent)] uppercase">{selectedPanel.status}</span>
                           </div>
                        </div>
                        <button onClick={() => updatePanel(selectedPanel.id, { colSpan: 12, customHeight: `${metrics.safeHeight}px`, size: 'mega', clipPath: 'none' })} className="w-full py-4 bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[9px] font-black uppercase tracking-[3px] rounded-xl hover:bg-[var(--studio-text)] hover:text-[var(--studio-bg)] transition-all">Create_Splash_Master</button>
                     </div>

                        <div className="space-y-4 pt-8 border-t border-[var(--studio-border)]">
                           <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)]">Vocalizations</label>
                           {selectedPanel.textElements && selectedPanel.textElements.length > 0 ? (
                              <div className="space-y-2">
                                 {selectedPanel.textElements.map(el => (
                                    <div key={el.id} className="p-3 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-xl flex items-center justify-between group/el">
                                       <div className="flex items-center gap-3">
                                          <div className="w-6 h-6 bg-[var(--studio-panel)] border border-[var(--studio-border)] rounded-md flex items-center justify-center">
                                             <Type size={10} className="text-[var(--accent)]" />
                                          </div>
                                          <input 
                                            value={el.text} 
                                            onChange={(e) => {
                                               const newEls = selectedPanel.textElements.map(te => te.id === el.id ? { ...te, text: e.target.value } : te);
                                               updatePanel(selectedPanel.id, { textElements: newEls });
                                            }}
                                            className="bg-transparent border-none outline-none text-[10px] font-bold text-[var(--studio-text)] w-32" 
                                          />
                                       </div>
                                       <div className="flex items-center gap-1 opacity-0 group-hover/el:opacity-100 transition-opacity">
                                          {['speech', 'thought', 'shout', 'caption', 'sfx'].map(type => (
                                             <button 
                                               key={type}
                                               onClick={() => {
                                                  const newEls = selectedPanel.textElements.map(te => te.id === el.id ? { ...te, type: type as any } : te);
                                                  updatePanel(selectedPanel.id, { textElements: newEls });
                                               }}
                                               className={`w-6 h-6 rounded flex items-center justify-center text-[7px] font-black uppercase border transition-all ${el.type === type ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white/50 text-black/40 border-black/5 hover:bg-white'}`}
                                               title={type}
                                             >
                                                {type[0].toUpperCase()}
                                             </button>
                                          ))}
                                          <button 
                                            onClick={() => {
                                               const newEls = selectedPanel.textElements.filter(te => te.id !== el.id);
                                               updatePanel(selectedPanel.id, { textElements: newEls });
                                            }}
                                            className="w-6 h-6 rounded flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-all ml-2"
                                          >
                                             <Trash2 size={10} />
                                          </button>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           ) : (
                              <p className="text-[8px] font-bold text-[var(--studio-text-dim)] uppercase tracking-widest text-center py-4 border border-dashed border-[var(--studio-border)] rounded-xl italic">No active vocalizations found.</p>
                           )}
                           <button 
                             onClick={() => addTextElement(selectedPanel.id, 50, 20)}
                             className="w-full py-3 border border-dashed border-[var(--studio-border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] text-[8px] font-black uppercase tracking-[2px] rounded-xl transition-all"
                           >
                              + New_Linguistic_Probe
                           </button>
                        </div>

                        <div className="flex items-center gap-4">
                        <button 
                           onClick={() => generatePanelImage(selectedPanel.id)}
                           disabled={!selectedPanel.prompt || selectedPanel.status === 'loading'}
                           className="flex-1 py-6 bg-[var(--accent)] text-white text-[11px] font-black uppercase tracking-[4px] rounded-2xl hover:brightness-110 shadow-[0_20px_40px_rgba(255,77,0,0.3)] disabled:opacity-20 transition-all"
                        >
                           Generate_Panel_Art
                        </button>
                        <button 
                           onClick={() => {
                              currentTargetPanelRef.current = selectedPanel.id;
                              fileInputRef.current?.click();
                           }}
                           className="w-20 py-6 bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-text-dim)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-panel)] rounded-2xl flex items-center justify-center transition-all"
                           title="Upload Original Artwork"
                        >
                           <Monitor size={20} />
                        </button>
                     </div>
                  </>
               ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-10 gap-8 opacity-40 mt-20">
                     <div className="w-20 h-20 border-2 border-dashed border-[var(--studio-border)] rounded-3xl flex items-center justify-center">
                        <MousePointer2 size={32} className="text-[var(--studio-text)]" />
                     </div>
                     <div className="flex flex-col gap-4">
                           <span className="text-[14px] font-black uppercase tracking-[0.5em] text-[var(--studio-text)]">Studio_Ready</span>
                        <p className="text-[10px] font-bold leading-relaxed uppercase tracking-[0.2em] text-[var(--studio-text-dim)]">
                           The foundry is ready for your vision. Select a panel to edit or use the quick start actions below.
                        </p>
                     </div>

                     <div className="grid grid-cols-1 w-full gap-3 px-8">
                        <button 
                           onClick={() => setIsCharacterForgeOpen(true)}
                           className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 px-6 hover:bg-[var(--accent)] hover:text-white transition-all group"
                        >
                           <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center group-hover:bg-white/20">
                              <User size={18} />
                           </div>
                           <div className="flex flex-col items-start">
                              <span className="text-[10px] font-black uppercase">Create_Character</span>
                              <span className="text-[7px] font-bold opacity-40 uppercase">Identity Forge</span>
                           </div>
                        </button>

                        <button 
                           onClick={() => addPage()}
                           className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 px-6 hover:bg-[var(--accent)] hover:text-white transition-all group"
                        >
                           <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center group-hover:bg-white/20">
                              <Plus size={18} />
                           </div>
                           <div className="flex flex-col items-start">
                              <span className="text-[10px] font-black uppercase">Add_New_Page</span>
                              <span className="text-[7px] font-bold opacity-40 uppercase">Artboard System</span>
                           </div>
                        </button>

                        <button 
                           onClick={() => setIsOnboardingOpen(true)}
                           className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 px-6 hover:bg-white hover:text-black transition-all group mt-4"
                        >
                           <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center group-hover:bg-black/10">
                              <Sparkles size={18} />
                           </div>
                           <div className="flex flex-col items-start">
                              <span className="text-[10px] font-black uppercase">Show_Tutorial</span>
                              <span className="text-[7px] font-bold opacity-40 uppercase">Guided Tour</span>
                           </div>
                        </button>
                     </div>
                  </div>
               )}
            </div>
         </aside>
      </main>

      {/* 🟢 FLOATING INTERFACE CONTROLS */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-6">
         {/* Zoom HUD */}
         <div className="flex items-center bg-[var(--studio-panel)]/90 backdrop-blur-3xl border border-[var(--studio-border)] rounded-full p-2.5 shadow-xl overflow-hidden hover:border-[var(--accent)]/40 transition-all">
            <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--studio-text-dim)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] transition-all text-xl font-light">-</button>
            <div className="px-8 flex flex-col items-center min-w-[100px]">
               <span className="text-[12px] font-black tracking-widest text-[var(--studio-text)]">{(zoom * 100).toFixed(0)}%</span>
               <span className="text-[7px] font-black text-[var(--studio-text-dim)] uppercase tracking-[0.2em]">Foundry_Scale</span>
            </div>
            <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--studio-text-dim)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] transition-all text-xl font-light">+</button>
            <div className="w-[1px] h-8 bg-[var(--studio-border)] mx-3" />
            <button 
               onClick={() => {
                  setZoom(0.8);
                  if (scrollRef.current) {
                     const container = scrollRef.current;
                     container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
                     container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
                  }
               }}
               className="px-6 py-2.5 bg-[var(--studio-bg)] hover:bg-black hover:text-white border border-[var(--studio-border)] rounded-xl text-[8px] font-black uppercase tracking-[0.3em] text-[var(--studio-text-dim)] transition-all"
            >
               Reset_Center
            </button>
         </div>

         {/* Core Action Deck */}
         <div className="flex items-center gap-3 p-3 bg-[var(--studio-panel)]/90 backdrop-blur-3xl border border-[var(--studio-border)] rounded-[2.5rem] shadow-xl">
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
               className="h-16 px-10 bg-[var(--studio-panel)] border border-[var(--studio-border)] text-[var(--studio-text-dim)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] rounded-[1.8rem] flex items-center gap-4 transition-all group/dbtn"
            >
               <Layers size={18} className="group-hover/dbtn:text-[var(--accent)] transition-colors" />
               <span className="text-[11px] font-black uppercase tracking-[3px]">New_Draft_Asset</span>
            </button>
            <button 
               onClick={() => {
                  currentTargetPanelRef.current = null;
                  fileInputRef.current?.click();
               }}
               className="h-16 w-16 bg-[var(--studio-panel)] border border-[var(--studio-border)] text-[var(--studio-text-dim)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] rounded-[1.8rem] flex items-center justify-center transition-all group/ibtn"
               title="Import External Asset"
            >
               <FilePlus size={20} className="group-hover/ibtn:text-[var(--accent)]" />
            </button>
            <button 
               onClick={() => setIsArchitectOpen(true)}
               className="h-16 px-10 bg-[var(--studio-bg)] border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white rounded-[1.8rem] flex items-center gap-4 transition-all group/lbtn shadow-[0_0_20px_rgba(255,77,0,0.1)]"
            >
               <BrainCircuit size={18} />
               <span className="text-[11px] font-black uppercase tracking-[3px]">Foundry_Logic_Architect</span>
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

      <OnboardingWizard 
        isOpen={isOnboardingOpen} 
        onClose={completeOnboarding} 
        onStartCharacter={() => { setIsCharacterForgeOpen(true); setIsOnboardingOpen(false); }}
        onStartPage={() => { addPage(); setIsOnboardingOpen(false); }}
        t={t}
      />

      <StoryArchitectModal 
        isOpen={isArchitectOpen} 
        onClose={() => setIsArchitectOpen(false)} 
        storyInput={storyInput}
        setStoryInput={setStoryInput}
        isSynthesizing={isSynthesizing}
        onSynthesize={handleSynthesize} 
        t={t}
      />
      <CharacterForgeModal isOpen={isCharacterForgeOpen} onClose={() => { setIsCharacterForgeOpen(false); }} onSave={(char) => { engine.setCharacters([...engine.characters, char]); setIsCharacterForgeOpen(false); }} t={t} />
      <GlobalLogicHUD t={t} />
    </div>
  );
}
