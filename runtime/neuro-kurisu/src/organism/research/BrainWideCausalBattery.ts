import type { TrialSummary } from './CausalExperimentEngine.ts';

export type CausalBatteryStatus='insufficient'|'ambiguous'|'supported';
export interface CausalBatteryRun { id:string; control:TrialSummary; treatment:TrialSummary; sham?:TrialSummary; lesion?:TrialSummary; }
export interface CausalBatteryMetric {
  metric:keyof TrialSummary;
  runs:number;
  meanDelta:number;
  meanAbsDelta:number;
  directionConsistency01:number;
  nonNegligibleRate01:number;
  status:CausalBatteryStatus;
}
export interface CausalBatteryResult {
  version:1;
  runs:number;
  metrics:CausalBatteryMetric[];
  reproducible01:number;
  status:CausalBatteryStatus;
  warning:string;
}

const METRICS:Array<keyof TrialSummary>=['autonomyRate','actionEntropy','selfPrediction','identityContinuity','workspaceIgnition','intrinsicGoalRate','valueRevisions'];
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

export class BrainWideCausalBattery {
  evaluate(runs:CausalBatteryRun[]):CausalBatteryResult {
    const metrics=METRICS.map(metric=>{
      const deltas=runs.map(r=>Number(r.treatment[metric]??0)-Number(r.control[metric]??0));
      const nonzero=deltas.filter(d=>Math.abs(d)>=.02);
      const positives=nonzero.filter(d=>d>0).length, negatives=nonzero.filter(d=>d<0).length;
      const directionConsistency=nonzero.length?Math.max(positives,negatives)/nonzero.length:1;
      const meanDelta=deltas.length?deltas.reduce((s,d)=>s+d,0)/deltas.length:0;
      const meanAbsDelta=deltas.length?deltas.reduce((s,d)=>s+Math.abs(d),0)/deltas.length:0;
      const nonNegligibleRate=deltas.length?nonzero.length/deltas.length:0;
      const status:CausalBatteryStatus=runs.length<3||nonzero.length<2?'insufficient':directionConsistency<.67?'ambiguous':'supported';
      return {metric,runs:deltas.length,meanDelta,meanAbsDelta,directionConsistency01:clamp(directionConsistency),nonNegligibleRate01:clamp(nonNegligibleRate),status};
    });
    const reproducible=runs.length<3?0:metrics.reduce((s,m)=>s+m.directionConsistency01,0)/metrics.length;
    const supported=metrics.filter(m=>m.status==='supported').length;
    const status=runs.length<3?'insufficient':supported>=Math.ceil(metrics.length*.6)?'supported':'ambiguous';
    return {version:1,runs:runs.length,metrics,reproducible01:clamp(reproducible),status,warning:'Causal consistency is evidence about intervention effects, not evidence of phenomenal consciousness.'};
  }
}
