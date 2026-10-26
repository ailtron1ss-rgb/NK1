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

const isRecord=(value:unknown):value is Record<string,unknown> =>
  value!==null&&typeof value==='object'&&!Array.isArray(value);

const snapshotOwnDataFields=(value:unknown,fields:readonly string[],context:string):Record<string,unknown>=>{
  if(!isRecord(value))throw new TypeError(context+'-must-be-a-record');
  const copied:Record<string,unknown>=Object.create(null) as Record<string,unknown>;
  for(const key of fields){
    let descriptor:PropertyDescriptor|undefined;
    try { descriptor=Object.getOwnPropertyDescriptor(value,key); }
    catch { throw new TypeError(context+'-field-accessor:'+key); }
    if(!descriptor)continue;
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value')) {
      throw new TypeError(context+'-field-accessor:'+key);
    }
    Object.defineProperty(copied,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
  }
  return copied;
};

const snapshotOwnArrayValues=(value:unknown,context:string,maxLength=64):unknown[]|null=>{
  if(!Array.isArray(value))return null;
  let lengthDescriptor:PropertyDescriptor|undefined;
  try { lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length'); }
  catch { throw new TypeError(context+'-array-length-accessor'); }
  const length=lengthDescriptor&&Object.prototype.hasOwnProperty.call(lengthDescriptor,'value')
    ? lengthDescriptor.value : undefined;
  if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>maxLength) {
    throw new TypeError(context+'-array-length-invalid');
  }
  const copied:unknown[]=[];
  for(let index=0;index<length;index++){
    let descriptor:PropertyDescriptor|undefined;
    try { descriptor=Object.getOwnPropertyDescriptor(value,String(index)); }
    catch { throw new TypeError(context+'-array-element-accessor:'+index); }
    if(!descriptor){
      copied.push(undefined);
      continue;
    }
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value')) {
      throw new TypeError(context+'-array-element-accessor:'+index);
    }
    copied.push(descriptor.value);
  }
  return copied;
};

const REQUIRED:UnifiedCycleStage[]=['observation','prediction','action','outcome','learning','self-update'];
const ALL_STAGES=new Set<UnifiedCycleStage>(['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update']);
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
const safeCounter=(value:unknown):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const safeMetric=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?clamp01(value):0;
const validStageId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim().length>0&&!/[\u0000-\u001f\u007f-\u009f]/u.test(value);

export const defaultUnifiedCognitiveCycle=():UnifiedCognitiveCycleState=>({version:1,cycles:0,completeCycles:0,incompleteCycles:0,brokenLineages:0,meanStageCoverage01:0,meanCausalContinuity01:0,lastTick:-1,lastComplete:false,lastMissingStages:[...REQUIRED]});

export class UnifiedCognitiveCycle {
  private state=defaultUnifiedCognitiveCycle();

  restore(raw?:Partial<UnifiedCognitiveCycleState>|null):void {
    const source=raw===undefined||raw===null?{}:snapshotOwnDataFields(raw,[
      'version','cycles','completeCycles','incompleteCycles','brokenLineages',
      'meanStageCoverage01','meanCausalContinuity01','lastTick','lastComplete','lastMissingStages',
    ],'cognitive-cycle-state');
    const cycles=safeCounter(source.cycles);
    // Restored counters must describe one coherent history: complete and
    // incomplete are disjoint subsets of cycles, and broken lineages are a
    // subset of incomplete cycles. Independent clamping can otherwise make
    // aggregate counts exceed the number of observations.
    if(Object.hasOwn(source,'version')&&source.version!==1) {
      throw new RangeError('unsupported cognitive-cycle state version');
    }
    const completeCycles=Math.min(cycles,safeCounter(source.completeCycles));
    // Partition every recorded cycle. Any count not proven complete is
    // conservatively incomplete; otherwise a truncated/corrupt snapshot could
    // silently drop cycles from both outcome buckets.
    const incompleteCycles=cycles-completeCycles;
    const restoredIncompleteCycles=safeCounter(source.incompleteCycles);
    const restoredBrokenLineages=safeCounter(source.brokenLineages);
    const countersConsistent=
      (source.incompleteCycles===undefined||restoredIncompleteCycles===incompleteCycles)&&
      (source.brokenLineages===undefined||restoredBrokenLineages<=incompleteCycles);
    const rawMissingValue=source.lastMissingStages;
    const copiedMissing=rawMissingValue===undefined?null:snapshotOwnArrayValues(rawMissingValue,'cognitive-cycle-last-missing-stages');
    const hasMissingArray=copiedMissing!==null;
    const rawMissing=hasMissingArray?copiedMissing as unknown[]:[...REQUIRED];
    const malformedMissing=rawMissing.some(stage=>typeof stage!=='string'||!ALL_STAGES.has(stage as UnifiedCycleStage));
    const filteredMissing=[...new Set(rawMissing.filter((stage):stage is UnifiedCycleStage=>typeof stage==='string'&&ALL_STAGES.has(stage as UnifiedCycleStage)))];
    const normalizedMissing=malformedMissing?[...REQUIRED]:filteredMissing;
    const lastTick=typeof source.lastTick==='number'&&Number.isSafeInteger(source.lastTick)&&source.lastTick>=-1?source.lastTick:-1;
    const missing=cycles===0&&normalizedMissing.length===0?[...REQUIRED]:normalizedMissing;
    const nextState:UnifiedCognitiveCycleState={
      version:1,
      cycles,
      completeCycles,
      incompleteCycles,
      brokenLineages:Math.min(incompleteCycles,safeCounter(source.brokenLineages)),
      meanStageCoverage01:safeMetric(source.meanStageCoverage01),
      meanCausalContinuity01:safeMetric(source.meanCausalContinuity01),
      lastTick,
      lastComplete:cycles>0&&completeCycles>0&&lastTick>=0&&source.lastComplete===true&&missing.length===0&&countersConsistent,
      lastMissingStages:missing,
    };
    this.state=nextState;
  }

  /**
   * Preflight the monotonic cycle ledger before a caller appends its completion
   * evidence. Completion writers use this to avoid partial event traces when a
   * restored counter has exhausted the safe-integer range.
   */
  assertCanAdvance(tick:number):void {
    if(!Number.isSafeInteger(tick)||tick<0)throw new RangeError('cognitive cycle tick must be a non-negative safe integer');
    if(tick<=this.state.lastTick)throw new RangeError('cognitive cycle tick must strictly increase');
    if(this.state.cycles>=Number.MAX_SAFE_INTEGER)throw new RangeError('cognitive cycle counter reached its safe integer limit');
  }

  evaluate(input:{tick:number;stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>;parentIntegrity01:number}):UnifiedCognitiveCycleResult {
    if(input===null||typeof input!=='object'||Array.isArray(input)) {
      throw new TypeError('cognitive cycle input must be an object');
    }
    const root=snapshotOwnDataFields(input,['tick','stageIds','parentIntegrity01'],'cognitive-cycle-evaluation-input');
    const tick=root.tick;
    if(typeof tick!=='number'||!Number.isSafeInteger(tick)||tick<0)throw new RangeError('cognitive cycle tick must be a non-negative safe integer');
    if(tick<=this.state.lastTick)throw new RangeError('cognitive cycle tick must strictly increase');
    const parentIntegrity01=root.parentIntegrity01;
    if(typeof parentIntegrity01!=='number'||!Number.isFinite(parentIntegrity01)||parentIntegrity01<0||parentIntegrity01>1) {
      throw new RangeError('parentIntegrity01 must be a finite value in [0, 1]');
    }
    if(root.stageIds===null||typeof root.stageIds!=='object'||Array.isArray(root.stageIds)) {
      throw new TypeError('stageIds must be an object');
    }
    const stageIds=snapshotOwnDataFields(root.stageIds,[...ALL_STAGES],'cognitive-cycle-stage-ids');

    if(this.state.cycles>=Number.MAX_SAFE_INTEGER)throw new RangeError('cognitive cycle counter reached its safe integer limit');
    const validIds:Partial<Record<UnifiedCycleStage,string>>={};
    for(const stage of ALL_STAGES) {
      // Only explicitly supplied own data IDs are evidence; accessors and
      // inherited/polluted properties cannot satisfy a cognitive step.
      const id=stageIds[stage];
      if(validStageId(id))validIds[stage]=id;
    }
    // Distinct required stages must refer to distinct events. Reusing one ID
    // across observation/action/outcome must not manufacture a complete cycle.
    const idCounts=new Map<string,number>();
    for(const stage of REQUIRED) {
      const id=validIds[stage];
      if(id!==undefined)idCounts.set(id,(idCounts.get(id)??0)+1);
    }
    const present=REQUIRED.filter(stage=>validIds[stage]!==undefined&&idCounts.get(validIds[stage]!)===1);
    const missing=REQUIRED.filter(stage=>validIds[stage]===undefined||idCounts.get(validIds[stage]!)!==1);
    const coverage=present.length/REQUIRED.length;
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
