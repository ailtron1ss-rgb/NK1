/**
 * BIG PASS 204 — cross-domain cognitive closure.
 *
 * The existing event fabric proves that a causal event chain exists. This layer
 * proves something stricter: a single operational experience actually crosses
 * the principal cognitive domains (memory, world, self, agency, learning),
 * and that the resulting compact state remains restorable.
 *
 * This is measurement/evidence only. It never invents a state change and never
 * replaces any subsystem as the source of truth.
 */
export type CognitiveDomain='memory'|'world'|'self'|'agency'|'learning';

export interface CognitiveDomainMark {
  fingerprint:string;
  count:number;
  activity01:number;
}

export type CognitiveDomainMarkSet=Record<CognitiveDomain,CognitiveDomainMark>;

export interface CognitiveDomainClosureRecord {
  version:1;
  tick:number;
  at:number;
  expectedDomains:CognitiveDomain[];
  changedDomains:CognitiveDomain[];
  missingExpectedDomains:CognitiveDomain[];
  deltas:Record<CognitiveDomain,number>;
  links:{
    observationToMemory:boolean;
    memoryToWorld:boolean;
    worldToAgency:boolean;
    agencyToLearning:boolean;
    learningToSelf:boolean;
  };
  continuity01:number;
  complete:boolean;
  persistenceReady:boolean;
  before:CognitiveDomainMarkSet;
  after:CognitiveDomainMarkSet;
}

export interface CognitiveDomainClosureSnapshot {
  version:1;
  capacity:number;
  totalCycles:number;
  completeCycles:number;
  incompleteCycles:number;
  meanContinuity01:number;
  persistenceReadyCycles:number;
  last?:CognitiveDomainClosureRecord;
  recent:CognitiveDomainClosureRecord[];
}

const DOMAINS:CognitiveDomain[]=['memory','world','self','agency','learning'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const cleanMark=(mark:any):CognitiveDomainMark=>({
  fingerprint:String(mark?.fingerprint??''),
  count:Math.max(0,Number(mark?.count??0)),
  activity01:clamp01(Number(mark?.activity01??0)),
});
const cleanSet=(input:any):CognitiveDomainMarkSet=>Object.fromEntries(DOMAINS.map(d=>[d,cleanMark(input?.[d])])) as CognitiveDomainMarkSet;

const changed=(before:CognitiveDomainMark,after:CognitiveDomainMark)=>
  before.fingerprint!==after.fingerprint || before.count!==after.count || Math.abs(after.activity01-before.activity01)>=0.03;

const delta=(before:CognitiveDomainMark,after:CognitiveDomainMark)=>clamp01(
  Math.max(
    before.fingerprint!==after.fingerprint?0.5:0,
    Math.min(0.35,Math.abs(after.count-before.count)/8),
    Math.min(0.35,Math.abs(after.activity01-before.activity01)),
  )
);

export const defaultCognitiveDomainClosure=():CognitiveDomainClosureSnapshot=>({
  version:1,capacity:64,totalCycles:0,completeCycles:0,incompleteCycles:0,
  meanContinuity01:0,persistenceReadyCycles:0,recent:[],
});

export class CognitiveDomainClosure {
  private state=defaultCognitiveDomainClosure();
  private pending:{tick:number;at:number;before:CognitiveDomainMarkSet;expectedDomains:CognitiveDomain[]}|null=null;

  constructor(capacity=64){
    this.state=defaultCognitiveDomainClosure();
    this.state.capacity=Math.max(8,Math.min(128,Math.floor(capacity)));
  }

  restore(raw?:Partial<CognitiveDomainClosureSnapshot>|null):void{
    const base=defaultCognitiveDomainClosure();
    this.state={
      ...base,
      ...(raw??{}),
      version:1,
      capacity:Math.max(8,Math.min(128,Math.floor(Number(raw?.capacity??base.capacity)))),
      totalCycles:Math.max(0,Number(raw?.totalCycles??0)),
      completeCycles:Math.max(0,Number(raw?.completeCycles??0)),
      incompleteCycles:Math.max(0,Number(raw?.incompleteCycles??0)),
      meanContinuity01:clamp01(Number(raw?.meanContinuity01??0)),
      persistenceReadyCycles:Math.max(0,Number(raw?.persistenceReadyCycles??0)),
      recent:Array.isArray(raw?.recent)?raw!.recent.slice(0,Math.max(8,Math.min(128,Math.floor(Number(raw?.capacity??base.capacity))))).map((r:any)=>this.cleanRecord(r)):[],
      last:raw?.last?this.cleanRecord(raw.last):undefined,
    };
  }

  begin(input:{tick:number;at?:number;domains:CognitiveDomainMarkSet;expectedDomains?:CognitiveDomain[]}):void{
    this.pending={
      tick:Math.max(0,Math.floor(input.tick)),
      at:Number.isFinite(input.at)?Number(input.at):Date.now(),
      before:cleanSet(input.domains),
      expectedDomains:[...(input.expectedDomains??DOMAINS)].filter((d):d is CognitiveDomain=>DOMAINS.includes(d)),
    };
  }

  end(input:{domains:CognitiveDomainMarkSet;links?:Partial<CognitiveDomainClosureRecord['links']>;persistenceReady?:boolean}):CognitiveDomainClosureRecord|null{
    const pending=this.pending;
    if(!pending)return null;
    const after=cleanSet(input.domains);
    const changedDomains=DOMAINS.filter(d=>changed(pending.before[d],after[d]));
    const missingExpectedDomains=pending.expectedDomains.filter(d=>!changedDomains.includes(d));
    const deltas=Object.fromEntries(DOMAINS.map(d=>[d,delta(pending.before[d],after[d])])) as Record<CognitiveDomain,number>;
    const links={
      observationToMemory:Boolean(input.links?.observationToMemory),
      memoryToWorld:Boolean(input.links?.memoryToWorld),
      worldToAgency:Boolean(input.links?.worldToAgency),
      agencyToLearning:Boolean(input.links?.agencyToLearning),
      learningToSelf:Boolean(input.links?.learningToSelf),
    };
    const linkValues=Object.values(links).map(Boolean);
    const linkScore=linkValues.length?linkValues.filter(Boolean).length/linkValues.length:0;
    const expectedCoverage=pending.expectedDomains.length?pending.expectedDomains.filter(d=>changedDomains.includes(d)).length/pending.expectedDomains.length:1;
    const continuity=clamp01(expectedCoverage*.65+linkScore*.35);
    const persistenceReady=Boolean(input.persistenceReady);
    const complete=missingExpectedDomains.length===0 && continuity>=0.8;
    const record:CognitiveDomainClosureRecord={version:1,tick:pending.tick,at:pending.at,expectedDomains:[...pending.expectedDomains],changedDomains,missingExpectedDomains,deltas,links,continuity01:continuity,complete,persistenceReady,before:pending.before,after};
    const total=this.state.totalCycles+1;
    this.state={
      ...this.state,
      totalCycles:total,
      completeCycles:this.state.completeCycles+(complete?1:0),
      incompleteCycles:this.state.incompleteCycles+(complete?0:1),
      meanContinuity01:clamp01((this.state.meanContinuity01*this.state.totalCycles+continuity)/total),
      persistenceReadyCycles:this.state.persistenceReadyCycles+(persistenceReady?1:0),
      last:record,
      recent:[record,...this.state.recent].slice(0,this.state.capacity),
    };
    this.pending=null;
    return structuredClone(record);
  }

  snapshot():CognitiveDomainClosureSnapshot{return structuredClone(this.state);}

  diagnostics(){
    return {
      totalCycles:this.state.totalCycles,
      completeCycles:this.state.completeCycles,
      incompleteCycles:this.state.incompleteCycles,
      completionRate01:clamp01(this.state.completeCycles/Math.max(1,this.state.totalCycles)),
      meanContinuity01:this.state.meanContinuity01,
      persistenceCoverage01:clamp01(this.state.persistenceReadyCycles/Math.max(1,this.state.totalCycles)),
      lastComplete:Boolean(this.state.last?.complete),
      lastContinuity01:Number(this.state.last?.continuity01??0),
    };
  }

  private cleanRecord(raw:any):CognitiveDomainClosureRecord{
    return {
      version:1,
      tick:Math.max(0,Math.floor(Number(raw?.tick??0))),
      at:Number(raw?.at??0),
      expectedDomains:Array.isArray(raw?.expectedDomains)?raw.expectedDomains.filter((d:any)=>DOMAINS.includes(d)):[],
      changedDomains:Array.isArray(raw?.changedDomains)?raw.changedDomains.filter((d:any)=>DOMAINS.includes(d)):[],
      missingExpectedDomains:Array.isArray(raw?.missingExpectedDomains)?raw.missingExpectedDomains.filter((d:any)=>DOMAINS.includes(d)):[],
      deltas:Object.fromEntries(DOMAINS.map(d=>[d,clamp01(Number(raw?.deltas?.[d]??0))])) as Record<CognitiveDomain,number>,
      links:{
        observationToMemory:Boolean(raw?.links?.observationToMemory),
        memoryToWorld:Boolean(raw?.links?.memoryToWorld),
        worldToAgency:Boolean(raw?.links?.worldToAgency),
        agencyToLearning:Boolean(raw?.links?.agencyToLearning),
        learningToSelf:Boolean(raw?.links?.learningToSelf),
      },
      continuity01:clamp01(Number(raw?.continuity01??0)),
      complete:Boolean(raw?.complete),
      persistenceReady:Boolean(raw?.persistenceReady),
      before:cleanSet(raw?.before),
      after:cleanSet(raw?.after),
    };
  }
}

