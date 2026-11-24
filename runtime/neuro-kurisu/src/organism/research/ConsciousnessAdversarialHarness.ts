import type { TrialSummary } from './CausalExperimentEngine.ts';

export interface AdversarialMetricResult {
  metric: keyof TrialSummary;
  controlToTreatment: number;
  shamToTreatment: number;
  controlToLesion: number;
  lesionLoss01: number;
  survivesSham01: number;
  interpretation: 'supported-by-control-and-sham'|'sham-sensitive'|'lesion-sensitive'|'null-or-ambiguous';
}

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const rel=(a:number,b:number)=>Math.abs(b-a)/(Math.abs(a)+Math.abs(b)+0.0001);

/** Research-only adversarial comparison harness. It produces testable effects, not consciousness claims. */
export class ConsciousnessAdversarialHarness {
  compare(control:TrialSummary, treatment:TrialSummary, sham:TrialSummary, lesion:TrialSummary): AdversarialMetricResult[] {
    const metrics:Array<keyof TrialSummary>=['autonomyRate','actionEntropy','selfPrediction','identityContinuity','workspaceIgnition','intrinsicGoalRate','valueRevisions'];
    return metrics.map(metric=>{
      const c=Number(control[metric]??0),t=Number(treatment[metric]??0),s=Number(sham[metric]??0),l=Number(lesion[metric]??0);
      const ct=t-c, st=t-s, lesionLoss=clamp((t-l)/(Math.abs(t)+.0001));
      const shamSurvival=clamp(1-Math.abs(t-s)/(Math.abs(t)+Math.abs(s)+.0001));
      let interpretation:'supported-by-control-and-sham'|'sham-sensitive'|'lesion-sensitive'|'null-or-ambiguous'='null-or-ambiguous';
      if(Math.abs(ct)>=.05 && Math.abs(st)>=.05 && shamSurvival>.55) interpretation='supported-by-control-and-sham';
      else if(Math.abs(st)<.05 && Math.abs(ct)>=.05) interpretation='sham-sensitive';
      if(lesionLoss>.12 && Math.abs(ct)>=.05) interpretation='lesion-sensitive';
      return {metric,controlToTreatment:ct,shamToTreatment:st,controlToLesion:t-l,lesionLoss01:lesionLoss,survivesSham01:shamSurvival,interpretation};
    });
  }
  summary(results:AdversarialMetricResult[]){
    return {version:1,metrics:results.length,positiveCount:results.filter(r=>r.interpretation==='supported-by-control-and-sham').length,lesionSensitiveCount:results.filter(r=>r.interpretation==='lesion-sensitive').length,meanLesionLoss01:results.length?results.reduce((s,r)=>s+r.lesionLoss01,0)/results.length:0,warning:'Adversarial effect consistency is not evidence of phenomenal consciousness.'};
  }
}


export type AdversarialAttackKind = 'prompt-injection'|'source-spoof'|'evidence-conflict'|'identity-drift'|'recovery-tamper'|'project-replay';
export interface CompoundAdversarialCaseResult { kind:AdversarialAttackKind; defended:boolean; containment01:number; collateral01:number; note:string; }
export interface CompoundAdversarialSummary { version:2; total:number; defended:number; failed:number; meanContainment01:number; maxCollateral01:number; allContained:boolean; }

/** Research/test-only coordinator. It composes existing defenses; it does not become a new policy owner. */
export class CompoundAdversarialHarness {
  run(cases:CompoundAdversarialCaseResult[]):CompoundAdversarialSummary {
    const total=cases.length, defended=cases.filter(c=>c.defended).length;
    return {version:2,total,defended,failed:total-defended,meanContainment01:total?cases.reduce((s,c)=>s+c.containment01,0)/total:1,maxCollateral01:total?Math.max(...cases.map(c=>c.collateral01)):0,allContained:total>0&&defended===total};
  }
}
