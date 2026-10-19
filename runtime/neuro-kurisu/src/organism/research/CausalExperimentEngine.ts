export interface TrialSummary{condition:string;cycles:number;autonomyRate:number;actionEntropy:number;selfPrediction:number;identityContinuity:number;workspaceIgnition:number;intrinsicGoalRate:number;valueRevisions:number;}
import type { CausalExperimentRecord } from '../core/types.ts';
export type { CausalExperimentRecord };
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const effect=(a:number,b:number)=>Math.abs(b-a)/(Math.abs(a)+Math.abs(b)+0.0001);
export class CausalExperimentEngine{
  compare(control:TrialSummary,treatment:TrialSummary):CausalExperimentRecord[]{
    const pairs:[string,keyof TrialSummary][]=[['autonomyRate','autonomyRate'],['actionEntropy','actionEntropy'],['selfPrediction','selfPrediction'],['identityContinuity','identityContinuity'],['workspaceIgnition','workspaceIgnition'],['intrinsicGoalRate','intrinsicGoalRate'],['valueRevisions','valueRevisions']];
    return pairs.map(([metric,key])=>{
      const a=Number(control[key]??0),b=Number(treatment[key]??0),d=b-a;
      return{id:`causal-${Date.now()}-${Math.random().toString(16).slice(2)}`,control:control.condition,treatment:treatment.condition,metric,controlValue:a,treatmentValue:b,delta:d,standardizedEffect:effect(a,b),interpretation:Math.abs(d)<0.02?'negligible':d>0?'treatment increases metric':'treatment decreases metric',at:Date.now()};
    });
  }
  paired(records:CausalExperimentRecord[]):{coverage:number;meanAbsEffect:number;meanDelta:number}{
    if(!records.length)return{coverage:0,meanAbsEffect:0,meanDelta:0};
    return{coverage:1,meanAbsEffect:records.reduce((s,r)=>s+Math.abs(r.standardizedEffect),0)/records.length,meanDelta:records.reduce((s,r)=>s+r.delta,0)/records.length};
  }
}
