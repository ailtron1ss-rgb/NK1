/**
 * BIG PASS 167 — Memory Causal Economy 3.0.
 *
 * This is a bounded causal/provenance layer over canonical MemoryOS2. It does
 * not store a second memory database. It records compact lineage between a
 * memory, the sources supporting it, retrieval/decision use, later outcomes,
 * and downstream self/value effects. It also provides a false-memory resistance
 * policy: contradictory multi-source evidence quarantines a claim candidate
 * instead of silently strengthening it.
 */
export type MemoryEvidenceClass = 'user'|'device'|'external-api'|'world'|'organism'|'simulator'|'model'|'unknown';
export type MemoryCausalStatus = 'candidate'|'supported'|'contested'|'quarantined';
export type MemoryImpactKind = 'decision'|'emotion'|'identity'|'value'|'learning';

export interface MemoryCausalObservation {
  id:string;
  memoryId:string;
  claimKey:string;
  tick:number;
  at:number;
  sourceClass:MemoryEvidenceClass;
  sourceKey:string;
  confidence01:number;
  contradiction01:number;
  external01:number;
}

export interface MemoryCausalOutcome {
  id:string;
  memoryId:string;
  decisionId:string|null;
  tick:number;
  at:number;
  action:string;
  success01:number;
  surprise01:number;
  influence01:number;
  sourceClass:MemoryEvidenceClass;
}

export interface MemoryCausalClaim {
  claimKey:string;
  status:MemoryCausalStatus;
  observationCount:number;
  independentSources:number;
  externalSources:number;
  contradictions:number;
  meanConfidence01:number;
  maxConfidence01:number;
  outcomeCount:number;
  meanInfluence01:number;
  lastAt:number;
  sourceKeys:string[];
  evidenceIds:string[];
}

export interface MemoryIdentityEffect {
  id:string;
  memoryIds:string[];
  kind:MemoryImpactKind;
  magnitude01:number;
  confidence01:number;
  tick:number;
  at:number;
  reason:string;
}

export interface MemoryCausalEconomyState {
  version:3;
  observations:MemoryCausalObservation[];
  outcomes:MemoryCausalOutcome[];
  claims:MemoryCausalClaim[];
  effects:MemoryIdentityEffect[];
  totalObservations:number;
  totalOutcomes:number;
  totalEffects:number;
  contestedClaims:number;
  quarantinedClaims:number;
  promotedClaims:number;
  meanInfluence01:number;
  lastAt:number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=180)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const stable=(value:string)=>{let h=2166136261>>>0;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');};
const external=(source:MemoryEvidenceClass)=>source==='user'||source==='device'||source==='external-api';
const defaultState=():MemoryCausalEconomyState=>({version:3,observations:[],outcomes:[],claims:[],effects:[],totalObservations:0,totalOutcomes:0,totalEffects:0,contestedClaims:0,quarantinedClaims:0,promotedClaims:0,meanInfluence01:0,lastAt:0});

export class MemoryCausalEconomy{
  private state=defaultState();
  restore(raw?:Partial<MemoryCausalEconomyState>|null){
    const d=defaultState(), r=raw??{};
    this.state={...d,...r,version:3,
      observations:Array.isArray(r.observations)?r.observations.slice(0,1024):[],
      outcomes:Array.isArray(r.outcomes)?r.outcomes.slice(0,1024):[],
      claims:Array.isArray(r.claims)?r.claims.slice(0,512):[],
      effects:Array.isArray(r.effects)?r.effects.slice(0,512):[],
    };
    this.recompute();
  }
  snapshot(){return structuredClone(this.state);}

  observeMemory(input:{memoryId:string;content:string;tick:number;at?:number;sourceClass:MemoryEvidenceClass;sourceKey?:string;confidence01?:number;contradiction01?:number;claimKey?:string}){
    const at=Number(input.at??Date.now());
    const claimKey=clean(input.claimKey,180) || `claim:${stable(clean(input.content,420).toLocaleLowerCase())}`;
    const row:MemoryCausalObservation={
      id:`mco:${stable(`${input.memoryId}|${input.tick}|${input.sourceClass}|${input.sourceKey??''}|${claimKey}`)}`,
      memoryId:clean(input.memoryId,96),claimKey,tick:Math.max(0,Math.floor(input.tick)),at,
      sourceClass:input.sourceClass,sourceKey:clean(input.sourceKey??input.sourceClass,120)||input.sourceClass,
      confidence01:clamp(input.confidence01??.5),contradiction01:clamp(input.contradiction01??0),external01:external(input.sourceClass)?1:0,
    };
    const duplicate=this.state.observations.some(x=>x.id===row.id);
    if(!duplicate){
      this.state.observations=[row,...this.state.observations].slice(0,1024);
      this.state.totalObservations++;
    }
    this.recompute();
    return {observation:structuredClone(row),claim:this.claim(row.claimKey)};
  }

  observeOutcome(input:{memoryId:string;decisionId?:string|null;tick:number;at?:number;action:string;success01:number;surprise01:number;sourceClass:MemoryEvidenceClass;causalPrior01?:number}){
    const at=Number(input.at??Date.now());
    const prior=clamp(input.causalPrior01??.5);
    const influence=clamp(.35*prior+.35*Math.abs(clamp(input.success01)-.5)*2+.20*clamp(input.surprise01)+.10*(external(input.sourceClass)?1:0));
    const row:MemoryCausalOutcome={id:`mco:${stable(`${input.memoryId}|${input.decisionId??''}|${input.tick}|${input.action}`)}`,memoryId:clean(input.memoryId,96),decisionId:input.decisionId?clean(input.decisionId,96):null,tick:Math.max(0,Math.floor(input.tick)),at,action:clean(input.action,64)||'wait',success01:clamp(input.success01),surprise01:clamp(input.surprise01),influence01:influence,sourceClass:input.sourceClass};
    const duplicate=this.state.outcomes.some(x=>x.id===row.id);
    if(!duplicate){this.state.outcomes=[row,...this.state.outcomes].slice(0,1024);this.state.totalOutcomes++;}
    this.recompute();
    return structuredClone(row);
  }

  assessMemory(memoryId:string){
    const id=clean(memoryId,96); const obs=this.state.observations.filter(x=>x.memoryId===id); const outcomes=this.state.outcomes.filter(x=>x.memoryId===id);
    const sources=new Set(obs.map(x=>x.sourceKey)); const externalSources=new Set(obs.filter(x=>x.external01>0).map(x=>x.sourceKey));
    const contradiction=obs.reduce((s,x)=>s+x.contradiction01,0);
    const meanConfidence=obs.length?obs.reduce((s,x)=>s+x.confidence01,0)/obs.length:0;
    const maxConfidence=obs.length?Math.max(...obs.map(x=>x.confidence01)):0;
    const meanInfluence=outcomes.length?outcomes.reduce((s,x)=>s+x.influence01,0)/outcomes.length:0;
    const status:MemoryCausalStatus = contradiction>=1.25 ? 'quarantined' : contradiction>=.55 ? 'contested' : (sources.size>=2 && maxConfidence>=.62 ? 'supported':'candidate');
    return {memoryId:id,claimKey:obs[0]?.claimKey??'',status,observationCount:obs.length,independentSources:sources.size,externalSources:externalSources.size,contradictions:Math.round(contradiction*1000)/1000,meanConfidence01:clamp(meanConfidence),maxConfidence01:clamp(maxConfidence),outcomeCount:outcomes.length,meanInfluence01:clamp(meanInfluence)};
  }

  claim(claimKey:string){
    return structuredClone(this.state.claims.find(c=>c.claimKey===claimKey) ?? {claimKey,status:'candidate',observationCount:0,independentSources:0,externalSources:0,contradictions:0,meanConfidence01:0,maxConfidence01:0,outcomeCount:0,meanInfluence01:0,lastAt:0,sourceKeys:[],evidenceIds:[]});
  }

  recordEffect(input:{memoryIds:string[];kind:MemoryImpactKind;magnitude01:number;confidence01:number;tick:number;at?:number;reason:string}){
    const ids=[...new Set(input.memoryIds.map(x=>clean(x,96)).filter(Boolean))].slice(0,12);
    if(!ids.length)return null;
    const row:MemoryIdentityEffect={id:`mce:${stable(`${ids.join('|')}|${input.kind}|${input.tick}|${clean(input.reason,240)}`)}`,memoryIds:ids,kind:input.kind,magnitude01:clamp(input.magnitude01),confidence01:clamp(input.confidence01),tick:Math.max(0,Math.floor(input.tick)),at:Number(input.at??Date.now()),reason:clean(input.reason,240)};
    this.state.effects=[row,...this.state.effects].slice(0,512);this.state.totalEffects++;this.state.lastAt=row.at;return structuredClone(row);
  }

  shouldQuarantineMemory(memoryId:string){const a=this.assessMemory(memoryId);return a.status==='quarantined'||a.status==='contested';}

  promotionReadiness(memoryId:string){
    const a=this.assessMemory(memoryId);
    return clamp(Math.min(a.independentSources/3,1)*.28+Math.min(a.externalSources/2,1)*.22+a.meanConfidence01*.20+a.maxConfidence01*.12+Math.min(a.outcomeCount/3,1)*.12+a.meanInfluence01*.06-(a.contradictions*.20));
  }

  summary(){return {version:3,totalObservations:this.state.totalObservations,totalOutcomes:this.state.totalOutcomes,totalEffects:this.state.totalEffects,claims:this.state.claims.length,contestedClaims:this.state.contestedClaims,quarantinedClaims:this.state.quarantinedClaims,promotedClaims:this.state.promotedClaims,meanInfluence01:this.state.meanInfluence01,lastAt:this.state.lastAt};}

  private recompute(){
    // Counters are derived from canonical bounded arrays, so restore/replay/trim cannot leave
    // stale totals behind. This makes persistence claims auditable rather than counter-based.
    this.state.totalObservations=this.state.observations.length;
    this.state.totalOutcomes=this.state.outcomes.length;
    this.state.totalEffects=this.state.effects.length;
    const byClaim=new Map<string,MemoryCausalObservation[]>();
    for(const row of this.state.observations){const list=byClaim.get(row.claimKey)??[];list.push(row);byClaim.set(row.claimKey,list);}
    const claims:MemoryCausalClaim[]=[];
    for(const [claimKey,rows] of byClaim){
      const sources=[...new Set(rows.map(r=>r.sourceKey))];
      const externalSources=[...new Set(rows.filter(r=>r.external01>0).map(r=>r.sourceKey))];
      const contradictions=rows.reduce((s,r)=>s+r.contradiction01,0);
      const confidence=rows.reduce((s,r)=>s+r.confidence01,0)/Math.max(1,rows.length);
      const max=Math.max(...rows.map(r=>r.confidence01),0);
      const outcomeRows=this.state.outcomes.filter(o=>rows.some(r=>r.memoryId===o.memoryId));
      const influence=outcomeRows.length?outcomeRows.reduce((s,r)=>s+r.influence01,0)/outcomeRows.length:0;
      const status:MemoryCausalStatus=contradictions>=1.25?'quarantined':contradictions>=.55?'contested':(sources.length>=2&&max>=.62?'supported':'candidate');
      claims.push({claimKey,status,observationCount:rows.length,independentSources:sources.length,externalSources:externalSources.length,contradictions,meanConfidence01:clamp(confidence),maxConfidence01:clamp(max),outcomeCount:outcomeRows.length,meanInfluence01:clamp(influence),lastAt:Math.max(...rows.map(r=>r.at),0),sourceKeys:sources.slice(0,16),evidenceIds:rows.map(r=>r.id).slice(0,16)});
    }
    this.state.claims=claims.slice(0,512);
    this.state.contestedClaims=claims.filter(c=>c.status==='contested').length;
    this.state.quarantinedClaims=claims.filter(c=>c.status==='quarantined').length;
    this.state.promotedClaims=claims.filter(c=>c.status==='supported').length;
    this.state.meanInfluence01=this.state.outcomes.length?clamp(this.state.outcomes.reduce((s,x)=>s+x.influence01,0)/this.state.outcomes.length):0;
    if(this.state.claims.length)this.state.lastAt=Math.max(this.state.lastAt,...this.state.claims.map(c=>c.lastAt));
  }
}

export const defaultMemoryCausalEconomy=()=>defaultState();
