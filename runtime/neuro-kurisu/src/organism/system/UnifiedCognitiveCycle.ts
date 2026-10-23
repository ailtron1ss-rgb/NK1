import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

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
  /** Accepted event identities carried forward from the canonical event fabric. */
  stageIds:Partial<Record<UnifiedCycleStage,string>>;
  /** Explicit observation anchor for downstream memory/action evidence joins. */
  observationId:string|null;
}

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
    let source:Partial<UnifiedCognitiveCycleState>;
    try {
      source=snapshotPlainData<Partial<UnifiedCognitiveCycleState>>(raw??{}, {
        allowNonFiniteNumbers:true, maxDepth:12, maxNodes:4096, maxStringUnits:64*1024,
      });
    } catch {
      // Invalid persisted state must not execute getters or corrupt the live cycle.
      this.state=defaultUnifiedCognitiveCycle();
      return;
    }
    if(source===null||typeof source!=='object'||Array.isArray(source)) {
      this.state=defaultUnifiedCognitiveCycle();
      return;
    }
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
    const rawMissing=hasMissingArray?source.lastMissingStages as unknown[]:[...REQUIRED];
    const malformedMissing=rawMissing.some((stage)=>typeof stage!=='string'||!ALL_STAGES.has(stage as UnifiedCycleStage));
    const filteredMissing=[...new Set(rawMissing.filter((stage):stage is UnifiedCycleStage=>typeof stage==='string'&&ALL_STAGES.has(stage as UnifiedCycleStage)))];
    const normalizedMissing=malformedMissing?[...REQUIRED]:filteredMissing;
    const lastTick=typeof source.lastTick==='number'&&Number.isSafeInteger(source.lastTick)&&source.lastTick>=-1?source.lastTick:-1;
    const missing=cycles===0&&normalizedMissing.length===0?[...REQUIRED]:normalizedMissing;
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

  evaluate(rawInput:{tick:number;stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>;parentIntegrity01:number}):UnifiedCognitiveCycleResult {
    // Snapshot before dereferencing any caller-owned property: TypeScript types do
    // not protect this public runtime boundary from getters, proxies, cycles or
    // oversized payloads. Invalid ingress must not execute code or mutate state.
    type CycleInput={tick:number;stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>;parentIntegrity01:number};
    let input:CycleInput;
    try {
      input=snapshotPlainData<CycleInput>(rawInput,{
        maxDepth:6,maxNodes:128,maxStringUnits:16*1024,
      });
    } catch {
      throw new TypeError('cognitive cycle input data boundary rejected');
    }
    if(input===null||typeof input!=='object'||Array.isArray(input))throw new TypeError('cognitive cycle input must be an object');
    const allowedInputKeys=new Set(['tick','stageIds','parentIntegrity01']);
    if(Object.keys(input).some(key=>!allowedInputKeys.has(key)))throw new TypeError('cognitive cycle input contains unknown fields');
    if(input.stageIds===null||typeof input.stageIds!=='object'||Array.isArray(input.stageIds))throw new TypeError('stageIds must be an object');
    if(Object.keys(input.stageIds).some(stage=>!ALL_STAGES.has(stage as UnifiedCycleStage)))throw new TypeError('stageIds contains an unknown cognitive stage');
    if(!Number.isSafeInteger(input.tick)||input.tick<0)throw new RangeError('cognitive cycle tick must be a non-negative safe integer');
    if(input.tick<=this.state.lastTick)throw new RangeError('cognitive cycle tick must strictly increase');
    if(typeof input.parentIntegrity01!=='number'||!Number.isFinite(input.parentIntegrity01)||input.parentIntegrity01<0||input.parentIntegrity01>1) {
      throw new RangeError('parentIntegrity01 must be a finite value in [0, 1]');
    }

    if(this.state.cycles>=Number.MAX_SAFE_INTEGER)throw new RangeError('cognitive cycle counter reached its safe integer limit');
    const validIds:Partial<Record<UnifiedCycleStage,string>>={};
    for(const stage of ALL_STAGES) {
      // Only explicitly supplied stage IDs are evidence; inherited properties
      // from polluted prototypes must never satisfy a required cognitive step.
      const id=Object.hasOwn(input.stageIds,stage)?input.stageIds[stage]:undefined;
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
    const causal=input.parentIntegrity01;
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
      lastTick:input.tick,
      lastComplete:complete,
      lastMissingStages:missing,
    };
    return {
      tick:input.tick,stageCoverage01:coverage,causalContinuity01:causal,complete,
      missingStages:[...missing],stageIds:{...validIds},observationId:validIds.observation??null,
    };
  }

  snapshot():UnifiedCognitiveCycleState {
    return structuredClone({...this.state,lastMissingStages:[...this.state.lastMissingStages]});
  }
}
