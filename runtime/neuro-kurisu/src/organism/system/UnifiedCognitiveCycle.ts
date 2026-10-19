/**
 * BIG PASS 162 — Unified Cognitive Cycle contract and evidence aggregation.
 *
 * This turns the existing event/evidence streams into a bounded acceptance
 * contract. A cycle only counts as complete when it has the causal stages needed
 * to connect experience with a consequence and subsequent adaptation.
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

const REQUIRED:UnifiedCycleStage[]=['observation','prediction','action','outcome','learning','self-update'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export const defaultUnifiedCognitiveCycle=():UnifiedCognitiveCycleState=>({version:1,cycles:0,completeCycles:0,incompleteCycles:0,brokenLineages:0,meanStageCoverage01:0,meanCausalContinuity01:0,lastTick:-1,lastComplete:false,lastMissingStages:[...REQUIRED]});

export class UnifiedCognitiveCycle {
  private state=defaultUnifiedCognitiveCycle();
  restore(raw?:Partial<UnifiedCognitiveCycleState>|null){this.state={...defaultUnifiedCognitiveCycle(),...(raw??{}),version:1,cycles:Math.max(0,Number(raw?.cycles??0)),completeCycles:Math.max(0,Number(raw?.completeCycles??0)),incompleteCycles:Math.max(0,Number(raw?.incompleteCycles??0)),brokenLineages:Math.max(0,Number(raw?.brokenLineages??0)),meanStageCoverage01:clamp01(Number(raw?.meanStageCoverage01??0)),meanCausalContinuity01:clamp01(Number(raw?.meanCausalContinuity01??0)),lastTick:Number(raw?.lastTick??-1),lastComplete:Boolean(raw?.lastComplete),lastMissingStages:Array.isArray(raw?.lastMissingStages)?raw!.lastMissingStages as UnifiedCycleStage[]:[...REQUIRED]};}
  evaluate(input:{tick:number;stageIds:Partial<Record<UnifiedCycleStage,string|undefined>>;parentIntegrity01:number}):UnifiedCognitiveCycleResult{
    const present=REQUIRED.filter(stage=>Boolean(input.stageIds[stage]));
    const missing=REQUIRED.filter(stage=>!input.stageIds[stage]);
    const coverage=present.length/REQUIRED.length;
    const causal=clamp01(input.parentIntegrity01);
    const complete=missing.length===0 && causal>=0.5;
    const cycles=this.state.cycles+1;
    this.state={...this.state,cycles,completeCycles:this.state.completeCycles+(complete?1:0),incompleteCycles:this.state.incompleteCycles+(complete?0:1),brokenLineages:this.state.brokenLineages+(causal<0.5?1:0),meanStageCoverage01:clamp01((this.state.meanStageCoverage01*this.state.cycles+coverage)/cycles),meanCausalContinuity01:clamp01((this.state.meanCausalContinuity01*this.state.cycles+causal)/cycles),lastTick:Math.max(0,Math.floor(input.tick)),lastComplete:complete,lastMissingStages:missing};
    return {tick:Math.max(0,Math.floor(input.tick)),stageCoverage01:coverage,causalContinuity01:causal,complete,missingStages:missing};
  }
  snapshot(){return structuredClone(this.state);}
}
