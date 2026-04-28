'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Upload, Sparkles, RefreshCw, Check, Camera, Search, ShieldCheck, BookOpen } from 'lucide-react';
import { Character } from '@/types/comic';

interface CharacterForgeModalProps {
  isOpen: boolean;
  initialData?: Character | null;
  onClose: () => void;
  onSave: (character: Character) => void;
  t: (key: string) => string;
}

export function CharacterForgeModal({ isOpen, initialData, onClose, onSave, t }: CharacterForgeModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Protagonist');
  const [description, setDescription] = useState('');
  const [promptBase, setPromptBase] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // -- MARVEL INTEGRATION STATE --
  const [marvelSearch, setMarvelSearch] = useState('');
  const [marvelResults, setMarvelResults] = useState<any[]>([]);
  const [isSearchingMarvel, setIsSearchingMarvel] = useState(false);
  const [activeTab, setActiveTab] = useState<'custom' | 'marvel'>('custom');
  const [marvelError, setMarvelError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setRole(initialData.role);
      setDescription(initialData.description);
      setPromptBase(initialData.promptBase || '');
      setPreview(initialData.imageUrl || null);
    } else {
      setName('');
      setRole('Protagonist');
      setDescription('');
      setPreview(null);
    }
  }, [initialData, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const forgeDescription = async () => {
    if (!preview) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/describe-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [preview] }),
      });
      const data = await res.json();
      if (data.description) {
        setDescription(data.description);
      }
    } catch (err) {
      console.error('Forge failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const searchMarvel = async () => {
    if (!marvelSearch) return;
    setIsSearchingMarvel(true);
    setMarvelError(null);
    try {
      const res = await fetch('/api/marvel/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameStartsWith: marvelSearch }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'The Marvel Archive service is currently unreachable (502). Please try again later.');
      }

      // RapidAPI Marvel usually returns an array directly or inside data.data.results
      const results = data.data?.results || data.results || data || [];
      setMarvelResults(Array.isArray(results) ? results : []);
    } catch (err: any) {
      console.error('Marvel search failed:', err);
      setMarvelError(err.message || 'Service Interruption Detected.');
    } finally {
      setIsSearchingMarvel(false);
    }
  };

  const importMarvelCharacter = (mChar: any) => {
    setName(mChar.name);
    // Construct description from Marvel bio
    setDescription(mChar.description || `The iconic Marvel character ${mChar.name}.`);
    // RapidAPI/Marvel images are usually thumbnail.path + '.' + thumbnail.extension
    const imgUrl = mChar.thumbnail ? `${mChar.thumbnail.path}.${mChar.thumbnail.extension}` : '';
    setPreview(imgUrl);
    setPromptBase(`${mChar.name}, high-contrast comic style, detailed suit`);
    setActiveTab('custom');
  };

  const handleSave = () => {
    if (!name) return;
    onSave({
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      name,
      role,
      description,
      promptBase,
      imageUrl: preview || '',
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="relative w-full max-w-4xl bg-[#080808] border-r-8 border-b-8 border-[var(--accent)] shadow-[20px_20px_0_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          >
            {/* INKED HEADER */}
             <div className="p-10 border-b border-white/5 flex items-center justify-between bg-black relative">
                <div className="absolute top-0 left-0 w-32 h-1 bg-[var(--accent)]" />
                <div className="flex items-center gap-12">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white flex items-center justify-center rotate-[-3deg] shadow-[6px_6px_0_var(--accent)]">
                         <User className="text-black" size={32} />
                      </div>
                       <div>
                         <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-white italic">Identity_Forge</h2>
                         <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em]">{t('visual_signature')}</p>
                      </div>
                   </div>

                   <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                      <button 
                        onClick={() => setActiveTab('custom')}
                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'custom' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        Custom_Build
                      </button>
                      <button 
                        onClick={() => setActiveTab('marvel')}
                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'marvel' ? 'bg-rose-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        Marvel_Registry
                      </button>
                   </div>
                </div>
                <button onClick={onClose} className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-600 transition-all">
                  <X size={24} className="text-white" />
                </button>
             </div>

             <div className="flex-1 overflow-auto p-12">
               {activeTab === 'custom' ? (
                 <div className="flex gap-12">
                    {/* Left Pod: Visual Logic */}
                    <div className="w-64 space-y-6">
                       <div className="aspect-[3/4] w-full bg-black border-4 border-white/5 relative group overflow-hidden">
                          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                          
                          {preview ? (
                             <img src={preview} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" alt="Preview" />
                          ) : (
                             <label className="absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-all text-white/20">
                                <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center">
                                   <Camera size={32} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">Input_Source</span>
                                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                             </label>
                          )}
                          
                          {/* Corner brackets for tech feel */}
                          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[var(--accent)] opacity-40" />
                          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[var(--accent)] opacity-40" />
                       </div>

                       <button 
                         disabled={!preview || isGenerating}
                         onClick={forgeDescription}
                         className="w-full py-5 bg-black text-[var(--accent)] border-2 border-[var(--accent)] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-[var(--accent)] hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-10 shadow-[6px_6px_0_rgba(255,77,0,0.2)]"
                       >
                          {isGenerating ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          Reverse_Engineer
                       </button>
                    </div>

                    {/* Right Pod: Narrative Metadata */}
                    <div className="flex-1 space-y-8">
                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Alias_System</label>
                             <input 
                                value={name} onChange={e => setName(e.target.value)}
                                placeholder="DESIGNATION_X"
                                className="w-full bg-[#111] border-b-4 border-white/5 p-5 text-sm font-black text-white uppercase outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-20"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Operational_Role</label>
                             <select 
                                value={role} onChange={e => setRole(e.target.value)}
                                className="w-full bg-[#111] border-b-4 border-white/5 p-5 text-sm font-black text-white uppercase outline-none appearance-none cursor-pointer focus:border-[var(--accent)] transition-all"
                             >
                                <option>Protagonist</option>
                                <option>Antagonist</option>
                                <option>Tactical_Support</option>
                                <option>Anomaly</option>
                             </select>
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Visual_Signature (Narrative Description)</label>
                          <div className="relative">
                             <textarea 
                                value={description} onChange={e => setDescription(e.target.value)}
                                placeholder="LOG VISUAL PARAMETERS..."
                                className="w-full bg-[#111] border border-white/5 p-6 text-xs font-bold font-mono text-white outline-none focus:border-[var(--accent)] transition-all resize-none leading-relaxed min-h-[140px]"
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">AI_Core_Signature (LoRA / Identity String)</label>
                          <div className="relative">
                             <input 
                                value={promptBase} onChange={e => setPromptBase(e.target.value)}
                                placeholder="PROMPT KEYWORDS (e.g. agent_nova_v2, chrome_visor, noir_trench)..."
                                className="w-full bg-[#111] border-b-4 border-[var(--accent)]/20 p-5 text-sm font-black text-white uppercase outline-none focus:border-[var(--accent)] transition-all placeholder:opacity-20"
                             />
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                             <p className="text-[8px] text-white/20 font-bold uppercase tracking-[0.2em]">Ensuring visual continuity across narrative cycles</p>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="flex flex-col h-full space-y-8">
                    <div className="flex gap-4">
                       <div className="flex-1 relative">
                          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                          <input 
                            value={marvelSearch}
                            onChange={(e) => setMarvelSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && searchMarvel()}
                            placeholder="SEARCH MARVEL ARCHIVES (e.g. Spider-Man, Wolverine)..."
                            className="w-full bg-black border-2 border-white/5 p-6 pl-16 text-sm font-black text-white uppercase outline-none focus:border-rose-600 transition-all placeholder:opacity-10"
                          />
                       </div>
                       <button 
                         onClick={searchMarvel}
                         disabled={isSearchingMarvel}
                         className="px-10 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all flex items-center gap-3"
                       >
                          {isSearchingMarvel ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                          Initialize_Search
                       </button>
                    </div>

                    <div className="flex-1 grid grid-cols-3 gap-6 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-rose-600/20">
                       {marvelError ? (
                         <div className="col-span-3 flex flex-col items-center justify-center py-24 bg-rose-600/5 border border-rose-600/20 rounded-3xl gap-6 text-center px-12">
                            <div className="w-16 h-16 bg-rose-600/10 rounded-full flex items-center justify-center text-rose-600 animate-pulse">
                               <X size={32} />
                            </div>
                            <div className="space-y-2">
                               <h4 className="text-[14px] font-black uppercase text-rose-600 tracking-widest">External_Service_Failure</h4>
                               <p className="text-[10px] font-bold text-white/40 uppercase leading-relaxed max-w-md">
                                  {marvelError}
                               </p>
                            </div>
                            <button 
                              onClick={() => setActiveTab('custom')}
                              className="px-8 py-3 bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                            >
                               Use_Custom_Build_Instead
                            </button>
                         </div>
                       ) : marvelResults.length > 0 ? (
                         marvelResults.map((mChar) => (
                           <motion.div 
                             key={mChar.id}
                             whileHover={{ y: -5 }}
                             onClick={() => importMarvelCharacter(mChar)}
                             className="group bg-white/5 border border-white/5 p-4 rounded-2xl cursor-pointer hover:border-rose-600/50 transition-all flex flex-col gap-4"
                           >
                              <div className="aspect-square bg-black rounded-xl overflow-hidden relative">
                                 <img 
                                   src={mChar.thumbnail ? `${mChar.thumbnail.path}.${mChar.thumbnail.extension}` : ''} 
                                   className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                   alt={mChar.name}
                                 />
                                 <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                                 <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    <ShieldCheck size={12} className="text-rose-600" />
                                    <span className="text-[8px] font-black uppercase text-white/60">Marvel_Official</span>
                                 </div>
                              </div>
                              <div className="flex flex-col">
                                 <h4 className="text-[12px] font-black text-white group-hover:text-rose-500 transition-colors uppercase truncate">{mChar.name}</h4>
                                 <p className="text-[8px] text-white/30 uppercase tracking-widest mt-1 line-clamp-2">{mChar.description || 'No database bio available.'}</p>
                              </div>
                           </motion.div>
                         ))
                       ) : (
                         <div className="col-span-3 flex flex-col items-center justify-center py-24 opacity-20 gap-6">
                            <BookOpen size={64} />
                            <p className="text-[10px] font-black uppercase tracking-[0.5em]">Waiting_For_Input...</p>
                         </div>
                       )}
                    </div>
                 </div>
               )}
             </div>

            {/* FOUNDRY ACTION BAR */}
            <div className="p-10 bg-black border-t-2 border-white/5 flex justify-end items-center gap-8">
               <div className="flex-1 flex items-center gap-4">
                  <div className="h-[2px] flex-1 bg-white/5" />
                  <span className="text-[8px] font-black text-white/10 tracking-[1em] uppercase">Auth_Identity</span>
               </div>
               <button onClick={onClose} className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all">Abort</button>
               <button 
                 onClick={handleSave}
                 disabled={!name}
                 className="px-16 py-6 bg-white text-black text-[12px] font-black uppercase tracking-[0.5em] hover:bg-[var(--accent)] hover:text-white transition-all shadow-[8px_8px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-10"
               >
                  {initialData ? 'Update_Matrix' : 'Finalize_Casting'}
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
