import { createHash } from 'node:crypto';
import type { OrganismEvent } from '../memory/EventSourcing.ts';

export type P49Episode = { id:string; startAt:number; endAt:number; eventIds:string[]; summary:string; salience:number; confidence:number; sources:string[] };
export type P49Belief = { id:string; proposition:string; confidence:number; evidenceIds:string[]; contradictionIds:string[]; updates:number; lastAt:number; };
export interface P49State {
  version:1;
  eventCursor:number;
  seenEventIds:string[];
  journalHash:string;
  eventsIndexed:number;
  episodesCreated:number;
  episodesCompressed:number;
  beliefsReconciled:number;
  contradictionsOpen:number;
  sleepConsolidations:number;
  lastSleepAt:number;
  memoryPressure01:number;
  continuityHealth01:number;
  drift01:number;
  episodes:P49Episode[];
  beliefs:P49Belief[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const norm=(s:string)=>s.toLowerCase().replace(/[^a-zа-яё0-9 ]/gi,' ').replace(/\s+/g,' ').trim();
const toks=(s:string)=>new Set(norm(s).split(' ').filter(Boolean));
const overlapSets=(A:Set<string>,B:Set<string>)=>{if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(1,Math.min(A.size,B.size));};
const overlap=(a:string,b:string)=>overlapSets(toks(a),toks(b));
const hashEvent=(prev:string,e:OrganismEvent)=>createHash('sha256').update(prev+'|'+JSON.stringify({id:e.id,tick:e.tick,type:e.type,payload:e.payload})).digest('hex');

export const defaultP49=():P49State=>({
  version:1,eventCursor:0,seenEventIds:[],journalHash:'GENESIS-P49',eventsIndexed:0,episodesCreated:0,episodesCompressed:0,beliefsReconciled:0,contradictionsOpen:0,
  sleepConsolidations:0,lastSleepAt:0,memoryPressure01:0,continuityHealth01:1,drift01:0,episodes:[],beliefs:[]
});

export class P49TemporalLifeEngine {
  private state=P49State();
  private seenEventIndex = new Set<string>();
  private episodeTokens = new Map<string, Set<string>>();
  restore(raw?:Partial<P49State>|null){ const b=defaultP49(); const r=raw??{}; this.state={...b,...r,
    seenEventIds:Array.isArray(r.seenEventIds)?r.seenEventIds.slice(-2048):[],
    episodes:Array.isArray(r.episodes)?r.episodes.slice(0,160):[], beliefs:Array.isArray(r.beliefs)?r.beliefs.slice(0,160):[]};
    this.seenEventIndex = new Set(this.state.seenEventIds);
    this.rebuildEpisodeTokenCache();
  }
  snapshot(){ return structuredClone(this.state); }
  /** Durable projection keeps the continuity cursor/hash plus bounded recent episodic/belief context. */
  persistenceSnapshot(){
    return {
      ...this.state,
      seenEventIds:this.state.seenEventIds.slice(-2048),
      episodes:this.state.episodes.slice(0,96).map(e=>({...e,eventIds:e.eventIds.slice(),sources:e.sources.slice()})),
      beliefs:this.state.beliefs.slice(0,96).map(b=>({...b,evidenceIds:b.evidenceIds.slice(),contradictionIds:b.contradictionIds.slice()})),
    };
  }

  private rebuildEpisodeTokenCache(){
    this.episodeTokens = new Map(this.state.episodes.map(e=>[e.id,toks(e.summary)]));
  }

  private tokensForEpisode(e:P49Episode){
    const cached=this.episodeTokens.get(e.id);
    if(cached)return cached;
    const tokenSet=toks(e.summary); this.episodeTokens.set(e.id,tokenSet); return tokenSet;
  }

  private overlapEpisodeText(e:P49Episode,text:string){
    return overlapSets(this.tokensForEpisode(e),toks(text));
  }

  ingest(events:OrganismEvent[]):P49State{
    const ordered=(events??[]).slice().sort((a,b)=>a.tick-b.tick || String(a.id).localeCompare(String(b.id)));
    let indexed=0;
    for(const e of ordered){
      if(this.seenEventIndex.has(e.id)) continue;
      const summary=`${e.type}:${typeof e.payload==='object'?JSON.stringify(e.payload).slice(0,260):String(e.payload??'')}`;
      const last=this.state.episodes[0];
      if(last && e.at-last.endAt<90_000 && this.overlapEpisodeText(last,summary)>=0.18){
        last.eventIds=[e.id,...last.eventIds].slice(0,32); last.endAt=Math.max(last.endAt,e.at); last.salience=clamp(Math.max(last.salience,Number((e as any).importance??0.45))); last.confidence=clamp(last.confidence*.9+.1); last.summary=`${last.summary.slice(0,180)} | ${summary.slice(0,160)}`.slice(0,360); this.episodeTokens.set(last.id,toks(last.summary));
      }else{
        const id=createHash('sha1').update(`${e.id}|${e.tick}|${summary}`).digest('hex').slice(0,20);
        const episode={id,startAt:e.at,endAt:e.at,eventIds:[e.id],summary:summary.slice(0,360),salience:clamp(Number((e as any).importance??0.45)),confidence:.65,sources:[e.type]}; this.state.episodes.unshift(episode); this.episodeTokens.set(id,toks(episode.summary));
        this.state.episodesCreated++;
      }
      this.state.journalHash=hashEvent(this.state.journalHash,e); this.state.seenEventIds.push(e.id); this.seenEventIndex.add(e.id); if(this.state.seenEventIds.length>2048){ this.state.seenEventIds=this.state.seenEventIds.slice(-2048); this.seenEventIndex=new Set(this.state.seenEventIds); } this.state.eventsIndexed++; indexed++;
      this.state.eventCursor=Math.max(this.state.eventCursor,e.tick);
      this.observeBeliefFromEvent(e);
    }
    this.state.episodes=this.state.episodes.slice(0,160);
    this.state.memoryPressure01=clamp((this.state.episodes.length+this.state.beliefs.length)/320);
    this.state.drift01=this.measureDrift();
    this.state.continuityHealth01=clamp(1-this.state.drift01*.55-this.state.contradictionsOpen*.006);
    return this.snapshot();
  }

  private observeBeliefFromEvent(e:OrganismEvent){
    if(!['decision','world-transition','action-authorized','session','temporal-gap'].includes(e.type)) return;
    const p=e.type==='decision'?`selected-action:${String((e.payload as any)?.selectedAction??'none')}`
      :e.type==='world-transition'?`outcome-success:${Number((e.payload as any)?.success??.5)>=.6}`
      :e.type==='session'?`session-state:${String((e.payload as any)?.kind??'unknown')}`
      :`event:${e.type}`;
    const existing=this.state.beliefs.find(b=>overlap(b.proposition,p)>=.8);
    const confidence=clamp(e.type==='world-transition'?Number((e.payload as any)?.success??.5):.55);
    if(existing){ existing.confidence=clamp(existing.confidence*.88+confidence*.12); existing.evidenceIds=[e.id,...existing.evidenceIds].slice(0,32); existing.updates++; existing.lastAt=e.at; }
    else this.state.beliefs.unshift({id:createHash('sha1').update(p).digest('hex').slice(0,16),proposition:p,confidence,evidenceIds:[e.id],contradictionIds:[],updates:1,lastAt:e.at});
    this.reconcileContradictions();
  }

  private reconcileContradictions(){
    let open=0;
    for(const b of this.state.beliefs){
      const opposite=this.state.beliefs.find(x=>x.id!==b.id && ((b.proposition.includes(':true')&&x.proposition===b.proposition.replace(':true',':false'))||(b.proposition.includes(':false')&&x.proposition===b.proposition.replace(':false',':true'))));
      b.contradictionIds=opposite?[opposite.id]:[]; if(opposite) open++;
    }
    this.state.contradictionsOpen=Math.floor(open/2);
    this.state.beliefsReconciled+=open>0?1:0;
  }

  consolidate(maxEpisodes=96):{merged:number;kept:number;contradictionsOpen:number}{
    const before=this.state.episodes.length; const ranked=this.state.episodes.slice().sort((a,b)=>(b.salience*b.confidence)-(a.salience*a.confidence)); const kept:P49Episode[]=[];
    for(const ep of ranked){
      const near=kept.find(x=>overlapSets(this.tokensForEpisode(x),this.tokensForEpisode(ep))>=.72);
      if(near){near.eventIds=[...new Set([...near.eventIds,...ep.eventIds])].slice(0,40);near.sources=[...new Set([...near.sources,...ep.sources])].slice(0,8);near.salience=clamp(Math.max(near.salience,ep.salience));near.confidence=clamp(Math.max(near.confidence,ep.confidence)); this.episodeTokens.set(near.id,toks(near.summary)); this.state.episodesCompressed++;}
      else if(kept.length<maxEpisodes){ const copy=structuredClone(ep); kept.push(copy); this.episodeTokens.set(copy.id,toks(copy.summary)); }
    }
    this.state.episodes=kept;
    this.rebuildEpisodeTokenCache();
    this.reconcileContradictions(); this.state.memoryPressure01=clamp((this.state.episodes.length+this.state.beliefs.length)/320); this.state.drift01=this.measureDrift(); this.state.continuityHealth01=clamp(1-this.state.drift01*.55-this.state.contradictionsOpen*.006);
    return {merged:Math.max(0,before-kept.length),kept:kept.length,contradictionsOpen:this.state.contradictionsOpen};
  }

  sleep(now=Date.now(),depth:'light'|'deep'='light'){
    const result=this.consolidate(depth==='deep'?64:96);
    this.state.sleepConsolidations++; this.state.lastSleepAt=now;
    return {...result,sleepConsolidations:this.state.sleepConsolidations,continuityHealth01:this.state.continuityHealth01};
  }

  private measureDrift(){
    if(this.state.episodes.length<3)return 0;
    const recent=this.state.episodes.slice(0,12); const older=this.state.episodes.slice(12,36); if(!older.length)return 0;
    let total=0;
    for(const e of recent){const eTokens=this.tokensForEpisode(e); const best=Math.max(...older.map(o=>overlapSets(eTokens,this.tokensForEpisode(o)))); total+=1-best;}
    return clamp(total/recent.length);
  }

  summary(){ return {eventsIndexed:this.state.eventsIndexed,episodes:this.state.episodes.length,beliefs:this.state.beliefs.length,compression:this.state.episodesCompressed,contradictionsOpen:this.state.contradictionsOpen,continuityHealth01:this.state.continuityHealth01,drift01:this.state.drift01,journalHash:this.state.journalHash}; }
}

// Small deterministic constructor helper retained separately so migration code can use it without instantiation.
function P49State():P49State{return defaultP49();}
