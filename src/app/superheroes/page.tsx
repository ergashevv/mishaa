'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Search, Swords, Users, RefreshCw, X, Check, Star, Crosshair, Brain, Activity } from 'lucide-react';
import Image from 'next/image';

type PowerStats = {
  intelligence: string;
  strength: string;
  speed: string;
  durability: string;
  power: string;
  combat: string;
};

type Superhero = {
  id: string;
  name: string;
  powerstats: PowerStats;
  biography: { 'full-name': string; alignment: string; publisher: string };
  appearance: { race: string };
  image: { url: string };
};

const getStatValue = (val: string) => val === 'null' ? 0 : parseInt(val, 10);
const calculateTotalPower = (stats: PowerStats) => {
  return getStatValue(stats.intelligence) +
         getStatValue(stats.strength) +
         getStatValue(stats.speed) +
         getStatValue(stats.durability) +
         getStatValue(stats.power) +
         getStatValue(stats.combat);
};

export default function SuperheroesDashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'arena' | 'team'>('home');
  const [randomHero, setRandomHero] = useState<Superhero | null>(null);
  const [loadingRandom, setLoadingRandom] = useState(true);

  // Arena State
  const [fighterA, setFighterA] = useState<Superhero | null>(null);
  const [fighterB, setFighterB] = useState<Superhero | null>(null);
  const [arenaSearchA, setArenaSearchA] = useState('');
  const [arenaSearchB, setArenaSearchB] = useState('');
  const [searchA_Results, setSearchA_Results] = useState<Superhero[]>([]);
  const [searchB_Results, setSearchB_Results] = useState<Superhero[]>([]);
  const [winner, setWinner] = useState<Superhero | null | 'draw'>(null);

  // Team Builder State
  const [team, setTeam] = useState<Superhero[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamSearchResults, setTeamSearchResults] = useState<Superhero[]>([]);

  const [featuredHeroes, setFeaturedHeroes] = useState<Superhero[]>([]);

  useEffect(() => {
    fetchRandomHero();
    fetchFeaturedHeroes();
  }, []);

  const fetchFeaturedHeroes = async () => {
    try {
      const res = await fetch('/api/superhero/random?count=10');
      const data = await res.json();
      if (data.results) setFeaturedHeroes(data.results);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRandomHero = async () => {
    setLoadingRandom(true);
    try {
      const res = await fetch('/api/superhero/random?count=1');
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setRandomHero(data.results[0]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingRandom(false);
  };

  const searchHero = async (query: string, setter: (res: Superhero[]) => void) => {
    if (!query || query.length < 2) return;
    try {
      const res = await fetch('/api/superhero/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameStartsWith: query }),
      });
      const data = await res.json();
      setter(data.results || []);
    } catch (e) {
      console.error(e);
    }
  };

  const startBattle = () => {
    if (!fighterA || !fighterB) return;
    const pA = calculateTotalPower(fighterA.powerstats);
    const pB = calculateTotalPower(fighterB.powerstats);
    if (pA > pB) setWinner(fighterA);
    else if (pB > pA) setWinner(fighterB);
    else setWinner('draw');
  };

  const teamPower = team.reduce((acc, hero) => acc + calculateTotalPower(hero.powerstats), 0);

  const renderStatBar = (label: string, val: string, color: string) => {
    const num = getStatValue(val);
    return (
      <div className="space-y-1 w-full">
        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-neutral-500 dark:text-white/50">
          <span>{label}</span>
          <span className="text-neutral-800 dark:text-white/80">{num}</span>
        </div>
        <div className="h-1.5 w-full bg-black/[0.04] dark:bg-white/5 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${num}%` }} 
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full ${color}`} 
          />
        </div>
      </div>
    );
  };

  const renderHeroListItem = (h: Superhero, onClick: () => void, selected: boolean = false) => (
     <button key={h.id} onClick={onClick} className={`w-full text-left p-3 flex items-center gap-4 border ${selected ? 'border-[#ff4d00] bg-[#ff4d00]/10' : 'border-neutral-100 dark:border-white/5 bg-[#0a0a0a] hover:border-neutral-300 dark:border-white/20 hover:bg-black/[0.05] dark:hover:bg-black/[0.04] dark:bg-white/5'} transition-all`}>
        <img src={h.image.url} className="w-10 h-10 object-cover rounded" alt={h.name} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase truncate text-white">{h.name}</div>
          <div className="text-[8px] font-bold uppercase text-neutral-500 dark:text-white/40 tracking-widest mt-0.5">PWR: {calculateTotalPower(h.powerstats)}</div>
        </div>
        {selected && <Check size={14} className="text-[#ff4d00]" />}
     </button>
  );

  const renderHeroCard = (hero: Superhero, compact = false) => (
    <div className={`relative bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 overflow-hidden group ${compact ? 'aspect-[3/4]' : 'aspect-square md:aspect-[4/5]'}`}>
       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
       <img src={hero.image.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={hero.name} />
       <div className="absolute inset-0 z-20 p-4 sm:p-6 flex flex-col justify-between">
          <div className="self-end px-3 py-1 bg-black/[0.06] dark:bg-white/10 backdrop-blur-md text-[8px] font-black uppercase tracking-widest border border-neutral-200 dark:border-white/10">
             PWR: {calculateTotalPower(hero.powerstats)}
          </div>
          <div className="space-y-3">
             <div>
               <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white">{hero.name}</h3>
               <p className="text-[10px] font-black text-[#ff4d00] uppercase tracking-widest">{hero.biography.publisher}</p>
             </div>
             {!compact && (
               <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-neutral-200 dark:border-white/10">
                 {renderStatBar('INT', hero.powerstats.intelligence, 'bg-blue-500')}
                 {renderStatBar('STR', hero.powerstats.strength, 'bg-red-500')}
                 {renderStatBar('SPD', hero.powerstats.speed, 'bg-yellow-500')}
                 {renderStatBar('CMB', hero.powerstats.combat, 'bg-green-500')}
               </div>
             )}
          </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#ff4d00]">
       <Navbar />
       <div className="max-w-7xl mx-auto space-y-12 px-4 pt-16 sm:pt-20 pb-20 md:px-12">
          {/* Header */}
          <div className="text-center space-y-4">
             <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff4d00]/10 border border-[#ff4d00]/30 rounded-full">
                <Zap size={14} className="text-[#ff4d00] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4d00]">Global Database</span>
             </div>
             <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">Superhero hub</h1>
             <p className="text-neutral-500 dark:text-white/40 text-sm font-bold uppercase tracking-widest max-w-xl mx-auto">Browse popular heroes, duel in the arena, then save a dream team for your next comic.</p>
          </div>

          {/* Navigation */}
          <div className="flex justify-center gap-4 border-b border-neutral-200 dark:border-white/10 pb-1 overflow-x-auto custom-scrollbar">
             {[
               { id: 'home', icon: Star, label: 'Daily Intel' },
               { id: 'arena', icon: Swords, label: 'Battle Arena' },
               { id: 'team', icon: Users, label: 'Team Builder' }
             ].map(t => (
               <button 
                 key={t.id} 
                 onClick={() => setActiveTab(t.id as any)}
                 className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === t.id ? 'border-[#ff4d00] text-white' : 'border-transparent text-neutral-500 dark:text-white/40 hover:text-neutral-900 dark:hover:text-white'}`}
               >
                 <t.icon size={16} className={activeTab === t.id ? 'text-[#ff4d00]' : ''} /> {t.label}
               </button>
             ))}
          </div>

          {/* TAB CONTENT */}
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="space-y-8">
                       <h2 className="text-2xl font-black uppercase tracking-widest border-l-4 border-[#ff4d00] pl-4">Hero of the cycle</h2>
                       {loadingRandom ? (
                         <div className="aspect-[4/5] bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center animate-pulse">
                           <RefreshCw className="animate-spin text-neutral-400 dark:text-white/20" size={32} />
                         </div>
                       ) : randomHero ? (
                         renderHeroCard(randomHero)
                       ) : (
                         <div className="aspect-[4/5] bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center">Failed to load.</div>
                       )}
                       <button onClick={fetchRandomHero} disabled={loadingRandom} className="w-full py-4 bg-black/[0.04] dark:bg-white/5 hover:bg-black/[0.08] dark:hover:bg-black/[0.06] dark:bg-white/10 border border-neutral-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2">
                         <RefreshCw size={14} className={loadingRandom ? "animate-spin" : ""} /> New random pick
                       </button>
                    </div>
                    <div className="bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 p-8 space-y-6">
                       <h3 className="text-[12px] font-black text-[#ff4d00] uppercase tracking-[0.4em]">Database Overview</h3>
                       <p className="text-neutral-600 dark:text-white/60 leading-relaxed font-bold text-sm">
                         The Superhero Nexus is directly connected to the universal superhero registry, encompassing 731 distinct entities. 
                         You can access their power metrics, true identities, and operational data.
                       </p>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/[0.04] dark:bg-white/5 p-4 border border-neutral-100 dark:border-white/5 text-center">
                             <div className="text-3xl font-black italic">731</div>
                             <div className="text-[8px] font-black uppercase tracking-widest text-neutral-500 dark:text-white/40 mt-1">Total Entries</div>
                          </div>
                          <div className="bg-black/[0.04] dark:bg-white/5 p-4 border border-neutral-100 dark:border-white/5 text-center">
                             <div className="text-3xl font-black italic">6</div>
                             <div className="text-[8px] font-black uppercase tracking-widest text-neutral-500 dark:text-white/40 mt-1">Power Metrics</div>
                          </div>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'arena' && (
              <motion.div key="arena" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                 <div className="text-center">
                    <h2 className="text-3xl font-black uppercase tracking-widest text-white">Combat Simulation</h2>
                    <p className="text-[10px] uppercase font-bold text-neutral-500 dark:text-white/40 tracking-[0.2em] mt-2">Select combatants to calculate win probability</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center relative">
                    {/* Fighter A */}
                    <div className="space-y-4">
                       <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/20" size={16} />
                          <input 
                            value={arenaSearchA} onChange={e => { setArenaSearchA(e.target.value); searchHero(e.target.value, setSearchA_Results); }}
                            placeholder="SEARCH FIGHTER A..." 
                            className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 p-4 pl-12 text-[10px] font-black text-white uppercase outline-none focus:border-[#ff4d00]"
                          />
                          {searchA_Results.length > 0 && !fighterA && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 max-h-60 overflow-y-auto z-50 flex flex-col">
                               {searchA_Results.map(h => renderHeroListItem(h, () => { setFighterA(h); setSearchA_Results([]); setArenaSearchA(''); }))}
                            </div>
                          )}
                       </div>
                       {!arenaSearchA && searchA_Results.length === 0 && !fighterA && featuredHeroes.length > 0 && (
                          <div className="flex flex-col gap-2 mt-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             <div className="text-[8px] font-black uppercase tracking-widest text-[#ff4d00] mb-2">Suggested Entities</div>
                             {featuredHeroes.map(h => renderHeroListItem(h, () => setFighterA(h)))}
                          </div>
                       )}
                       {fighterA ? (
                         <div className="relative">
                            <button onClick={() => { setFighterA(null); setWinner(null); }} className="absolute top-2 right-2 z-30 p-2 bg-red-500 text-white rounded"><X size={14}/></button>
                            {renderHeroCard(fighterA)}
                         </div>
                       ) : (
                         <div className="aspect-[4/5] bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 border-dashed flex flex-col items-center justify-center text-neutral-400 dark:text-white/20">
                            <Crosshair size={48} className="mb-4 opacity-50" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Entity 1</span>
                         </div>
                       )}
                    </div>

                    {/* VS BADGE */}
                    <div className="flex flex-col items-center gap-6 py-8">
                       <div className="w-16 h-16 rounded-full bg-[#ff4d00] flex items-center justify-center shadow-[0_0_40px_rgba(255,77,0,0.4)]">
                          <span className="text-xl font-black italic uppercase">VS</span>
                       </div>
                       <button 
                         onClick={startBattle}
                         disabled={!fighterA || !fighterB}
                         className="px-8 py-4 bg-white text-black text-[12px] font-black uppercase tracking-widest hover:bg-[#ff4d00] hover:text-neutral-900 dark:hover:text-white transition-all disabled:opacity-20 shadow-[4px_4px_0_rgba(255,255,255,0.2)]"
                       >
                         Simulate
                       </button>
                    </div>

                    {/* Fighter B */}
                    <div className="space-y-4">
                       <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/20" size={16} />
                          <input 
                            value={arenaSearchB} onChange={e => { setArenaSearchB(e.target.value); searchHero(e.target.value, setSearchB_Results); }}
                            placeholder="SEARCH FIGHTER B..." 
                            className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 p-4 pl-12 text-[10px] font-black text-white uppercase outline-none focus:border-[#ff4d00]"
                          />
                          {searchB_Results.length > 0 && !fighterB && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 max-h-60 overflow-y-auto z-50 flex flex-col">
                               {searchB_Results.map(h => renderHeroListItem(h, () => { setFighterB(h); setSearchB_Results([]); setArenaSearchB(''); }))}
                            </div>
                          )}
                       </div>
                       {!arenaSearchB && searchB_Results.length === 0 && !fighterB && featuredHeroes.length > 0 && (
                          <div className="flex flex-col gap-2 mt-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             <div className="text-[8px] font-black uppercase tracking-widest text-[#ff4d00] mb-2">Suggested Entities</div>
                             {featuredHeroes.map(h => renderHeroListItem(h, () => setFighterB(h)))}
                          </div>
                       )}
                       {fighterB ? (
                         <div className="relative">
                            <button onClick={() => { setFighterB(null); setWinner(null); }} className="absolute top-2 right-2 z-30 p-2 bg-red-500 text-white rounded"><X size={14}/></button>
                            {renderHeroCard(fighterB)}
                         </div>
                       ) : (
                         <div className="aspect-[4/5] bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 border-dashed flex flex-col items-center justify-center text-neutral-400 dark:text-white/20">
                            <Crosshair size={48} className="mb-4 opacity-50" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Entity 2</span>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Results Banner */}
                 <AnimatePresence>
                   {winner && (
                     <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-8 border border-[#ff4d00] bg-[#ff4d00]/10 text-center space-y-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay" />
                        <h3 className="text-4xl font-black italic uppercase relative z-10">
                          {winner === 'draw' ? 'STALEMATE DETECTED' : `VICTORY: ${winner.name}`}
                        </h3>
                        {winner !== 'draw' && <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4d00] relative z-10">Overwhelming Power Metrics</p>}
                     </motion.div>
                   )}
                 </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'team' && (
              <motion.div key="team" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                 <div className="flex flex-col md:flex-row gap-8 justify-between items-end border-b border-neutral-200 dark:border-white/10 pb-8">
                    <div>
                      <h2 className="text-3xl font-black uppercase tracking-widest">Squad Assembly</h2>
                      <p className="text-[10px] uppercase font-bold text-neutral-500 dark:text-white/40 tracking-[0.2em] mt-2">Form a 5-member elite strike team</p>
                    </div>
                    <div className="bg-black/[0.04] dark:bg-white/5 px-8 py-4 border border-neutral-200 dark:border-white/10 text-center">
                       <div className="text-2xl font-black text-[#ff4d00]">{teamPower}</div>
                       <div className="text-[8px] font-black uppercase tracking-[0.3em] text-neutral-500 dark:text-white/50 mt-1">Total Squad Power</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[0,1,2,3,4].map(idx => {
                       const member = team[idx];
                       return member ? (
                         <div key={idx} className="relative group">
                           <button onClick={() => setTeam(team.filter((_, i) => i !== idx))} className="absolute top-2 right-2 z-30 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                           {renderHeroCard(member, true)}
                         </div>
                       ) : (
                         <div key={idx} className="aspect-[3/4] bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 border-dashed flex flex-col items-center justify-center text-neutral-400 dark:text-white/20">
                            <span className="text-[10px] font-black uppercase tracking-widest">Empty Slot</span>
                         </div>
                       );
                    })}
                 </div>

                 <div className="max-w-xl mx-auto space-y-4">
                    <div className="relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/20" size={16} />
                       <input 
                         value={teamSearch} onChange={e => { setTeamSearch(e.target.value); searchHero(e.target.value, setTeamSearchResults); }}
                         placeholder="SEARCH RECRUITS..." 
                         className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 p-5 pl-12 text-[12px] font-black text-white uppercase outline-none focus:border-[#ff4d00]"
                         disabled={team.length >= 5}
                       />
                    </div>
                    
                    {!teamSearch && teamSearchResults.length === 0 && featuredHeroes.length > 0 && team.length < 5 && (
                       <div className="mt-4">
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#ff4d00] mb-4">Top Draft Picks</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {featuredHeroes.map(h => renderHeroListItem(h, () => {
                                if (team.find(t => t.id === h.id)) setTeam(team.filter(t => t.id !== h.id));
                                else setTeam([...team, h]);
                             }, !!team.find(t => t.id === h.id)))}
                          </div>
                       </div>
                    )}

                    {teamSearchResults.length > 0 && team.length < 5 && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {teamSearchResults.map(h => renderHeroListItem(h, () => {
                              if (team.find(t => t.id === h.id)) setTeam(team.filter(t => t.id !== h.id));
                              else setTeam([...team, h]);
                              setTeamSearchResults([]); setTeamSearch('');
                          }, !!team.find(t => t.id === h.id)))}
                       </div>
                    )}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
       </div>
    </div>
  );
}
