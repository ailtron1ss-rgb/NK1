export type B301EconomyTier='normal'|'pressure'|'emergency';

export interface B301EconomyLimits {
  traces:number;
  eventLog:number;
  ownershipCheckpoints:number;
  p30Nodes:number;
  p30Edges:number;
  p49Episodes:number;
  p49SeenEventIds:number;
  p84Moments:number;
  b284Episodes:number;
  b285Episodes:number;
  recurrentEpisodes:number;
  shadowRecent:number;
  longHorizonRecent:number;
  emotionHistory:number;
  p42History:number;
  p58Frames:number;
  evolutionNetworkHistory:number;
  agencyRecords:number;
  autobiographicalMemories:number;
  cognitiveDomainClosureRecent:number;
  p40SemanticClaims:number;
  p40SemanticSituations:number;
  p40SemanticHypotheses:number;
  embodiedTransitions:number;
  neuralReplay:number;
}

export interface B301EconomyState {
  version:1;
  inspections:number;
  compactions:number;
  cyclesObserved:number;
  tier:B301EconomyTier;
  pressure01:number;
  lastBytesBefore:number;
  lastBytesAfter:number;
  bytesSavedTotal:number;
  lastSaved01:number;
  lastReason:string;
  lastLimits:B301EconomyLimits;
  protectedCanonicalBranches:string[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const textEncoder=new TextEncoder();
const byteSize=(value:unknown)=>{try{return textEncoder.encode(JSON.stringify(value??null)).byteLength;}catch{return 0;}};
const baseLimits=():B301EconomyLimits=>({
  traces:16,eventLog:96,ownershipCheckpoints:48,p30Nodes:96,p30Edges:64,p49Episodes:16,p49SeenEventIds:128,
  p84Moments:12,b284Episodes:12,b285Episodes:12,recurrentEpisodes:16,shadowRecent:16,longHorizonRecent:24,
  emotionHistory:16,p42History:16,p58Frames:16,evolutionNetworkHistory:16,agencyRecords:16,autobiographicalMemories:32,
  cognitiveDomainClosureRecent:16,p40SemanticClaims:256,p40SemanticSituations:64,p40SemanticHypotheses:128,embodiedTransitions:64,neuralReplay:192,
});
const tighter=(pressure01:number,tier:B301EconomyTier):B301EconomyLimits=>{
  const b=baseLimits();
  if(tier==='pressure'){
    b.traces=10;b.eventLog=72;b.ownershipCheckpoints=32;b.p30Nodes=72;b.p30Edges=48;b.p49Episodes=12;
    b.p49SeenEventIds=96;b.p84Moments=10;b.b284Episodes=10;b.b285Episodes=10;b.recurrentEpisodes=12;b.shadowRecent=12;
    b.longHorizonRecent=16;b.emotionHistory=12;b.p42History=12;b.p58Frames=12;b.evolutionNetworkHistory=12;b.agencyRecords=12;b.autobiographicalMemories=24;
    b.cognitiveDomainClosureRecent=12;b.p40SemanticClaims=192;b.p40SemanticSituations=48;b.p40SemanticHypotheses=96;b.embodiedTransitions=48;b.neuralReplay=128;
  }
  if(tier==='emergency'){
    b.traces=6;b.eventLog=48;b.ownershipCheckpoints=20;b.p30Nodes=48;b.p30Edges=32;b.p49Episodes=8;
    b.p49SeenEventIds=64;b.p84Moments=8;b.b284Episodes=8;b.b285Episodes=8;b.recurrentEpisodes=8;b.shadowRecent=8;
    b.longHorizonRecent=12;b.emotionHistory=8;b.p42History=8;b.p58Frames=8;b.evolutionNetworkHistory=8;b.agencyRecords=8;b.autobiographicalMemories=16;
    b.cognitiveDomainClosureRecent=8;b.p40SemanticClaims=128;b.p40SemanticSituations=32;b.p40SemanticHypotheses=64;b.embodiedTransitions=32;b.neuralReplay=96;
  }
  return b;
};

export const defaultB301MobileStateEconomy=():B301EconomyState=>({
  version:1,inspections:0,compactions:0,cyclesObserved:0,tier:'normal',pressure01:0,lastBytesBefore:0,lastBytesAfter:0,
  bytesSavedTotal:0,lastSaved01:0,lastReason:'initial',lastLimits:baseLimits(),
  protectedCanonicalBranches:[
    'facets.cognition.centralBrain','facets.cognition.brainSubstrate','facets.cognition.metacognitiveNeural',
    'system.canonicalNeuralSubstrate','system.spikingPlasticNeuralB269','system.neuralPersonalityAgencyNucleusB296',
    'system.neuralGerminalOrganismB270','system.neuralAutobiographicalCoreB271','system.neuralAutobiographicalIdentityB284',
    'system.neuralLifeConsolidationB285','system.actionOwnershipGraphB298','system.causalPersonalityDevelopmentB299',
  ],
});

const nested=(root:any,path:string[])=>path.reduce((v,k)=>v==null?undefined:v[k],root);
const pathBytes=(root:any,path:string[])=>byteSize(nested(root,path));
const setNested=(root:any,path:string[],value:any)=>{let cursor=root;for(let i=0;i<path.length-1;i++){if(cursor==null||typeof cursor!=='object')return;cursor=cursor[path[i]];}if(cursor&&typeof cursor==='object')cursor[path[path.length-1]]=value;};
const trimTail=(value:any,limit:number)=>Array.isArray(value)?value.slice(Math.max(0,value.length-limit)):value;
const trimHead=(value:any,limit:number)=>Array.isArray(value)?value.slice(0,limit):value;

interface ResourceInput { profile?:'quality'|'balanced'|'mobile'; ramPressure01?:number; thermal01?:number; bodyEnergy01?:number; cognitiveCapacity01?:number; tick?:number; forceCompaction?:boolean; }

/**
 * B301: mobile persistence economy. It deliberately protects the actual neural parameter
 * matrices and persistent causal/personality state. Only bounded history/cache projections are
 * compacted. This is a durability optimization, not a neural-learning substitute.
 */
export class B301MobileStateEconomy {
  private state=B301MobileStateEconomy.normalize(defaultB301MobileStateEconomy());
  static normalize(raw?:Partial<B301EconomyState>|null):B301EconomyState{
    const d=defaultB301MobileStateEconomy(),r:any=raw??{}; const incoming:any=r.lastLimits??{};
    const limits={...d.lastLimits,...incoming};
    const numeric=(v:any,f:number)=>Number.isFinite(Number(v))?Math.max(0,Number(v)):f;
    return {...d,...r,version:1,inspections:Math.floor(numeric(r.inspections,0)),compactions:Math.floor(numeric(r.compactions,0)),cyclesObserved:Math.floor(numeric(r.cyclesObserved,0)),
      pressure01:clamp(Number(r.pressure01??0)),lastBytesBefore:Math.floor(numeric(r.lastBytesBefore,0)),lastBytesAfter:Math.floor(numeric(r.lastBytesAfter,0)),
      bytesSavedTotal:Math.floor(numeric(r.bytesSavedTotal,0)),lastSaved01:clamp(Number(r.lastSaved01??0)),lastLimits:limits,
      protectedCanonicalBranches:Array.isArray(r.protectedCanonicalBranches)?r.protectedCanonicalBranches.slice(0,64):d.protectedCanonicalBranches.slice()};
  }
  restore(raw?:Partial<B301EconomyState>|null){this.state=B301MobileStateEconomy.normalize(raw);}
  snapshot(){return structuredClone(this.state);}
  limitsFor(input:ResourceInput={}):B301EconomyLimits{
    const profile=input.profile??'balanced';
    const ram=clamp(input.ramPressure01??0), thermal=clamp(input.thermal01??0), energy=clamp(input.bodyEnergy01??.8), capacity=clamp(input.cognitiveCapacity01??.8);
    const pressure=clamp(ram*.52+thermal*.20+(1-energy)*.13+(1-capacity)*.15);
    const tier: B301EconomyTier = profile==='mobile' && pressure>=.72 ? 'emergency' : profile==='mobile' && pressure>=.48 ? 'pressure' : pressure>=.80 ? 'emergency' : pressure>=.56 ? 'pressure' : 'normal';
    this.state.tier=tier; this.state.pressure01=pressure; this.state.lastLimits=tighter(pressure,tier); this.state.inspections++;
    return {...this.state.lastLimits};
  }
  private trim(target:any,path:string[],limit:number,head=false){const current=nested(target,path); if(Array.isArray(current)) setNested(target,path,head?trimHead(current,limit):trimTail(current,limit));}
  compact<T extends object>(target:T,input:ResourceInput={}):{tier:B301EconomyTier;beforeBytes:number;afterBytes:number;savedBytes:number;saved01:number;limits:B301EconomyLimits;compactedPaths:string[]} {
    const limits=this.limitsFor(input); const compactedPaths:string[]=[];
    const rules:[string[],number,boolean][]=[
      [['traces'],limits.traces,true],
      [['facets','memory','eventLog'],limits.eventLog,true],
      [['facets','memory','autobiographicalMemories'],limits.autobiographicalMemories,true],
      [['system','actionOwnershipGraphB298','checkpoints'],limits.ownershipCheckpoints,false],
      [['facets','learning','p30','provenance','nodes'],limits.p30Nodes,false],
      [['facets','learning','p30','provenance','edges'],limits.p30Edges,false],
      [['facets','advanced','p49TemporalLife','episodes'],limits.p49Episodes,false],
      [['facets','advanced','p49TemporalLife','seenEventIds'],limits.p49SeenEventIds,true],
      [['facets','advanced','p84AutobiographicalContinuity','moments'],limits.p84Moments,false],
      [['system','neuralAutobiographicalIdentityB284','episodes'],limits.b284Episodes,false],
      [['system','neuralLifeConsolidationB285','episodes'],limits.b285Episodes,false],
      [['system','recurrentCausalMemory','episodes'],limits.recurrentEpisodes,false],
      [['system','shadowOrganism','recent'],limits.shadowRecent,true],
      [['system','longHorizonPrediction','recent'],limits.longHorizonRecent,true],
      [['system','emotionAppraisal','history'],limits.emotionHistory,false],
      [['facets','embodiment','p42Experience','history'],limits.p42History,false],
      [['facets','advanced','p58CognitiveKernel','frames'],limits.p58Frames,false],
      [['system','cognitiveDomainClosure','recent'],limits.cognitiveDomainClosureRecent,true],
      [['facets','embodiment','p40SemanticIntelligence','claims'],limits.p40SemanticClaims,true],
      [['facets','embodiment','p40SemanticIntelligence','situations'],limits.p40SemanticSituations,true],
      [['facets','embodiment','p40SemanticIntelligence','hypotheses'],limits.p40SemanticHypotheses,true],
      [['system','neuralExperienceBranch','embodiedBridge','transitionsLog'],limits.embodiedTransitions,true],
      [['system','neuralExperienceBranch','replayBuffer'],limits.neuralReplay,false],
      [['facets','evolution','network','history'],limits.evolutionNetworkHistory,false],
      [['facets','evolution','agency','records'],limits.agencyRecords,false],
    ];
    const pathsToCompact:[string[],number,boolean][]=[];
    for(const [path,limit,head] of rules){const beforeValue=nested(target,path);if(Array.isArray(beforeValue)&&beforeValue.length>limit)pathsToCompact.push([path,limit,head]);}
    if(pathsToCompact.length===0){
      this.state.cyclesObserved++;
      this.state.lastBytesBefore=0; this.state.lastBytesAfter=0; this.state.lastSaved01=0; this.state.lastReason='no-compaction-needed';
      return {tier:this.state.tier,beforeBytes:0,afterBytes:0,savedBytes:0,saved01:0,limits,compactedPaths};
    }
    const pressureHigh=this.state.tier==='emergency'||clamp(input.ramPressure01??0)>.72||clamp(input.thermal01??0)>.82;
    const dueByCadence=input.tick==null || Number(input.tick)%8===0 || this.state.cyclesObserved<2;
    const farOverBudget=pathsToCompact.some(([path,limit])=>{const v=nested(target,path);return Array.isArray(v)&&v.length>Math.max(limit*1.5,limit+4);});
    if(!input.forceCompaction && !pressureHigh && !dueByCadence && !farOverBudget){
      this.state.cyclesObserved++;
      this.state.lastBytesBefore=0; this.state.lastBytesAfter=0; this.state.lastSaved01=0; this.state.lastReason='bounded-compaction-deferred';
      return {tier:this.state.tier,beforeBytes:0,afterBytes:0,savedBytes:0,saved01:0,limits,compactedPaths};
    }
    const before=pathsToCompact.reduce((sum,[path])=>sum+pathBytes(target,path),0);
    for(const [path,limit,head] of pathsToCompact){this.trim(target,path,limit,head);compactedPaths.push(path.join('.'));}
    const after=pathsToCompact.reduce((sum,[path])=>sum+pathBytes(target,path),0),saved=Math.max(0,before-after),saved01=before>0?clamp(saved/before):0;
    this.state.compactions += compactedPaths.length>0?1:0; this.state.cyclesObserved++; this.state.lastBytesBefore=before; this.state.lastBytesAfter=after; this.state.bytesSavedTotal+=saved; this.state.lastSaved01=saved01;
    this.state.lastReason=compactedPaths.length?`bounded-history-compaction:${compactedPaths.length}`:'no-compaction-needed';
    return {tier:this.state.tier,beforeBytes:before,afterBytes:after,savedBytes:saved,saved01,limits,compactedPaths};
  }
  diagnostics(){return structuredClone(this.state);}
}
