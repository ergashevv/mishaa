'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { Zap, Search, Swords, Users, RefreshCw, X, Check, Star, Crosshair } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

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
  const [lang, setLang] = useState<Lang>('en');
  const tr = translations[lang].superheroes;

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    const timer =
      savedLang && translations[savedLang]
        ? window.setTimeout(() => setLang((c) => (savedLang !== c ? savedLang : c)), 0)
        : undefined;
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => {
      window.removeEventListener('langChange', onLang as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

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

  const searchSeq = useRef(new Map<(res: Superhero[]) => void, number>());

  const searchHero = async (query: string, setter: (res: Superhero[]) => void) => {
    const seq = (searchSeq.current.get(setter) ?? 0) + 1;
    searchSeq.current.set(setter, seq);
    if (!query || query.length < 2) {
      setter([]);
      return;
    }
    try {
      const res = await fetch('/api/superhero/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameStartsWith: query }),
      });
      const data = await res.json();
      if (searchSeq.current.get(setter) === seq) setter(data.results || []);
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
        <div className="flex justify-between font-mono text-[10px] tracking-wide text-white/70">
          <span>{label}</span>
          <span className="text-white/95">{num}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
          <m.div
            initial={{ width: 0 }}
            animate={{ width: `${num}%` }}
            transition={{ duration: 0.36, ease: 'easeOut' }}
            className={`h-full rounded-full ${color}`}
          />
        </div>
      </div>
    );
  };

  const renderHeroListItem = (h: Superhero, onClick: () => void, selected: boolean = false) => (
     <button key={h.id} onClick={onClick} className={`flex w-full items-center gap-4 rounded-btn border p-3 text-left transition-colors duration-150 ${selected ? 'border-accent bg-accent-tint' : 'border-line bg-card hover:border-line-strong hover:bg-card-hov'}`}>
        <img src={h.image.url} className="h-10 w-10 rounded-cover object-cover" alt={h.name} />
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold text-fg">{h.name}</div>
          <div className="ic-eyebrow mt-0.5">{tr.pwrAbbrev}: {calculateTotalPower(h.powerstats)}</div>
        </div>
        {selected && <Check size={14} className="text-accent-text" />}
     </button>
  );

  const renderHeroCard = (hero: Superhero, compact = false) => (
    <div className={`group relative overflow-hidden rounded-card border border-line bg-card ${compact ? 'aspect-[3/4]' : 'aspect-square md:aspect-[4/5]'}`}>
       <img src={hero.image.url} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" alt={hero.name} />
       <div className="absolute inset-0 z-10" style={{ backgroundImage: 'var(--scrim-strong)' }} />
       <div className="absolute inset-0 z-20 p-4 sm:p-6 flex flex-col justify-between">
          <div className="ic-score ic-score--oncover self-end">
             {tr.pwrAbbrev}: {calculateTotalPower(hero.powerstats)}
          </div>
          <div className="space-y-3">
             <div>
               <h3 className="ic-display text-xl text-white sm:text-2xl">{hero.name}</h3>
               <p className="font-mono text-[10px] tracking-wide text-white/70">{hero.biography.publisher}</p>
             </div>
             {!compact && (
               <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/15 pt-2">
                {renderStatBar(tr.statInt, hero.powerstats.intelligence, 'bg-info')}
                {renderStatBar(tr.statStr, hero.powerstats.strength, 'bg-danger')}
                {renderStatBar(tr.statSpd, hero.powerstats.speed, 'bg-warning')}
                {renderStatBar(tr.statCmb, hero.powerstats.combat, 'bg-success')}
               </div>
             )}
          </div>
       </div>
    </div>
  );

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh bg-app text-fg">
       <Navbar />
       <div className="pt-nav-catalog">
       <div className="wrap max-w-7xl space-y-12 py-12 sm:py-14">
          {/* Header */}
          <div className="text-center space-y-4">
             <div className="inline-flex items-center gap-2">
                <Zap size={14} className="text-accent" />
                <span className="ic-eyebrow">{tr.badge}</span>
             </div>
             <h1 className="ic-display text-4xl md:text-5xl">{tr.title}</h1>
             <p className="mx-auto max-w-xl text-sm text-fg-secondary">{tr.intro}</p>
          </div>

          {/* Navigation */}
          <div className="ic-tabs justify-center">
             {[
               { id: 'home' as const, icon: Star, label: tr.tabHome },
               { id: 'arena' as const, icon: Swords, label: tr.tabArena },
               { id: 'team' as const, icon: Users, label: tr.tabTeam }
             ].map((tabDef) => (
               <button
                 key={tabDef.id}
                 onClick={() => setActiveTab(tabDef.id)}
                 className={`ic-tab flex items-center gap-2 ${activeTab === tabDef.id ? 'is-active' : ''}`}
               >
                 <tabDef.icon size={16} className={activeTab === tabDef.id ? 'text-accent' : ''} /> {tabDef.label}
               </button>
             ))}
          </div>

          {/* TAB CONTENT */}
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <m.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="space-y-6">
                       <h2 className="ic-display border-l-2 border-accent pl-4 text-2xl">{tr.heroOfCycle}</h2>
                       {loadingRandom ? (
                         <div className="sk flex aspect-[4/5] items-center justify-center rounded-card">
                           <RefreshCw className="animate-spin text-fg-muted" size={32} />
                         </div>
                       ) : randomHero ? (
                         renderHeroCard(randomHero)
                       ) : (
                         <div className="flex aspect-[4/5] items-center justify-center rounded-card border border-line bg-card text-fg-muted">{tr.loadFailed}</div>
                       )}
                       <button onClick={fetchRandomHero} disabled={loadingRandom} className="ic-btn ic-btn--secondary ic-btn--md ic-btn--block">
                         <RefreshCw size={14} className={loadingRandom ? "animate-spin" : ""} /> {tr.newRandomPick}
                       </button>
                    </div>
                    <div className="space-y-6 rounded-card border border-line bg-card p-8">
                       <h3 className="ic-eyebrow text-accent-text">{tr.dbOverview}</h3>
                       <p className="text-sm leading-relaxed text-fg-secondary">
                         {tr.dbBody}
                       </p>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-btn border border-line-subtle bg-inset p-4 text-center">
                             <div className="ic-display text-3xl text-fg">731</div>
                             <div className="ic-eyebrow mt-1">{tr.totalEntries}</div>
                          </div>
                          <div className="rounded-btn border border-line-subtle bg-inset p-4 text-center">
                             <div className="ic-display text-3xl text-fg">6</div>
                             <div className="ic-eyebrow mt-1">{tr.powerMetricsShort}</div>
                          </div>
                       </div>
                    </div>
                 </div>
              </m.div>
            )}

            {activeTab === 'arena' && (
              <m.div key="arena" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                 <div className="text-center">
                    <h2 className="ic-display text-3xl text-fg">{tr.combatSim}</h2>
                    <p className="mt-2 text-sm text-fg-muted">{tr.combatSub}</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center relative">
                    {/* Fighter A */}
                    <div className="space-y-4">
                       <div className="relative">
                          <div className="ic-input-wrap has-icon">
                            <Search size={16} />
                            <input
                              value={arenaSearchA} onChange={e => { setArenaSearchA(e.target.value); searchHero(e.target.value, setSearchA_Results); }}
                              placeholder={tr.searchFighterA}
                              className="ic-input"
                            />
                          </div>
                          {searchA_Results.length > 0 && !fighterA && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto rounded-card border border-line bg-raised p-1 shadow-[var(--shadow-lg)]">
                               {searchA_Results.map(h => renderHeroListItem(h, () => { setFighterA(h); setSearchA_Results([]); setArenaSearchA(''); }))}
                            </div>
                          )}
                       </div>
                       {!arenaSearchA && searchA_Results.length === 0 && !fighterA && featuredHeroes.length > 0 && (
                          <div className="mt-4 flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-2">
                             <div className="ic-eyebrow mb-2 text-accent-text">{tr.suggestedEntities}</div>
                             {featuredHeroes.map(h => renderHeroListItem(h, () => setFighterA(h)))}
                          </div>
                       )}
                       {fighterA ? (
                         <div className="relative">
                            <button onClick={() => { setFighterA(null); setWinner(null); }} className="ic-iconbtn ic-iconbtn--sm ic-iconbtn--solid absolute top-2 right-2 z-30"><X size={14}/></button>
                            {renderHeroCard(fighterA)}
                         </div>
                       ) : (
                         <div className="flex aspect-[4/5] flex-col items-center justify-center rounded-card border border-dashed border-line bg-inset text-fg-muted">
                            <Crosshair size={48} className="mb-4 opacity-50" />
                            <span className="ic-eyebrow">{tr.awaitingEntity1}</span>
                         </div>
                       )}
                    </div>

                    {/* VS BADGE */}
                    <div className="flex flex-col items-center gap-6 py-8">
                       <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-on-accent">
                          <span className="ic-display text-xl">VS</span>
                       </div>
                       <button
                         onClick={startBattle}
                         disabled={!fighterA || !fighterB}
                         className="ic-btn ic-btn--primary ic-btn--lg"
                       >
                         {tr.simulate}
                       </button>
                    </div>

                    {/* Fighter B */}
                    <div className="space-y-4">
                       <div className="relative">
                          <div className="ic-input-wrap has-icon">
                            <Search size={16} />
                            <input
                              value={arenaSearchB} onChange={e => { setArenaSearchB(e.target.value); searchHero(e.target.value, setSearchB_Results); }}
                              placeholder={tr.searchFighterB}
                              className="ic-input"
                            />
                          </div>
                          {searchB_Results.length > 0 && !fighterB && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto rounded-card border border-line bg-raised p-1 shadow-[var(--shadow-lg)]">
                               {searchB_Results.map(h => renderHeroListItem(h, () => { setFighterB(h); setSearchB_Results([]); setArenaSearchB(''); }))}
                            </div>
                          )}
                       </div>
                       {!arenaSearchB && searchB_Results.length === 0 && !fighterB && featuredHeroes.length > 0 && (
                          <div className="mt-4 flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-2">
                             <div className="ic-eyebrow mb-2 text-accent-text">{tr.suggestedEntities}</div>
                             {featuredHeroes.map(h => renderHeroListItem(h, () => setFighterB(h)))}
                          </div>
                       )}
                       {fighterB ? (
                         <div className="relative">
                            <button onClick={() => { setFighterB(null); setWinner(null); }} className="ic-iconbtn ic-iconbtn--sm ic-iconbtn--solid absolute top-2 right-2 z-30"><X size={14}/></button>
                            {renderHeroCard(fighterB)}
                         </div>
                       ) : (
                         <div className="flex aspect-[4/5] flex-col items-center justify-center rounded-card border border-dashed border-line bg-inset text-fg-muted">
                            <Crosshair size={48} className="mb-4 opacity-50" />
                            <span className="ic-eyebrow">{tr.awaitingEntity2}</span>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Results Banner */}
                 <AnimatePresence>
                   {winner && (
                     <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 rounded-card border border-line bg-accent-tint p-8 text-center">
                        <h3 className="ic-display text-3xl text-fg">
                          {winner === 'draw' ? tr.stalemate : `${tr.victoryPrefix} ${winner.name}`}
                        </h3>
                        {winner !== 'draw' && <p className="ic-eyebrow text-accent-text">{tr.victorySubline}</p>}
                     </m.div>
                   )}
                 </AnimatePresence>
              </m.div>
            )}

            {activeTab === 'team' && (
              <m.div key="team" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                 <div className="flex flex-col md:flex-row gap-8 justify-between items-end border-b border-line pb-8">
                    <div>
                      <h2 className="ic-display text-3xl text-fg">{tr.squadTitle}</h2>
                      <p className="mt-2 text-sm text-fg-muted">{tr.squadSub}</p>
                    </div>
                    <div className="rounded-card border border-line bg-card px-8 py-4 text-center">
                       <div className="ic-display text-2xl text-accent-text">{teamPower}</div>
                       <div className="ic-eyebrow mt-1">{tr.totalSquadPower}</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[0,1,2,3,4].map(idx => {
                       const member = team[idx];
                       return member ? (
                         <div key={idx} className="relative group">
                           <button onClick={() => setTeam(team.filter((_, i) => i !== idx))} className="ic-iconbtn ic-iconbtn--sm ic-iconbtn--solid absolute top-2 right-2 z-30 pointer-fine:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><X size={12}/></button>
                           {renderHeroCard(member, true)}
                         </div>
                       ) : (
                         <div key={idx} className="flex aspect-[3/4] flex-col items-center justify-center rounded-card border border-dashed border-line bg-inset text-fg-muted">
                            <span className="ic-eyebrow">{tr.emptySlot}</span>
                         </div>
                       );
                    })}
                 </div>

                 <div className="max-w-xl mx-auto space-y-4">
                    <div className="ic-input-wrap has-icon">
                       <Search size={16} />
                       <input
                         value={teamSearch} onChange={e => { setTeamSearch(e.target.value); searchHero(e.target.value, setTeamSearchResults); }}
                         placeholder={tr.searchRecruits}
                         className="ic-input"
                         disabled={team.length >= 5}
                       />
                    </div>

                    {!teamSearch && teamSearchResults.length === 0 && featuredHeroes.length > 0 && team.length < 5 && (
                       <div className="mt-4">
                          <div className="ic-eyebrow mb-4 text-accent-text">{tr.topDraftPicks}</div>
                          <div className="grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
                             {featuredHeroes.map(h => renderHeroListItem(h, () => {
                                if (team.find(t => t.id === h.id)) setTeam(team.filter(t => t.id !== h.id));
                                else setTeam([...team, h]);
                             }, !!team.find(t => t.id === h.id)))}
                          </div>
                       </div>
                    )}

                    {teamSearchResults.length > 0 && team.length < 5 && (
                       <div className="mt-4 grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
                          {teamSearchResults.map(h => renderHeroListItem(h, () => {
                              if (team.find(t => t.id === h.id)) setTeam(team.filter(t => t.id !== h.id));
                              else setTeam([...team, h]);
                              setTeamSearchResults([]); setTeamSearch('');
                          }, !!team.find(t => t.id === h.id)))}
                       </div>
                    )}
                 </div>
              </m.div>
            )}
          </AnimatePresence>
       </div>
       </div>
    </div>
    </LazyMotion>
  );
}
