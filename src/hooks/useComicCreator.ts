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
  });

  const genId = () => Math.random().toString(36).substr(2, 9);

  const activePage = pages[activePageIndex];
  const selectedPanel = 
    activePage.panels.find(p => p.id === selectedPanelId) || 
    draftPanels.find(p => p.id === selectedPanelId);

  const updatePanel = useCallback((id: string, updates: Partial<Panel>) => {
    setPages(prev => prev.map(pg => ({
      ...pg,
      panels: pg.panels.map(p => p.id === id ? { ...p, ...updates } : p)
    })));
    setDraftPanels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const addPanel = useCallback((size: PanelSize = 'medium') => {
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
  }, [activePageIndex]);

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
    setPages(prev => prev.map(pg => ({
      ...pg,
      panels: pg.panels.filter(p => p.id !== id)
    })));
    setDraftPanels(prev => prev.filter(p => p.id !== id));
    setSelectedPanelId(null);
  }, []);

  const duplicatePanel = useCallback((panel: Panel) => {
    const id = genId();
    const copy = { ...panel, id, status: 'idle' as const };
    setPages(prev => prev.map((pg, i) => i === activePageIndex 
      ? { ...pg, panels: [...pg.panels, copy] } 
      : pg
    ));
    setSelectedPanelId(id);
  }, [activePageIndex]);

  const addTextElement = useCallback((panelId: string, x: number, y: number) => {
    const newEl: TextElement = { id: genId(), text: 'Double click to edit', x, y, type: 'speech', fontSize: 16, color: '#000000' };
    setPages(prev => prev.map(pg => ({
      ...pg,
      panels: pg.panels.map(p => p.id === panelId ? { ...p, textElements: [...p.textElements, newEl] } : p)
    })));
    setDraftPanels(prev => prev.map(p => p.id === panelId ? { ...p, textElements: [...p.textElements, newEl] } : p));
  }, []);

  const generatePanelImage = useCallback(async (panelId: string) => {
    updatePanel(panelId, { status: 'loading' });
    setTimeout(() => updatePanel(panelId, { status: 'success', image: `https://picsum.photos/seed/${panelId}/800/600` }), 2000);
  }, [updatePanel]);

  const addPage = useCallback(() => {
    const newPage: ComicPage = { id: genId(), title: `Page ${pages.length + 1}`, panels: [] };
    setPages(prev => [...prev, newPage]);
    setActivePageIndex(pages.length);
  }, [pages.length]);

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
  }, [activePageIndex]);

  return {
    pages, activePageIndex, activePage, selectedPanelId, selectedPanel, 
    characters, studioSettings, setStudioSettings, title, setTitle, 
    setSelectedPanelId,
    updatePanel, addPanel, deletePanel, duplicatePanel, generatePanelImage, 
    addPage, setActivePageIndex, insertPanelAfter, addTextElement,
    draftPanels, addDraftPanel, setPages, setCharacters,
    saveToCloud, isSaving, lastSaved, storyId
  };
}
