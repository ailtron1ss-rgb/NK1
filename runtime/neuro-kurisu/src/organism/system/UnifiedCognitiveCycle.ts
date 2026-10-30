/**
 * BIG PASS 162 / WorkPass287 — Unified Cognitive Cycle contract.
 *
 * The cycle is an evidence aggregator, not a consciousness claim. It counts a
 * cycle as complete only when required stages have bounded identities and the
 * causal parent chain is credible. Restored counters are untrusted persistence.
 */
export type UnifiedCycleStage='observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'self-update';

export interface UnifiedCognitiveCycleState {
  version:1;
  cycles:number;
  completeCycles:number;
  incompleteCycles:number;
  brokenLineages:number;
  meanStageCoverage01:number;
  meanCausalContinuity01:number;
  lastTick:number;
  lastComplete:boolean;
  lastMissingStages:UnifiedCycleStage[];
}

export interface UnifiedCognitiveCycleResult {
  tick:number;
  stageCoverage01:number;
  causalContinuity01:number;
  complete:boolean;
  missingStages:UnifiedCycleStage[];
}

const LEGACY_REQUIRED:UnifiedCycleStage[]=['observation','prediction','action','outcome','learning','self-update'];
const EXTENDED_REQUIRED:UnifiedCycleStage[]=['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update'];
const EXTENDED_MARKERS:UnifiedCycleStage[]=['appraisal','attention','memory','goal','plan'];
const ALL_STAGES=new Set<UnifiedCycleStage>(EXTENDED_REQUIRED);
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
const safeCounter=(value:unknown):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const safeMetric=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?clamp01(value):0;
const validStageId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim().length>0&&!/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const ownRecord=(value:unknown):Record<string,unknown> => {
  if(value===null||typeof value!=='object'||Array.isArray(value))return Object.create(null) as Record<string,unknown>;
  const result=Object.create(null) as Record<string,unknown>;
  let keys:string[];
  try{keys=Object.keys(value);}catch{return result;}
  for(const key of keys.slice(0,32)){
    try{
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))continue;
      Object.defineProperty(result,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
    }catch{/* restore uses conservative defaults for malformed snapshot fields */}
  }
  return result;
};
const ownArrayValues=(value:unknown,max:number):{values:unknown[];valid:boolean}=>{
  if(!Array.isArray(value))return {values:[],valid:false};
  try{
    const lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');
    if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0)return {values:[],valid:false};
    const length=lengthDescriptor.value;
    const values:unknown[]=[];
    let valid=length<=max;
    for(let i=0;i<Math.min(length,max);i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||!Object.hasOwn(descriptor,'value')){valid=false;continue;}
      values.push(descriptor.value);
    }
    return {values,valid};
  }catch{return {values:[],valid:false};}
};
const isRecordLike=(value:unknown):value is Record<string,unknown> => value!==null&&typeof value==='object'&&!Array.isArray(value);
const ownValue=(record:unknown,key:string):unknown=>{
  if(record===null||typeof record!=='object')return undefined;
  try{
    const descriptor=Object.getOwnPropertyDescriptor(record,key);
    return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;
  }catch{return undefined;}
};

export const defaultUnifiedCognitiveCycle=():UnifiedCognitiveCycleState=>({version:1,cycles:0,completeCycles:0,incompleteCycles:0,brokenLineages:0,meanStageCoverage01:0,meanCausalContinuity01:0,lastTick:-1,lastComplete:false,lastMissingStages:[...LEGACY_REQUIRED]});

export class UnifiedCognitiveCycle {
  private state=defaultUnifiedCognitiveCycle();

  restore(raw?:Partial<UnifiedCognitiveCycleState>|null):void {
    const source=ownRecord(raw);
    const cycles=safeCounter(source.cycles);
    // Restored counters must describe one coherent history: complete and
    // incomplete are disjoint subsets of cycles, and broken lineages are a
    // subset of incomplete cycles. Independent clamping can otherwise make
    // aggregate counts exceed the number of observations.
    if(source.version!==undefined&&source.version!==1)throw new RangeError('unsupported cognitive-cycle state version');
    const completeCycles=Math.min(cycles,safeCounter(source.completeCycles));
    // Partition every recorded cycle. Any count not proven complete is
    // conservatively incomplete; otherwise a truncated/corrupt snapshot could
    // silently drop cycles from both outcome buckets.
    const incompleteCycles=cycles-completeCycles;
    const hasMissingArray=Array.isArray(source.lastMissingStages);
    const missingArray=hasMissingArray?ownArrayValues(source.lastMissingStages,64):{values:[...LEGACY_REQUIRED],valid:true};
    const rawMissing:unknown[]=missingArray.values;
    let malformedMissing=hasMissingArray&&!missingArray.valid;
    malformedMissing ||= rawMissing.some((stage)=>typeof stage!=='string'||!ALL_STAGES.has(stage as UnifiedCycleStage));
    const filteredMissing=[...new Set(rawMissing.filter((stage):stage is UnifiedCycleStage=>typeof stage==='string'&&ALL_STAGES.has(stage as UnifiedCycleStage)))];
    const normalizedMissing=malformedMissing?[...LEGACY_REQUIRED]:filteredMissing;
    const lastTick=typeof source.lastTick==='number'&&Number.isSafeInteger(source.lastTick)&&source.lastTick>=-1?source.lastTick:-1;
    const missing=cycles===0&&normalizedMissing.length===0?[...LEGACY_REQUIRED]:normalizedMissing;
    this.state={
      version:1,
      cycles,
      completeCycles,
      incompleteCycles,
      brokenLineages:Math.min(incompleteCycles,safeCounter(source.brokenLineages)),
      meanStageCoverage01:safeMetric(source.meanStageCoverage01),
      meanCausalContinuity01:safeMetric(source.meanCausalContinuity01),
      lastTick,
      lastComplete:cycles>0&&completeCycles>0&&lastTick>=0&&source.lastComplete===true&&missing.length===0,
      lastMissingStages:missing,
    };
  }

  evaluate(input:{tick:number;stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>;parentIntegrity01:number}):UnifiedCognitiveCycleResult {
    const envelope=ownRecord(input);
    const tick=envelope.tick;
    const stageIds=envelope.stageIds;
    const parentIntegrity01=envelope.parentIntegrity01;
    if(!isRecordLike(stageIds))throw new TypeError('stageIds must be an object');
    if(!Number.isSafeInteger(tick)||typeof tick!=='number'||tick<0)throw new RangeError('cognitive cycle tick must be a non-negative safe integer');
    if(tick<=this.state.lastTick)throw new RangeError('cognitive cycle tick must strictly increase');
    if(typeof parentIntegrity01!=='number'||!Number.isFinite(parentIntegrity01)||parentIntegrity01<0||parentIntegrity01>1) {
      throw new RangeError('parentIntegrity01 must be a finite value in [0, 1]');
    }

    if(this.state.cycles>=Number.MAX_SAFE_INTEGER)throw new RangeError('cognitive cycle counter reached its safe integer limit');
    const validIds:Partial<Record<UnifiedCognitiveCycleStage,string>>={};
    for(const stage of ALL_STAGES) {
      // Only explicit own data-property IDs are evidence; inherited fields and
      // accessor-backed IDs are never evaluated or accepted.
      const id=ownValue(stageIds,stage);
      if(validStageId(id))validIds[stage]=id;
    }
    // Preserve six-stage legacy callers, but once a caller advertises any
    // extended phase it must provide the complete eleven-stage spine. This
    // prevents a partially upgraded runtime from claiming a complete cycle.
    const requiresExtendedSpine=EXTENDED_MARKERS.some(stage=>Object.getOwnPropertyDescriptor(stageIds,stage)!==undefined);
    const requiredStages=requiresExtendedSpine?EXTENDED_REQUIRED:LEGACY_REQUIRED;
    // Every required phase must identify a distinct event, including the five
    // extended phases. Reusing an event across two phases is missing evidence.
    const idCounts=new Map<string,number>();
    for(const stage of requiredStages) {
      const id=validIds[stage];
      if(id!==undefined)idCounts.set(id,(idCounts.get(id)??0)+1);
    }
    const present=requiredStages.filter(stage=>validIds[stage]!==undefined&&idCounts.get(validIds[stage]!)===1);
    const missing=requiredStages.filter(stage=>validIds[stage]===undefined||idCounts.get(validIds[stage]!)!==1);
    const coverage=present.length/requiredStages.length;
    const causal=parentIntegrity01;
    const complete=missing.length===0&&causal>=0.5;
    const cycles=this.state.cycles+1;
    this.state={
      ...this.state,
      cycles,
      completeCycles:this.state.completeCycles+(complete?1:0),
      incompleteCycles:this.state.incompleteCycles+(complete?0:1),
      brokenLineages:this.state.brokenLineages+(causal<0.5?1:0),
      meanStageCoverage01:(this.state.meanStageCoverage01*(cycles-1)+coverage)/cycles,
      meanCausalContinuity01:(this.state.meanCausalContinuity01*(cycles-1)+causal)/cycles,
      lastTick:tick,
      lastComplete:complete,
      lastMissingStages:missing,
    };
    return {tick,stageCoverage01:coverage,causalContinuity01:causal,complete,missingStages:[...missing]};
  }

  snapshot():UnifiedCognitiveCycleState {
    return structuredClone({...this.state,lastMissingStages:[...this.state.lastMissingStages]});
  }
}
