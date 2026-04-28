import { useState, useCallback } from 'react';
import { ComicPage, Panel, Character, TextElement, BubbleType, PanelSize, Lang } from '@/types/comic';
import { PRINT_STANDARDS } from '@/constants/comic';

export function useComicCreator() {
  const [pages, setPages] = useState<ComicPage[]>([
    { id: 'p1', title: 'Page 1', panels: [], isCover: true, issueNumber: '117', price: '$3.99' }
  ]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [selectedStyle, setSelectedStyle] = useState('Industrial Noir');
  const [title, setTitle] = useState('FOUNDRY_PROJECT_X');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  
  const [draftPanels, setDraftPanels] = useState<Panel[]>([]);
  
  const [characters, setCharacters] = useState<Character[]>([
    { id: 'd1', name: 'Agent Nova', role: 'Protagonist', description: 'A futuristic cyber-detective with high-tech visor, chrome details, and a dark trench coat.', imageUrl: '/avatars/nova.png' },
    { id: 'd2', name: 'The Oracle', role: 'Sidekick', description: 'A mysterious holographic entity floating in a crystal sphere.', imageUrl: '/avatars/oracle.png' },
    { id: 'd3', name: 'Baron Vile', role: 'Antagonist', description: 'An imposing gothic figure in a high-collared velvet cape.', imageUrl: '/avatars/vile.png' }
  ]);

  const [studioSettings, setStudioSettings] = useState({
    format: PRINT_STANDARDS[0],
    dpi: 300,
    showGuides: true,
    showBleed: true,
    showRulers: true,
    showFlow: false,
    gutterWidth: 20,
    gutterColor: 'transparent',
  });

  // -- HISTORY ENGINE (Undo/Redo) --
  const [history, setHistory] = useState<{ past: ComicPage[][], future: ComicPage[][] }>({
    past: [],
    future: []
  });

  const saveToHistory = useCallback((currentPages: ComicPage[]) => {
    setHistory(prev => ({
      past: [...prev.past.slice(-19), currentPages],
      future: []
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const last = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      const newFuture = [pages, ...prev.future.slice(0, 19)];
      setPages(last);
      return { past: newPast, future: newFuture };
    });
  }, [pages]);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      const newPast = [...prev.past, pages];
      setPages(next);
      return { past: newPast, future: newFuture };
    });
  }, [pages]);

  const genId = () => Math.random().toString(36).substr(2, 9);

  const activePage = pages[activePageIndex];
  const selectedPanel = 
    activePage.panels.find(p => p.id === selectedPanelId) || 
    draftPanels.find(p => p.id === selectedPanelId);

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    saveToHistory(pages);
    setPages(prev => prev.map(pg => ({
      ...pg,
      panels: pg.panels.map(p => p.id === id ? { ...p, ...updates } : p)
    })));
    setDraftPanels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [pages, saveToHistory]);

  const addPanel = useCallback((size: PanelSize = 'medium') => {
    saveToHistory(pages);
    const sizeMap: Record<string, number> = { small: 3, medium: 6, wide: 12, large: 8, mega: 12 };
    const id = genId();
    const newPanel: Panel = { 
      id, prompt: '', status: 'idle', textElements: [], 
      size, colSpan: sizeMap[size], rowSpan: size === 'mega' ? 2 : 1 
    };
    setPages(prev => prev.map((pg, i) => i === activePageIndex 
      ? { ...pg, panels: [...pg.panels, newPanel] } 
      : pg
    ));
    setSelectedPanelId(id);
  }, [pages, saveToHistory, activePageIndex]);

  const addDraftPanel = useCallback(() => {
    const id = genId();
    const newPanel: Panel = { 
      id, prompt: '', status: 'idle', textElements: [], 
      size: 'medium', colSpan: 6,
      draftX: (Math.random() - 0.5) * 800,
      draftY: (Math.random() - 0.5) * 800
    };
    setDraftPanels(prev => [...prev, newPanel]);
    setSelectedPanelId(id);
  }, []);

  const deletePanel = useCallback((id: string) => {
    saveToHistory(pages);
    setPages(prev => prev.map(pg => ({
      ...pg,
      panels: pg.panels.filter(p => p.id !== id)
    })));
    setDraftPanels(prev => prev.filter(p => p.id !== id));
    setSelectedPanelId(null);
  }, [pages, saveToHistory]);

  const duplicatePanel = useCallback((panel: Panel) => {
    saveToHistory(pages);
    const id = genId();
    const copy = { ...panel, id, status: 'idle' as const };
    setPages(prev => prev.map((pg, i) => i === activePageIndex 
      ? { ...pg, panels: [...pg.panels, copy] } 
      : pg
    ));
    setSelectedPanelId(id);
  }, [pages, saveToHistory, activePageIndex]);

  const addTextElement = useCallback((panelId: string, x: number, y: number) => {
    saveToHistory(pages);
    const newEl: TextElement = { id: genId(), text: 'Double click to edit', x, y, type: 'speech', fontSize: 16, color: '#000000' };
    setPages(prev => prev.map(pg => ({
      ...pg,
      panels: pg.panels.map(p => p.id === panelId ? { ...p, textElements: [...p.textElements, newEl] } : p)
    })));
    setDraftPanels(prev => prev.map(p => p.id === panelId ? { ...p, textElements: [...p.textElements, newEl] } : p));
  }, [pages, saveToHistory]);

  const generatePanelImage = useCallback(async (panelId: string) => {
    const panel = pages.flatMap(p => p.panels).find(p => p.id === panelId) || draftPanels.find(p => p.id === panelId);
    if (!panel) return;

    updatePanel(panelId, { status: 'loading' });

    try {
      // Find character if mentioned
      const char = characters.find(c => panel.prompt?.toLowerCase().includes(c.name.toLowerCase()));

      const res = await fetch('/api/llamagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: panel.prompt,
          character: char,
          preset: "Digital Painting"
        })
      });

      const startData = await res.json();
      if (!res.ok) throw new Error(startData.error);

      const generationId = startData.id;

      // Poll for status
      const poll = async () => {
        const statusRes = await fetch(`/api/llamagen/status/${generationId}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'completed' || statusData.status === 'success') {
          const finalUrl = statusData.imageUrl || statusData.resultUrl || statusData.data?.[0]?.url;
          updatePanel(panelId, { status: 'success', image: finalUrl });
        } else if (statusData.status === 'failed') {
          updatePanel(panelId, { status: 'error' });
        } else {
          // Continue polling
          setTimeout(poll, 3000);
        }
      };

      poll();
    } catch (err) {
      console.error("Generation failed:", err);
      updatePanel(panelId, { status: 'error' });
    }
  }, [updatePanel, pages, draftPanels, characters]);

  const addPage = useCallback(() => {
    saveToHistory(pages);
    const newPage: ComicPage = { id: genId(), title: `Page ${pages.length + 1}`, panels: [] };
    setPages(prev => [...prev, newPage]);
    setActivePageIndex(pages.length);
  }, [pages, saveToHistory]);

  const saveToCloud = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload = {
        id: storyId,
        title,
        status: 'draft',
        content: {
          pages,
          draftPanels,
          characters,
          studioSettings,
          activePageIndex
        }
      };

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.id && !storyId) setStoryId(data.id);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Cloud Sync Failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [storyId, title, pages, draftPanels, characters, studioSettings, activePageIndex]);

  const insertPanelAfter = useCallback((afterId: string, size: PanelSize = 'medium') => {
    saveToHistory(pages);
    const sizeMap: Record<string, number> = { small: 3, medium: 6, wide: 12, large: 8, mega: 12 };
    const id = genId();
    const newPanel: Panel = { id, prompt: '', status: 'idle', textElements: [], size, colSpan: sizeMap[size] };
    setPages(prev => prev.map((pg, i) => i === activePageIndex 
      ? { 
          ...pg, 
          panels: pg.panels.reduce((acc, p) => {
            acc.push(p);
            if (p.id === afterId) acc.push(newPanel);
            return acc;
          }, [] as Panel[])
        } 
      : pg
    ));
    setSelectedPanelId(id);
  }, [pages, saveToHistory, activePageIndex]);

  const synthesizeStory = useCallback(async (script: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ai/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyScript: script, characters })
      });
      const data = await res.json();
      if (data.panels) {
        saveToHistory(pages);
        const newPanels: Panel[] = data.panels.map((p: any) => ({
          ...p,
          id: genId(),
          status: 'idle',
          textElements: p.textElements?.map((te: any) => ({ ...te, id: genId(), x: 50, y: 20 })) || []
        }));
        
        // Add to active page
        setPages(prev => prev.map((pg, i) => i === activePageIndex 
          ? { ...pg, panels: [...pg.panels, ...newPanels] } 
          : pg
        ));
      }
    } catch (err) {
      console.error("Synthesis failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [pages, characters, activePageIndex, saveToHistory]);

  return {
    pages, activePageIndex, activePage, selectedPanelId, selectedPanel, 
    characters, studioSettings, setStudioSettings, title, setTitle, 
    setSelectedPanelId,
    updatePanel, addPanel, deletePanel, duplicatePanel, generatePanelImage, 
    addPage, setActivePageIndex, insertPanelAfter, addTextElement,
    draftPanels, addDraftPanel, setPages, setCharacters,
    saveToCloud, isSaving, lastSaved, storyId,
    undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0,
    synthesizeStory
  };
}
