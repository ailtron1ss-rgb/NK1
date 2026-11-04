/**
 * P56 — Integrated Developmental Mind.
 *
 * A control-plane for the already existing developmental organs.  It does not
 * pretend that one score is intelligence or consciousness.  It arbitrates the
 * developmental mode from independent evidence and produces a bounded plan.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const P56_MODES:readonly P56Mode[]=['observe','repair','consolidate','experiment','protect','explore'];
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,240)).slice(0,cap):[];
const modeCounts=(v:unknown,d:Record<P56Mode,number>):Record<P56Mode,number>=>{const out:Record<P56Mode,number>={...d};if(!v||typeof v!=='object')return out;const r=v as Record<string,unknown>;for(const m of P56_MODES)if(m in r)out[m]=cnt(r[m],d[m]);return out;};
const sanitizePlan=(v:unknown):P56Plan|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;return {mode:P56_MODES.includes(r.mode as P56Mode)?r.mode as P56Mode:'observe',priority01:clamp(finN(r.priority01,0)),confidence01:clamp(finN(r.confidence01,0)),reasons:strArr(r.reasons,8),nextEvidence:strArr(r.nextEvidence,8)};};
const sanitizeHistory=(v:unknown):P56State['history'][number]|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;return {tick:cnt(r.tick,0),at:Math.max(0,finN(r.at,0)),mode:P56_MODES.includes(r.mode as P56Mode)?r.mode as P56Mode:'observe',priority01:clamp(finN(r.priority01,0)),confidence01:clamp(finN(r.confidence01,0)),realityGap01:clamp(finN(r.realityGap01,0))};};

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
  restore(raw?:Partial<P56State>|null){const d=defaultP56();const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let history:P56State['history']=[];try{const h=read('history');if(Array.isArray(h))history=h.map(sanitizeHistory).filter((x):x is P56State['history'][number]=>x!==null).slice(-96);}catch{history=[];}let lastPlan:P56Plan|null=null;try{lastPlan=sanitizePlan(read('lastPlan'));}catch{lastPlan=null;}this.state={version:1,cycles:cnt(read('cycles'),d.cycles),assessments:cnt(read('assessments'),d.assessments),planned:cnt(read('planned'),d.planned),protectedCycles:cnt(read('protectedCycles'),d.protectedCycles),meanIntegrated01:clamp(finN(read('meanIntegrated01'),d.meanIntegrated01)),meanRealityGap01:clamp(finN(read('meanRealityGap01'),d.meanRealityGap01)),meanStability01:clamp(finN(read('meanStability01'),d.meanStability01)),modeCounts:modeCounts(read('modeCounts'),d.modeCounts),lastPlan,lastAt:Math.max(0,finN(read('lastAt'),d.lastAt)),history};}
  snapshot(){return structuredClone(this.state);}
  persistenceSnapshot(){
    return {...this.state,modeCounts:{...this.state.modeCounts},history:this.state.history.slice(-48).map(row=>({...row}))};
  }
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
