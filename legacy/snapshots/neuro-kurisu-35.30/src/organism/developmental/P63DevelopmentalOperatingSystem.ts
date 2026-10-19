/**
 * P63 — Developmental Operating System.
 *
 * One control plane for P53–P60. The older phases remain intact as specialists;
 * P63 decides whether the organism should protect, consolidate, experiment,
 * explore, reflect or simply live the current moment. Promotion remains
 * reversible and identity-gated.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type P63Mode='protect'|'consolidate'|'observe'|'experiment'|'explore'|'reflect'|'rest';
export interface P63Input {tick:number;at:number;p56:{mode:string;priority01:number;confidence01:number;realityGap01:number};p58:{mode:string;stability01:number;integrated01:number;realityGap01:number};p59:{mode:string;priority01:number;retentionBias01:number};p60:'allow'|'caution'|'veto';predictionError01:number;uncertainty01:number;novelty01:number;identity01:number;bodyEnergy01:number;thermal01:number;memoryPressure01:number;realityGap01:number;}
export interface P63Plan {mode:P63Mode;priority01:number;confidence01:number;developmentBudget01:number;actionBias:Record<string,number>;reasons:string[];evidenceRequired:string[];}
export interface P63State {version:2;cycles:number;modeCounts:Record<P63Mode,number>;promotionsBlocked:number;forcedDiversions:number;modeStreak:number;lastMode:P63Mode|null;meanDevelopmentBudget01:number;meanConfidence01:number;lastPlan:P63Plan|null;history:P63Plan[];}
export const defaultP63=():P63State=>({version:2,cycles:0,modeCounts:{protect:0,consolidate:0,observe:0,experiment:0,explore:0,reflect:0,rest:0},promotionsBlocked:0,forcedDiversions:0,modeStreak:0,lastMode:null,meanDevelopmentBudget01:.25,meanConfidence01:.5,lastPlan:null,history:[]});
export class P63DevelopmentalOperatingSystem{
 private state=defaultP63();
 restore(raw?:Partial<P63State>|null){const d=defaultP63(),r=raw??{};this.state={...d,...r,version:2,modeCounts:{...d.modeCounts,...(r.modeCounts??{})},lastMode:(r.lastMode??null) as P63Mode|null,modeStreak:Number(r.modeStreak??0),forcedDiversions:Number(r.forcedDiversions??0),history:Array.isArray(r.history)?r.history.slice(-96):[]};}
 snapshot(){return structuredClone(this.state);}
 plan(input:P63Input):P63Plan{
   const pe=clamp(input.predictionError01),u=clamp(input.uncertainty01),n=clamp(input.novelty01),id=clamp(input.identity01),e=clamp(input.bodyEnergy01),th=clamp(input.thermal01),mp=clamp(input.memoryPressure01),rg=clamp(input.realityGap01),p56=clamp(input.p56.priority01),p58=clamp(input.p58.integrated01),p59=clamp(input.p59.priority01),retain=clamp(input.p59.retentionBias01);
   const pressure:Record<P63Mode,number>={
     protect:(1-id)*.48+rg*.24+(input.p60==='veto'?.32:input.p60==='caution'?.12:0)+th*.06,
     consolidate:p59*.36+mp*.28+Math.max(0,.72-n)*.12+(1-p58)*.12+pe*.12,
     observe:(1-Math.max(pe,u,rg))*.46+p58*.24+id*.2,
     experiment:pe*.22+u*.22+p56*.16+n*.12+input.p56.confidence01*.1+rg*.08+(1-id)*.1,
     explore:n*.36+u*.2+p56*.12+(1-rg)*.1+e*.08+(input.p60==='allow'?.08:.02),
     reflect:rg*.16+pe*.16+u*.16+(1-p58)*.16+id*.12+p56*.1+mp*.08+retain*.06,
     rest:(1-e)*.44+th*.26+(1-p58)*.16+mp*.08+(1-id)*.06,
   };
   const entries=Object.entries(pressure).sort((a,b)=>b[1]-a[1]); const rawMode=entries[0][0] as P63Mode; const streak=this.state.lastMode===rawMode?this.state.modeStreak:0; let mode=rawMode; if(streak>=8){ const penalized=entries.map(([k,v])=>[k,k===rawMode?v*(streak>=16?.52:.76):v] as [string,number]).sort((a,b)=>b[1]-a[1]); mode=penalized[0][0] as P63Mode; if(mode===rawMode && penalized[1]) mode=penalized[1][0] as P63Mode; if(mode!==rawMode)this.state.forcedDiversions++; } const chosen=pressure[mode]; const priority=clamp(chosen); const second=Object.entries(pressure).filter(([k])=>k!==mode).sort((a,b)=>b[1]-a[1])[0]; const margin=priority-(second?.[1]??0);let budget=clamp(.12+priority*.55+n*.08-u*.04-(input.p60==='veto'?.18:input.p60==='caution'?.07:0));
   if(mode==='protect')budget=clamp(budget*.45);if(mode==='rest')budget=clamp(budget*.65);
   const confidence=clamp(.35+margin*.75+(1-rg)*.12+input.p56.confidence01*.12);
   const actionBias:Record<string,number>={respond:0,explore:0,verify:0,rest:0,reflect:0,wait:0,defer:0};
   if(mode==='protect'){actionBias.explore=-.14;actionBias.reflect=.05;actionBias.wait=.05;actionBias.rest=.06;}
   if(mode==='consolidate'){actionBias.reflect=.1;actionBias.verify=.04;actionBias.explore=-.03;}
   if(mode==='experiment'){actionBias.verify=.1;actionBias.reflect=.07;}
   if(mode==='explore'){actionBias.explore=.1;actionBias.verify=.03;}
   if(mode==='reflect'){actionBias.reflect=.12;actionBias.verify=.04;}
   if(mode==='rest'){actionBias.rest=.16;actionBias.explore=-.08;}
   if(input.p60==='veto')actionBias.explore-=.08;
   const reasons:string[]=[];if(rg>.35)reasons.push('reality-gap');if(pe>.45)reasons.push('prediction-error');if(u>.58)reasons.push('uncertainty');if(mp>.65)reasons.push('memory-pressure');if(n>.6)reasons.push('novelty');if(input.p60!=='allow')reasons.push('identity-governance');if(!reasons.length)reasons.push('stable-development');
   const evidenceRequired=mode==='protect'?['identity-continuity','external-outcome']:mode==='experiment'?['controlled-comparison','holdout-outcome']:mode==='consolidate'?['retrieval-consistency','post-consolidation-stability']:mode==='explore'?['cross-context-transfer']:mode==='reflect'?['self-report-vs-outcome']:['independent-outcome'];
   const plan:P63Plan={mode,priority01:priority,confidence01:confidence,developmentBudget01:budget,actionBias,reasons,evidenceRequired};
   this.state.cycles++; if(this.state.lastMode===mode)this.state.modeStreak+=1; else {this.state.lastMode=mode;this.state.modeStreak=1;} this.state.modeCounts[mode]++;if(input.p60==='veto')this.state.promotionsBlocked++;this.state.meanDevelopmentBudget01=clamp(this.state.meanDevelopmentBudget01*.95+budget*.05);this.state.meanConfidence01=clamp(this.state.meanConfidence01*.95+confidence*.05);this.state.lastPlan=plan;this.state.history=[plan,...this.state.history].slice(0,96);return structuredClone(plan);
 }
 summary(){return {cycles:this.state.cycles,modeCounts:this.state.modeCounts,promotionsBlocked:this.state.promotionsBlocked,forcedDiversions:this.state.forcedDiversions,modeStreak:this.state.modeStreak,lastMode:this.state.lastMode,meanDevelopmentBudget01:this.state.meanDevelopmentBudget01,meanConfidence01:this.state.meanConfidence01,lastPlan:this.state.lastPlan};}
}
