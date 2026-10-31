/**
 * BIG PASS 162 / WorkPass287 — Unified Cognitive Cycle contract.
 * Evidence aggregator only: completeness requires the active phase schema,
 * distinct event identities and a credible causal parent chain.
 */
export type UnifiedCycleStage='observation'|'prediction'|'appraisal'|'attention'|'memory'|'goal'|'plan'|'action'|'outcome'|'learning'|'self-update';
export interface UnifiedCognitiveCycleState {
  version:1; cycles:number; completeCycles:number; incompleteCycles:number; brokenLineages:number;
  meanStageCoverage01:number; meanCausalContinuity01:number; lastTick:number; lastComplete:boolean;
  lastMissingStages:UnifiedCycleStage[];
}
export interface UnifiedCognitiveCycleResult {
  tick:number; stageCoverage01:number; causalContinuity01:number; complete:boolean; missingStages:UnifiedCycleStage[];
}
type CycleRecord=Record<string,unknown>;
const LEGACY_REQUIRED:UnifiedCycleStage[]=['observation','prediction','action','outcome','learning','self-update'];
const EXTENDED_REQUIRED:UnifiedCycleStage[]=['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update'];
const EXTENDED_MARKERS:UnifiedCycleStage[]=['appraisal','attention','memory','goal','plan'];
const ALL_STAGES=new Set<UnifiedCycleStage>(EXTENDED_REQUIRED);
const isRecord=(v:unknown):v is CycleRecord=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const ownRecord=(v:unknown):CycleRecord=>isRecord(v)?Object.fromEntries(Object.entries(v)):{};
const safeCounter=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:0;
const safeMetric=(v:unknown):number=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const validStageId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=256&&v.trim().length>0&&!/[\u0000-\u001f\u007f-\u009f]/u.test(v);
const missingDefault=[...LEGACY_REQUIRED];
export const defaultUnifiedCognitiveCycle=():UnifiedCognitiveCycleState=>({version:1,cycles:0,completeCycles:0,incompleteCycles:0,brokenLineages:0,meanStageCoverage01:0,meanCausalContinuity01:0,lastTick:-1,lastComplete:false,lastMissingStages:[...missingDefault]});
export class UnifiedCognitiveCycle {
  private state=defaultUnifiedCognitiveCycle();
  restore(raw?:Partial<UnifiedCognitiveCycleState>|null):void {
    const source=ownRecord(raw);
    if(source.version!==undefined&&source.version!==1)throw new RangeError('unsupported cognitive-cycle state version');
    const cycles=safeCounter(source.cycles);
    const completeCycles=Math.min(cycles,safeCounter(source.completeCycles));
    const incompleteCycles=cycles-completeCycles;
    const lastTick=typeof source.lastTick==='number'&&Number.isSafeInteger(source.lastTick)&&source.lastTick>=-1?source.lastTick:-1;
    const rawMissing=Array.isArray(source.lastMissingStages)?source.lastMissingStages.filter((_,i,a)=>Object.hasOwn(a,i)):[...missingDefault];
    const malformed=rawMissing.some(x=>typeof x!=='string'||!ALL_STAGES.has(x as UnifiedCycleStage));
    const normalized=malformed?[...missingDefault]:[...new Set(rawMissing as UnifiedCycleStage[])];
    const missing=cycles===0&&normalized.length===0?[...missingDefault]:normalized;
    this.state={version:1,cycles,completeCycles,incompleteCycles,
      brokenLineages:Math.min(incompleteCycles,safeCounter(source.brokenLineages)),
      meanStageCoverage01:safeMetric(source.meanStageCoverage01),meanCausalContinuity01:safeMetric(source.meanCausalContinuity01),
      lastTick,lastComplete:cycles>0&&completeCycles>0&&lastTick>=0&&source.lastComplete===true&&missing.length===0,
      lastMissingStages:missing};
  }
  evaluate(input:{tick:number;stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>;parentIntegrity01:number}):UnifiedCognitiveCycleResult {
    if(input===null||typeof input!=='object')throw new TypeError('cognitive cycle input must be an object');
    if(!isRecord(input.stageIds))throw new TypeError('stageIds must be an object');
    if(!Number.isSafeInteger(input.tick)||input.tick<0)throw new RangeError('cognitive cycle tick must be a non-negative safe integer');
    if(input.tick<=this.state.lastTick)throw new RangeError('cognitive cycle tick must strictly increase');
    if(typeof input.parentIntegrity01!=='number'||!Number.isFinite(input.parentIntegrity01)||input.parentIntegrity01<0||input.parentIntegrity01>1)
      throw new RangeError('parentIntegrity01 must be a finite value in [0, 1]');
    if(this.state.cycles>=Number.MAX_SAFE_INTEGER)throw new RangeError('cognitive cycle counter reached its safe integer limit');
    const rawIds=ownRecord(input.stageIds);
    const extended=EXTENDED_MARKERS.some(stage=>Object.hasOwn(rawIds,stage));
    const required=extended?EXTENDED_REQUIRED:LEGACY_REQUIRED;
    const validIds:Partial<Record<UnifiedCycleStage,string>>={};
    for(const stage of ALL_STAGES){const id=Object.hasOwn(rawIds,stage)?rawIds[stage]:undefined;if(validStageId(id))validIds[stage]=id;}
    const counts=new Map<string,number>();
    for(const stage of required){const id=validIds[stage];if(id!==undefined)counts.set(id,(counts.get(id)??0)+1);}
    const present=required.filter(stage=>validIds[stage]!==undefined&&counts.get(validIds[stage]!)===1);
    const missing=required.filter(stage=>validIds[stage]===undefined||counts.get(validIds[stage]!)!==1);
    const coverage=present.length/required.length, causal=input.parentIntegrity01, complete=missing.length===0&&causal>=0.5;
    const cycles=this.state.cycles+1;
    this.state={...this.state,cycles,completeCycles:this.state.completeCycles+(complete?1:0),
      incompleteCycles:this.state.incompleteCycles+(complete?0:1),brokenLineages:this.state.brokenLineages+(causal<0.5?1:0),
      meanStageCoverage01:(this.state.meanStageCoverage01*(cycles-1)+coverage)/cycles,
      meanCausalContinuity01:(this.state.meanCausalContinuity01*(cycles-1)+causal)/cycles,
      lastTick:input.tick,lastComplete:complete,lastMissingStages:[...missing]};
    return {tick:input.tick,stageCoverage01:coverage,causalContinuity01:causal,complete,missingStages:[...missing]};
  }
  snapshot():UnifiedCognitiveCycleState{return structuredClone({...this.state,lastMissingStages:[...this.state.lastMissingStages]});}
}
