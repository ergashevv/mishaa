'use client';

/** Superheroes dashboard — rebuilt in the Bold Pop Zine language. Reuses only the API calls + logic. */

import React, { useState, useEffect, useRef } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { Zap, Search, Swords, Users, RefreshCw, X, Check, Star, Crosshair } from 'lucide-react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

type PowerStats = { intelligence: string; strength: string; speed: string; durability: string; power: string; combat: string };
type Superhero = { id: string; name: string; powerstats: PowerStats; biography: { 'full-name': string; alignment: string; publisher: string }; appearance: { race: string }; image: { url: string } };

const getStatValue = (val: string) => (val === 'null' ? 0 : parseInt(val, 10));
const calculateTotalPower = (s: PowerStats) => getStatValue(s.intelligence) + getStatValue(s.strength) + getStatValue(s.speed) + getStatValue(s.durability) + getStatValue(s.power) + getStatValue(s.combat);
const ZINPUT = 'w-full rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] py-3 pl-11 pr-4 text-[15px] font-bold text-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)] placeholder:font-normal placeholder:text-[var(--z-ink-2)] focus:outline-none';

export default function SuperheroesDashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'arena' | 'team'>('home');
  const [randomHero, setRandomHero] = useState<Superhero | null>(null);
  const [loadingRandom, setLoadingRandom] = useState(true);
  const [fighterA, setFighterA] = useState<Superhero | null>(null);
  const [fighterB, setFighterB] = useState<Superhero | null>(null);
  const [arenaSearchA, setArenaSearchA] = useState('');
  const [arenaSearchB, setArenaSearchB] = useState('');
  const [searchA_Results, setSearchA_Results] = useState<Superhero[]>([]);
  const [searchB_Results, setSearchB_Results] = useState<Superhero[]>([]);
  const [winner, setWinner] = useState<Superhero | null | 'draw'>(null);
  const [team, setTeam] = useState<Superhero[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamSearchResults, setTeamSearchResults] = useState<Superhero[]>([]);
  const [featuredHeroes, setFeaturedHeroes] = useState<Superhero[]>([]);
  const [lang, setLang] = useState<Lang>('en');
  const tr = translations[lang].superheroes;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  useEffect(() => { void fetchRandomHero(); void fetchFeaturedHeroes(); }, []);

  const fetchFeaturedHeroes = async () => { try { const d = await fetch('/api/superhero/random?count=10').then((r) => r.json()); if (d.results) setFeaturedHeroes(d.results); } catch (e) { console.error(e); } };
  const fetchRandomHero = async () => { setLoadingRandom(true); try { const d = await fetch('/api/superhero/random?count=1').then((r) => r.json()); if (d.results?.length) setRandomHero(d.results[0]); } catch (e) { console.error(e); } setLoadingRandom(false); };

  const searchSeq = useRef(new Map<(res: Superhero[]) => void, number>());
  const searchHero = async (query: string, setter: (res: Superhero[]) => void) => {
    const seq = (searchSeq.current.get(setter) ?? 0) + 1; searchSeq.current.set(setter, seq);
    if (!query || query.length < 2) { setter([]); return; }
    try { const d = await fetch('/api/superhero/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nameStartsWith: query }) }).then((r) => r.json()); if (searchSeq.current.get(setter) === seq) setter(d.results || []); } catch (e) { console.error(e); }
  };

  const startBattle = () => { if (!fighterA || !fighterB) return; const pA = calculateTotalPower(fighterA.powerstats); const pB = calculateTotalPower(fighterB.powerstats); setWinner(pA > pB ? fighterA : pB > pA ? fighterB : 'draw'); };
  const teamPower = team.reduce((acc, h) => acc + calculateTotalPower(h.powerstats), 0);

  const StatBar = ({ label, val, color }: { label: string; val: string; color: string }) => {
    const num = getStatValue(val);
    return (
      <div className="w-full space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-white/80" style={{ fontFamily: 'var(--font-zine-mono)' }}><span>{label}</span><span>{num}</span></div>
        <div className="h-[6px] w-full overflow-hidden rounded-full border border-black/40 bg-white/20"><m.div initial={{ width: 0 }} animate={{ width: `${num}%` }} transition={{ duration: 0.36, ease: 'easeOut' }} className="h-full" style={{ background: color }} /></div>
      </div>
    );
  };

  const HeroList = (h: Superhero, onClick: () => void, selected = false) => (
    <button key={h.id} onClick={onClick} className="z-box z-pop flex w-full items-center gap-3 p-2.5 text-left" style={selected ? { background: 'var(--z-yellow)' } : undefined}>
      <img src={h.image.url} className="h-10 w-10 shrink-0 rounded-[5px] border-2 border-[var(--z-ink)] object-cover" alt={h.name} />
      <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-extrabold text-[var(--z-ink)]">{h.name}</div><div className="text-[10px] font-bold text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{tr.pwrAbbrev}: {calculateTotalPower(h.powerstats)}</div></div>
      {selected ? <Check size={16} strokeWidth={3} /> : null}
    </button>
  );

  const HeroCard = (hero: Superhero, compact = false) => (
    <div className={`z-box relative overflow-hidden ${compact ? 'aspect-[3/4]' : 'aspect-square md:aspect-[4/5]'}`}>
      <img src={hero.image.url} className="h-full w-full object-cover" alt={hero.name} />
      <div className="absolute inset-0 z-10" style={{ backgroundImage: 'linear-gradient(180deg, transparent 0%, rgba(8,6,3,0.55) 55%, rgba(8,6,3,0.95) 100%)' }} />
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-5">
        <span className="z-tag z-tag--yellow self-end !text-[10px]">{tr.pwrAbbrev} {calculateTotalPower(hero.powerstats)}</span>
        <div className="space-y-3">
          <div><h3 className="z-display text-[clamp(1.3rem,3vw,2rem)] leading-[0.9] text-white">{hero.name}</h3><p className="text-[10px] font-bold text-white/70" style={{ fontFamily: 'var(--font-zine-mono)' }}>{hero.biography.publisher}</p></div>
          {!compact ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t-2 border-white/25 pt-2">
              <StatBar label={tr.statInt} val={hero.powerstats.intelligence} color="var(--z-blue)" />
              <StatBar label={tr.statStr} val={hero.powerstats.strength} color="var(--z-red)" />
              <StatBar label={tr.statSpd} val={hero.powerstats.speed} color="var(--z-yellow)" />
              <StatBar label={tr.statCmb} val={hero.powerstats.combat} color="var(--z-green)" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const EmptySlot = (label: string, tall = false) => (
    <div className={`z-box flex ${tall ? 'aspect-[4/5]' : 'aspect-[3/4]'} flex-col items-center justify-center border-dashed text-[var(--z-ink-2)]`}>
      <Crosshair size={40} strokeWidth={2} className="mb-3 opacity-50" />
      <span className="z-kicker">{label}</span>
    </div>
  );

  const TABS = [{ id: 'home' as const, icon: Star, label: tr.tabHome }, { id: 'arena' as const, icon: Swords, label: tr.tabArena }, { id: 'team' as const, icon: Users, label: tr.tabTeam }];

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="zine min-h-dvh">
        <ZineNav />
        <div className="z-wrap max-w-7xl space-y-10 py-12">
          <div className="text-center">
            <span className="z-tag z-tag--red inline-flex items-center gap-1.5"><Zap size={13} strokeWidth={2.5} /> {tr.badge}</span>
            <h1 className="z-display mt-4 text-[clamp(2.6rem,7vw,5rem)] leading-[0.8]">{tr.title}</h1>
            <p className="mx-auto mt-3 max-w-xl text-[15px] font-semibold text-[var(--z-ink-2)]">{tr.intro}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="inline-flex items-center gap-2 rounded-[7px] border-[2.5px] border-[var(--z-ink)] px-4 py-2.5 text-[14px] font-extrabold uppercase" style={{ fontFamily: 'var(--font-zine-mono)', background: activeTab === tab.id ? 'var(--z-blue)' : 'var(--z-card)', color: activeTab === tab.id ? '#fff' : 'var(--z-ink)', boxShadow: activeTab === tab.id ? '3px 3px 0 var(--z-ink)' : 'none' }}>
                <tab.icon size={16} strokeWidth={2.5} /> {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <m.div key="home" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.15fr_1fr]">
                  <div className="space-y-5">
                    <h2 className="z-display border-l-4 border-[var(--z-red)] pl-4 text-[1.8rem] leading-[0.9]">{tr.heroOfCycle}</h2>
                    {loadingRandom ? <div className="z-box flex aspect-[4/5] items-center justify-center"><RefreshCw className="animate-spin" size={32} /></div> : randomHero ? HeroCard(randomHero) : <div className="z-box flex aspect-[4/5] items-center justify-center text-[var(--z-ink-2)]">{tr.loadFailed}</div>}
                    <button onClick={fetchRandomHero} disabled={loadingRandom} className="z-btn z-btn--paper w-full"><RefreshCw size={14} className={loadingRandom ? 'animate-spin' : ''} /> {tr.newRandomPick}</button>
                  </div>
                  <div className="z-box space-y-5 p-8" style={{ background: 'var(--z-yellow)' }}>
                    <h3 className="z-kicker text-[var(--z-ink)]">{tr.dbOverview}</h3>
                    <p className="text-[15px] font-semibold leading-relaxed text-[var(--z-ink)]">{tr.dbBody}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="z-box bg-[var(--z-card)] p-4 text-center"><div className="z-display text-[2.4rem] leading-none text-[var(--z-red)]">731</div><div className="z-kicker mt-1 text-[var(--z-ink-2)]">{tr.totalEntries}</div></div>
                      <div className="z-box bg-[var(--z-card)] p-4 text-center"><div className="z-display text-[2.4rem] leading-none text-[var(--z-blue)]">6</div><div className="z-kicker mt-1 text-[var(--z-ink-2)]">{tr.powerMetricsShort}</div></div>
                    </div>
                  </div>
                </div>

                {featuredHeroes.length > 0 ? (
                  <div>
                    <h2 className="z-display -rotate-1 mb-6 inline-block border-[3px] border-[var(--z-ink)] bg-[var(--z-green)] px-3 py-1 text-[clamp(1.6rem,4vw,2.4rem)] leading-[0.82] text-[var(--z-paper)] shadow-[4px_4px_0_var(--z-ink)]">{tr.rosterHeading}</h2>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">{featuredHeroes.slice(0, 5).map((hero, i) => <div key={hero.id}>{HeroCard(hero, i !== 0)}</div>)}</div>
                  </div>
                ) : null}
              </m.div>
            )}

            {activeTab === 'arena' && (
              <m.div key="arena" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-10">
                <div className="text-center"><h2 className="z-display text-[clamp(1.8rem,4vw,3rem)] leading-[0.85]">{tr.combatSim}</h2><p className="mt-2 text-[14px] font-semibold text-[var(--z-ink-2)]">{tr.combatSub}</p></div>
                <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
                  {([[fighterA, setFighterA, arenaSearchA, setArenaSearchA, searchA_Results, setSearchA_Results, tr.searchFighterA, tr.awaitingEntity1], [fighterB, setFighterB, arenaSearchB, setArenaSearchB, searchB_Results, setSearchB_Results, tr.searchFighterB, tr.awaitingEntity2]] as const).map((cfg, ci) => {
                    const [fighter, setFighter, sv, setSv, results, setResults, ph, waiting] = cfg as [Superhero | null, React.Dispatch<React.SetStateAction<Superhero | null>>, string, React.Dispatch<React.SetStateAction<string>>, Superhero[], React.Dispatch<React.SetStateAction<Superhero[]>>, string, string];
                    return (
                      <div key={ci} className={`space-y-4 ${ci === 1 ? 'md:order-3' : ''}`}>
                        <div className="relative">
                          <Search size={16} strokeWidth={2.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--z-ink-2)]" />
                          <input value={sv} onChange={(e) => { setSv(e.target.value); searchHero(e.target.value, setResults); }} placeholder={ph} className={ZINPUT} />
                          {results.length > 0 && !fighter ? <div className="absolute left-0 right-0 top-full z-50 mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] p-1 shadow-[var(--z-sh-lg)]">{results.map((h) => HeroList(h, () => { setFighter(h); setResults([]); setSv(''); }))}</div> : null}
                        </div>
                        {!sv && results.length === 0 && !fighter && featuredHeroes.length > 0 ? <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-1"><div className="z-kicker text-[var(--z-ink-2)]">{tr.suggestedEntities}</div>{featuredHeroes.map((h) => HeroList(h, () => setFighter(h)))}</div> : null}
                        {fighter ? <div className="relative"><button onClick={() => { setFighter(null); setWinner(null); }} className="absolute right-2 top-2 z-30 grid h-8 w-8 place-items-center rounded-[6px] border-2 border-[var(--z-ink)] bg-[var(--z-card)]"><X size={14} strokeWidth={2.5} /></button>{HeroCard(fighter)}</div> : EmptySlot(waiting, true)}
                      </div>
                    );
                  })}
                  <div className="flex flex-col items-center gap-6 py-6 md:order-2">
                    <div className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-[var(--z-ink)] bg-[var(--z-red)] text-white shadow-[4px_4px_0_var(--z-ink)]"><span className="z-display text-[1.4rem]">VS</span></div>
                    <button onClick={startBattle} disabled={!fighterA || !fighterB} className="z-btn z-btn--red" style={!fighterA || !fighterB ? { opacity: 0.5 } : undefined}>{tr.simulate}</button>
                  </div>
                </div>
                <AnimatePresence>{winner ? <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="z-box p-8 text-center" style={{ background: 'var(--z-yellow)' }}><h3 className="z-display text-[clamp(1.6rem,4vw,2.6rem)] leading-[0.9]">{winner === 'draw' ? tr.stalemate : `${tr.victoryPrefix} ${winner.name}`}</h3>{winner !== 'draw' ? <p className="z-kicker mt-2 text-[var(--z-ink-2)]">{tr.victorySubline}</p> : null}</m.div> : null}</AnimatePresence>
              </m.div>
            )}

            {activeTab === 'team' && (
              <m.div key="team" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div><h2 className="z-display text-[clamp(1.8rem,4vw,3rem)] leading-[0.85]">{tr.squadTitle}</h2><p className="mt-1 text-[14px] font-semibold text-[var(--z-ink-2)]">{tr.squadSub}</p></div>
                  <div className="z-box px-8 py-4 text-center" style={{ background: 'var(--z-blue)' }}><div className="z-display text-[2rem] leading-none text-[var(--z-paper)]">{teamPower}</div><div className="z-kicker mt-1 text-[var(--z-paper)]/80">{tr.totalSquadPower}</div></div>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((idx) => { const m2 = team[idx]; return m2 ? <div key={idx} className="group relative"><button onClick={() => setTeam(team.filter((_, i) => i !== idx))} className="absolute right-2 top-2 z-30 grid h-7 w-7 place-items-center rounded-[6px] border-2 border-[var(--z-ink)] bg-[var(--z-card)]"><X size={12} strokeWidth={2.5} /></button>{HeroCard(m2, true)}</div> : <div key={idx} className="z-box flex aspect-[3/4] items-center justify-center border-dashed"><span className="z-kicker text-[var(--z-ink-2)]">{tr.emptySlot}</span></div>; })}
                </div>
                <div className="mx-auto max-w-xl space-y-4">
                  <div className="relative"><Search size={16} strokeWidth={2.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--z-ink-2)]" /><input value={teamSearch} onChange={(e) => { setTeamSearch(e.target.value); searchHero(e.target.value, setTeamSearchResults); }} placeholder={tr.searchRecruits} className={ZINPUT} disabled={team.length >= 5} /></div>
                  {(!teamSearch && teamSearchResults.length === 0 && featuredHeroes.length > 0 && team.length < 5) ? <div><div className="z-kicker mb-3 text-[var(--z-ink-2)]">{tr.topDraftPicks}</div><div className="grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{featuredHeroes.map((h) => HeroList(h, () => setTeam(team.find((x) => x.id === h.id) ? team.filter((x) => x.id !== h.id) : [...team, h]), !!team.find((x) => x.id === h.id)))}</div></div> : null}
                  {(teamSearchResults.length > 0 && team.length < 5) ? <div className="grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{teamSearchResults.map((h) => HeroList(h, () => { setTeam(team.find((x) => x.id === h.id) ? team.filter((x) => x.id !== h.id) : [...team, h]); setTeamSearchResults([]); setTeamSearch(''); }, !!team.find((x) => x.id === h.id)))}</div> : null}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
        <ZineFooter />
      </div>
    </LazyMotion>
  );
}
