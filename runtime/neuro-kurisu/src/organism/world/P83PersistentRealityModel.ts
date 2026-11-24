import type { WorldContext } from '../core/types.ts';

export type RealityBeliefStatus='anchored'|'supported'|'disputed'|'unknown';
export interface RealityBelief {
  claimKey:string;
  status:RealityBeliefStatus;
  confidence01:number;
  firstSeenAt:number;
  lastSeenAt:number;
  support01:number;
  contradiction01:number;
  independentSources:number;
  provenanceIds:string[];
  predictionIds:string[];
}
export interface RealityContinuityEvent {
  id:string;
  at:number;
  kind:'world-change'|'confidence-shift'|'dispute'|'anchor'|'recovery';
  fromHash:string;
  toHash:string;
  magnitude01:number;
  reason:string;
}
export interface PersistentRealityModelState {
  version:1;
  revision:number;
  lastAt:number;
  currentHash:string;
  previousHash:string;
  location:string;
  confidence01:number;
  uncertainty01:number;
  beliefCount:number;
  anchoredCount:number;
  disputedCount:number;
  unknownCount:number;
  transitions:number;
  continuityBreaks:number;
  beliefs:RealityBelief[];
  continuity:RealityContinuityEvent[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const norm=(x:unknown)=>String(x??'').trim().toLowerCase().replace(/\s+/g,' ').slice(0,180);
const hash=(s:string)=>{let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return (h>>>0).toString(16).padStart(8,'0');};
const stableClaim=(claim:string)=>`reality:${hash(norm(claim))}`;
const asList = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export const defaultP83PersistentRealityModel=():PersistentRealityModelState=>({version:1,revision:0,lastAt:0,currentHash:'',previousHash:'',location:'unknown',confidence01:0,uncertainty01:1,beliefCount:0,anchoredCount:0,disputedCount:0,unknownCount:0,transitions:0,continuityBreaks:0,beliefs:[],continuity:[]});

/**
 * P83 — Persistent Reality Model.
 *
 * This is a compact derived model inside the existing World owner. It does not
 * duplicate WorldModel/GroundedWorld/observer raw state. Instead it versions
 * the organism's current reality-anchor, selected claims and continuity deltas.
 * It is deliberately epistemic: beliefs can be disputed/unknown and are never
 * upgraded merely because a local simulator asserted them.
 */
export class P83PersistentRealityModel {
  readonly systemName='world:p83-persistent-reality' as const;
  private state=defaultP83PersistentRealityModel();
  private readonly maxBeliefs:number;
  private readonly maxContinuity:number;

  constructor(config:{maxBeliefs?:number;maxContinuity?:number}={}){
    this.maxBeliefs=Math.max(24,Math.floor(config.maxBeliefs??96));
    this.maxContinuity=Math.max(16,Math.floor(config.maxContinuity??64));
  }

  restore(raw?:Partial<PersistentRealityModelState>|null){
    const d=defaultP83PersistentRealityModel(),r=raw??{};
    this.state={...d,...r,
      beliefs:Array.isArray(r.beliefs)?r.beliefs.slice(-this.maxBeliefs).map(b=>({...b,provenanceIds:[...(b.provenanceIds??[])].slice(-12),predictionIds:[...(b.predictionIds??[])].slice(-12)})):[],
      continuity:Array.isArray(r.continuity)?r.continuity.slice(-this.maxContinuity):[],
      version:1,
    };
    this.refreshCounts();
  }

  snapshot(){return structuredClone(this.state);}

  private contextHash(context:WorldContext):string{
    const objects=asList<WorldContext['objects'][number]>(context.objects).slice(0,64).map(o=>`${norm(o?.label)}:${norm(o?.location)}:${o?.visible?'1':'0'}:${(Number(o?.confidence01 ?? o?.value ?? 0)).toFixed(2)}`).sort();
    const facts=asList<string>(context.facts).slice(-96).map(norm).filter(Boolean).sort();
    const events=asList<string>(context.events).slice(-24).map(norm).filter(Boolean);
    return hash(`${norm(context.location)}|${facts.join('|')}|${objects.join('|')}|${events.join('|')}`);
  }

  observeWorld(input:{context:WorldContext;at?:number;provenanceIds?:string[];confidence01?:number;anchored?:boolean;reason?:string}){
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const context=input.context;
    const nextHash=this.contextHash(context);
    const previous=this.state.currentHash;
    const changed=Boolean(previous&&previous!==nextHash);
    const sourceConfidence=clamp(input.confidence01??(1-context.uncertainty));
    const semanticDelta=clamp(Math.abs(sourceConfidence-this.state.confidence01));
    const unchanged=Boolean(previous&&previous===nextHash);
    // Hot-path guard: identical grounded scenes do not rebuild the bounded belief
    // index on every cycle. Timestamp freshness is still updated for persistence.
    if(unchanged && semanticDelta<.08){
      this.state.lastAt=at;
      this.state.location=norm(context.location)||'unknown';
      this.state.confidence01=clamp(this.state.confidence01*.96+sourceConfidence*.04);
      this.state.uncertainty01=1-this.state.confidence01;
      return this.summary();
    }
    this.state.previousHash=previous;
    this.state.currentHash=nextHash;
    this.state.location=norm(context.location)||'unknown';
    this.state.confidence01=clamp(this.state.confidence01===0?sourceConfidence:this.state.confidence01*.72+sourceConfidence*.28);
    this.state.uncertainty01=1-this.state.confidence01;
    this.state.lastAt=at;
    this.state.revision++;
    if(changed){
      this.state.transitions++;
      const magnitude=clamp(.45+semanticDelta*.55);
      if(magnitude>=.78 || semanticDelta>=.42) this.state.continuityBreaks++;
      this.pushContinuity({at,kind:'world-change',fromHash:previous,toHash:nextHash,magnitude01:magnitude,reason:String(input.reason??'grounded-world-change').slice(0,160)});
    }else if(semanticDelta>=.24){
      this.pushContinuity({at,kind:'confidence-shift',fromHash:previous||nextHash,toHash:nextHash,magnitude01:semanticDelta,reason:'grounding-confidence-shift'});
    }
    const facts=asList<string>(context.facts);
    const objects=asList<WorldContext['objects'][number]>(context.objects);
    const claimInputs=[...facts.slice(-24).map(f=>({claim:f,score:sourceConfidence})),...objects.slice(0,24).filter(o=>o?.visible).map(o=>({claim:`object:${o.label}@${o.location}`,score:clamp(o.confidence01??o.value)}))];
    for(const row of claimInputs) this.upsertBelief(row.claim,{status:input.anchored?'anchored':'supported',confidence01:clamp(row.score*.92),support01:clamp(row.score),contradiction01:0,independentSources:1,provenanceIds:input.provenanceIds});
    this.refreshCounts();
    return this.summary();
  }

  heartbeat(at=Date.now()){ this.state.lastAt=Number.isFinite(at)?Number(at):Date.now(); return this.summary(); }

  linkPrediction(input:{predictionId:string;claimKey:string;predicted01:number;confidence01:number;at?:number}){
    const key=stableClaim(input.claimKey); const existing=this.state.beliefs.find(b=>b.claimKey===key);
    if(existing){existing.predictionIds=[...new Set([...existing.predictionIds,input.predictionId].slice(-12))];return structuredClone(existing);}
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    this.state.beliefs.unshift({claimKey:key,status:'unknown',confidence01:clamp(input.confidence01*.55+input.predicted01*.25),firstSeenAt:at,lastSeenAt:at,support01:0,contradiction01:0,independentSources:0,provenanceIds:[],predictionIds:[input.predictionId]});
    this.state.beliefs=this.state.beliefs.slice(0,this.maxBeliefs);
    this.refreshCounts();
    return structuredClone(this.state.beliefs[0]);
  }

  reconcileClaim(input:{claimKey:string;status:'corroborated'|'supported'|'disputed'|'unknown';support01:number;contradiction01:number;independentSources?:number;provenanceIds?:string[];predictionId?:string;observationId?:string;at?:number}){
    const key=stableClaim(input.claimKey); const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const status:RealityBeliefStatus=input.status==='corroborated'?'anchored':input.status;
    const nextConfidence=clamp(input.support01*.55+(1-input.contradiction01)*.25+Math.min(1,(input.independentSources??0)/3)*.20);
    const existing=this.state.beliefs.find(b=>b.claimKey===key);
    if(existing && input.observationId && existing.provenanceIds.includes(input.observationId))
      return structuredClone(existing); // exact observation replay must not amplify reality confidence or continuity
    if(existing){
      const prevStatus=existing.status;
      existing.status=status; existing.lastSeenAt=at; existing.support01=clamp(input.support01); existing.contradiction01=clamp(input.contradiction01); existing.independentSources=Math.max(existing.independentSources,Math.floor(input.independentSources??0)); existing.confidence01=clamp(existing.confidence01*.45+nextConfidence*.55);
      existing.provenanceIds=[...new Set([...existing.provenanceIds,...(input.provenanceIds??[]),...(input.observationId?[input.observationId]:[])])].slice(-12);
      existing.predictionIds=[...new Set([...existing.predictionIds,...(input.predictionId?[input.predictionId]:[])])].slice(-12);
      if(prevStatus!==status) this.pushContinuity({at,kind:status==='disputed'?'dispute':status==='anchored'?'anchor':'recovery',fromHash:this.state.currentHash,toHash:this.state.currentHash,magnitude01:clamp(Math.abs(existing.confidence01-nextConfidence)+.25),reason:`belief:${key}:${prevStatus}->${status}`});
    }else{
      this.state.beliefs.unshift({claimKey:key,status,confidence01:nextConfidence,firstSeenAt:at,lastSeenAt:at,support01:clamp(input.support01),contradiction01:clamp(input.contradiction01),independentSources:Math.max(0,Math.floor(input.independentSources??0)),provenanceIds:[...(input.provenanceIds??[]),...(input.observationId?[input.observationId]:[])].slice(-12),predictionIds:(input.predictionId?[input.predictionId]:[])});
      this.state.beliefs=this.state.beliefs.slice(0,this.maxBeliefs);
    }
    this.refreshCounts();
    return this.state.beliefs.find(b=>b.claimKey===key)!;
  }

  belief(claimKey:string){return this.state.beliefs.find(b=>b.claimKey===stableClaim(claimKey));}
  summary(){return {version:1,revision:this.state.revision,lastAt:this.state.lastAt,currentHash:this.state.currentHash,location:this.state.location,confidence01:this.state.confidence01,uncertainty01:this.state.uncertainty01,beliefCount:this.state.beliefCount,anchoredCount:this.state.anchoredCount,disputedCount:this.state.disputedCount,unknownCount:this.state.unknownCount,transitions:this.state.transitions,continuityBreaks:this.state.continuityBreaks};}
  continuitySnapshot(limit=16){return this.state.continuity.slice(0,Math.max(1,Math.min(64,Math.floor(limit))));}

  private upsertBelief(claim:string,input:{status:RealityBeliefStatus;confidence01:number;support01:number;contradiction01:number;independentSources:number;provenanceIds?:string[]}){
    const key=stableClaim(claim),at=this.state.lastAt; const existing=this.state.beliefs.find(b=>b.claimKey===key);
    if(existing){ existing.lastSeenAt=at; existing.status=existing.status==='anchored'?'anchored':input.status; existing.confidence01=clamp(existing.confidence01*.78+input.confidence01*.22); existing.support01=clamp(existing.support01*.78+input.support01*.22); existing.contradiction01=clamp(existing.contradiction01*.78+input.contradiction01*.22); existing.independentSources=Math.max(existing.independentSources,input.independentSources); existing.provenanceIds=[...new Set([...existing.provenanceIds,...(input.provenanceIds??[])])].slice(-12); return; }
    this.state.beliefs.unshift({claimKey:key,status:input.status,confidence01:clamp(input.confidence01),firstSeenAt:at,lastSeenAt:at,support01:clamp(input.support01),contradiction01:clamp(input.contradiction01),independentSources:input.independentSources,provenanceIds:[...(input.provenanceIds??[])].slice(-12),predictionIds:[]});
    this.state.beliefs=this.state.beliefs.slice(0,this.maxBeliefs);
  }

  private pushContinuity(row:Omit<RealityContinuityEvent,'id'>){
    const id=`p83:${hash(`${row.at}|${row.kind}|${row.fromHash}|${row.toHash}|${row.reason}`)}`;
    this.state.continuity=[{id,...row},...this.state.continuity.filter(x=>x.id!==id)].slice(0,this.maxContinuity);
  }
  private refreshCounts(){
    this.state.beliefCount=this.state.beliefs.length;
    this.state.anchoredCount=this.state.beliefs.filter(b=>b.status==='anchored').length;
    this.state.disputedCount=this.state.beliefs.filter(b=>b.status==='disputed').length;
    this.state.unknownCount=this.state.beliefs.filter(b=>b.status==='unknown').length;
  }
}
