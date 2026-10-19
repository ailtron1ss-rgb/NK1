/**
 * P56 — Integrated Developmental Mind.
 *
 * A control-plane for the already existing developmental organs.  It does not
 * pretend that one score is intelligence or consciousness.  It arbitrates the
 * developmental mode from independent evidence and produces a bounded plan.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export type P56Mode='observe'|'repair'|'consolidate'|'experiment'|'protect'|'explore';
export interface P56Signals {
  predictionError01:number; selfPredictionError01:number; identity01:number;
  grounding01:number; causalAlignment01:number; workspace01:number;
  interoceptiveError01:number; uncertainty01:number; novelty01:number;
  memoryPressure01:number; developmentalReadiness01:number; realityGap01:number;
}
export interface P56Plan { mode:P56Mode; priority01:number; confidence01:number; reasons:string[]; nextEvidence:string[]; }
export interface P56State {
  version:1; cycles:number; assessments:number; planned:number; protectedCycles:number;
  meanIntegrated01:number; meanRealityGap01:number; meanStability01:number;
  modeCounts:Record<P56Mode,number>; lastPlan:P56Plan|null; lastAt:number;
  history:Array<{tick:number;at:number;mode:P56Mode;priority01:number;confidence01:number;realityGap01:number}>;
}
export const defaultP56=():P56State=>({
  version:1,cycles:0,assessments:0,planned:0,protectedCycles:0,
  meanIntegrated01:.45,meanRealityGap01:.5,meanStability01:.8,
  modeCounts:{observe:0,repair:0,consolidate:0,experiment:0,protect:0,explore:0},
  lastPlan:null,lastAt:0,history:[]
});

export class P56IntegratedDevelopmentalMind {
  private state=defaultP56();
  restore(raw?:Partial<P56State>|null){const d=defaultP56(),r=raw??{};this.state={...d,...r,modeCounts:{...d.modeCounts,...(r.modeCounts??{})},history:Array.isArray(r.history)?r.history.slice(-96):[]};}
  snapshot(){return structuredClone(this.state);}
  assess(tick:number,at:number,s:P56Signals):P56Plan{
    const pe=clamp(s.predictionError01), spe=clamp(s.selfPredictionError01), id=clamp(s.identity01), gr=clamp(s.grounding01), ca=clamp(s.causalAlignment01), ws=clamp(s.workspace01), ie=clamp(s.interoceptiveError01), un=clamp(s.uncertainty01), no=clamp(s.novelty01), mp=clamp(s.memoryPressure01), dr=clamp(s.developmentalReadiness01), rg=clamp(s.realityGap01);
    const pressure={
      protect:Math.max(ie*.55, rg*.45 + (1-id)*.55),
      repair:pe*.44 + spe*.26 + (1-gr)*.12 + (1-ca)*.18,
      consolidate:mp*.38 + Math.max(0, .72-no)*.18 + Math.max(0,.75-ws)*.20,
      experiment:un*.22 + pe*.18 + no*.15 + dr*.22 + ca*.08,
      explore:no*.34 + un*.28 + (1-gr)*.10 + dr*.12,
      observe:(1-Math.max(pe,spe,ie,rg))*0.45 + ws*.18 + id*.12,
    } satisfies Record<P56Mode,number>;
    const mode=(Object.entries(pressure).sort((a,b)=>b[1]-a[1])[0]?.[0]??'observe') as P56Mode;
    const priority=clamp(pressure[mode]);
    const sorted=Object.entries(pressure).sort((a,b)=>b[1]-a[1]);
    const confidence=clamp(.35 + Math.max(0,sorted[0][1]-sorted[1][1])*.9 + (1-rg)*.18);
    const reasons:string[]=[];
    if(pe>.45)reasons.push('prediction-error'); if(spe>.4)reasons.push('self-prediction-error'); if(mp>.55)reasons.push('memory-pressure'); if(ie>.4)reasons.push('interoceptive-pressure'); if(rg>.35)reasons.push('reality-gap'); if(no>.58)reasons.push('novelty'); if(un>.58)reasons.push('uncertainty');
    if(!reasons.length)reasons.push('stable-observation');
    const nextEvidence = mode==='protect'?['stable-body-state','identity-continuity','external-outcome']:
      mode==='repair'?['repeat-after-intervention','prediction-outcome-pair']:
      mode==='consolidate'?['memory-retrieval-test','post-consolidation-stability']:
      mode==='experiment'?['controlled-comparison','holdout-outcome']:
      mode==='explore'?['novel-context','cross-context-transfer']:
      ['independent-outcome','replay-consistency'];
    const plan={mode,priority01:priority,confidence01:confidence,reasons,nextEvidence};
    this.state.cycles++; this.state.assessments++; this.state.planned++; this.state.modeCounts[mode]++; this.state.lastPlan=plan; this.state.lastAt=at;
    this.state.meanIntegrated01=clamp(this.state.meanIntegrated01*.94 + clamp((id+gr+ca+ws+(1-ie)+(1-rg)+(1-pe)+(1-spe))/7)*.06);
    this.state.meanRealityGap01=clamp(this.state.meanRealityGap01*.94 + rg*.06);
    this.state.meanStability01=clamp(this.state.meanStability01*.95 + clamp((id+ws+1-ie)/3)*.05);
    if(mode==='protect')this.state.protectedCycles++;
    this.state.history=[...this.state.history,{tick,at,mode,priority01:priority,confidence01:confidence,realityGap01:rg}].slice(-96);
    return structuredClone(plan);
  }
}
