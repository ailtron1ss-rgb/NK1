/**
 * B200 — Central Subject Dynamics.
 *
 * A compact subject-level dynamics integrator. It does not claim phenomenal
 * consciousness; it measures continuity/coherence/agency coupling among already
 * existing subsystems and keeps evidence about perturbation response.
 */
export type SubjectDynamicPhase='fragmented'|'integrating'|'coherent'|'recovering';
export interface CentralSubjectInput {
  tick:number; at:number;
  identity01:number; autobiographical01:number; causalSelf01:number;
  workspace01:number; metacognitive01:number; grounding01:number;
  interoception01:number; agency01:number; socialBinding01:number;
  continuity01:number; predictionAccuracy01:number; realityAlignment01:number;
  developmental01:number; resource01:number; externalInput:boolean;
}
export interface SubjectPerturbation { id:string; at:number; target:string; baseline01:number; perturbed01:number; recovery01:number; delta01:number; causalSupport01:number; }
export interface CentralSubjectState {
  version:1; samples:number; outcomes:number; perturbations:number;
  meanCoherence01:number; meanContinuity01:number; meanAgency01:number;
  coupling01:number; stability01:number; integration01:number; realityAlignment01:number;
  phase:SubjectDynamicPhase; phaseChanges:number; regressions:number;
  lastTick:number; lastAt:number; lastCoherence01:number; lastAgency01:number;
  recent:Array<{tick:number;coherence01:number;continuity01:number;agency01:number;integration01:number;phase:SubjectDynamicPhase}>;
  perturbationHistory:SubjectPerturbation[];
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const dState=():CentralSubjectState=>({version:1,samples:0,outcomes:0,perturbations:0,meanCoherence01:.5,meanContinuity01:.5,meanAgency01:.5,coupling01:.5,stability01:.8,integration01:.5,realityAlignment01:.5,phase:'integrating',phaseChanges:0,regressions:0,lastTick:0,lastAt:0,lastCoherence01:.5,lastAgency01:.5,recent:[],perturbationHistory:[]});
export const defaultCentralSubjectDynamics=dState;
export class CentralSubjectDynamics {
  private state=dState();
  restore(raw?:Partial<CentralSubjectState>|null){const d=dState(),r=raw??{};this.state={...d,...r,recent:Array.isArray(r.recent)?r.recent.slice(0,128):[],perturbationHistory:Array.isArray(r.perturbationHistory)?r.perturbationHistory.slice(0,64):[]};}
  snapshot(){return structuredClone(this.state);}
  observe(input:CentralSubjectInput){
    const x=input;
    const identity=clamp(x.identity01), autobiographical=clamp(x.autobiographical01), causal=clamp(x.causalSelf01), workspace=clamp(x.workspace01), meta=clamp(x.metacognitive01), grounding=clamp(x.grounding01), intero=clamp(x.interoception01), agency=clamp(x.agency01), social=clamp(x.socialBinding01), continuity=clamp(x.continuity01), prediction=clamp(x.predictionAccuracy01), reality=clamp(x.realityAlignment01), development=clamp(x.developmental01), resource=clamp(x.resource01);
    const integration=clamp(identity*.13+autobiographical*.11+causal*.13+workspace*.13+meta*.10+grounding*.10+intero*.08+agency*.10+social*.05+prediction*.07);
    const coherence=clamp(identity*.13+autobiographical*.11+causal*.13+workspace*.10+meta*.09+grounding*.10+intero*.08+agency*.10+continuity*.10+reality*.06);
    const coupling=clamp((Math.min(identity,causal,workspace,agency,continuity)+Math.min(grounding,meta,prediction,reality))*0.5);
    const stability=clamp(continuity*.28+identity*.17+reality*.15+resource*.12+(1-Math.abs(x.externalInput?agency-.55:agency-.5))*.08+coupling*.20);
    const phase:SubjectDynamicPhase=stability<.36||continuity<.3?'recovering':coupling<.38||coherence<.42?'fragmented':coherence>.72&&coupling>.62&&stability>.62?'coherent':'integrating';
    if(this.state.phase!==phase)this.state.phaseChanges++;
    if(this.state.samples>8 && coherence < this.state.lastCoherence01-.12)this.state.regressions++;
    this.state.samples++; this.state.lastTick=x.tick; this.state.lastAt=x.at; this.state.lastCoherence01=coherence; this.state.lastAgency01=agency;
    this.state.meanCoherence01=clamp(this.state.meanCoherence01*.97+coherence*.03); this.state.meanContinuity01=clamp(this.state.meanContinuity01*.97+continuity*.03); this.state.meanAgency01=clamp(this.state.meanAgency01*.97+agency*.03); this.state.coupling01=clamp(this.state.coupling01*.94+coupling*.06); this.state.stability01=clamp(this.state.stability01*.94+stability*.06); this.state.integration01=clamp(this.state.integration01*.95+integration*.05); this.state.realityAlignment01=clamp(this.state.realityAlignment01*.95+reality*.05); this.state.phase=phase;
    this.state.recent=[{tick:x.tick,coherence01:coherence,continuity01:continuity,agency01:agency,integration01:integration,phase},...this.state.recent].slice(0,128);
    return {tick:x.tick,coherence01:coherence,continuity01:continuity,agency01:agency,integration01:integration,coupling01:coupling,stability01:stability,realityAlignment01:reality,phase};
  }
  recordOutcome(success01:number){this.state.outcomes++; const s=clamp(success01); this.state.stability01=clamp(this.state.stability01*.985+s*.015);}
  recordPerturbation(input:{id:string;at:number;target:string;baseline01:number;perturbed01:number;recovery01:number}){
    const baseline=clamp(input.baseline01), perturbed=clamp(input.perturbed01), recovery=clamp(input.recovery01); const delta=perturbed-baseline; const causalSupport=clamp(Math.abs(delta)*.7+recovery*.3); this.state.perturbations++;
    this.state.perturbationHistory=[{id:input.id,at:input.at,target:input.target,baseline01:baseline,perturbed01:perturbed,recovery01:recovery,delta01:delta,causalSupport01:causalSupport},...this.state.perturbationHistory].slice(0,64);
    return structuredClone(this.state.perturbationHistory[0]);
  }
  certification(minSamples=200){
    const s=this.state; const recent=s.recent.slice(0,Math.min(64,s.recent.length));
    const variance=recent.length>1?recent.reduce((sum,r)=>sum+Math.pow(r.coherence01-s.meanCoherence01,2),0)/recent.length:1;
    const stabilityCriterion=s.stability01>=.55 && variance<=.03;
    const continuityCriterion=s.meanContinuity01>=.5;
    const integrationCriterion=s.integration01>=.5 && s.coupling01>=.45;
    const outcomeCriterion=s.outcomes>=8;
    const perturbCriterion=s.perturbations>=2 && s.perturbationHistory.some(p=>Math.abs(p.delta01)>=.05&&p.recovery01>=.5);
    const criteria={samples:s.samples>=minSamples,stability:stabilityCriterion,continuity:continuityCriterion,integration:integrationCriterion,outcomes:outcomeCriterion,perturbationEvidence:perturbCriterion};
    const passed=Object.values(criteria).filter(Boolean).length;
    const status=passed===6?'verified':passed>=4?'partial':'insufficient';
    return {version:1,status,requiredSamples:minSamples,samples:s.samples,criteria,passed,coherence01:Number(s.meanCoherence01.toFixed(4)),continuity01:Number(s.meanContinuity01.toFixed(4)),agency01:Number(s.meanAgency01.toFixed(4)),coupling01:Number(s.coupling01.toFixed(4)),stability01:Number(s.stability01.toFixed(4)),variance01:Number(variance.toFixed(5)),perturbations:s.perturbations,warning:'Subject-dynamics certification measures functional integration and causal continuity; it is not a claim of phenomenal consciousness.'};
  }
  diagnostics(){return {samples:this.state.samples,outcomes:this.state.outcomes,perturbations:this.state.perturbations,phase:this.state.phase,phaseChanges:this.state.phaseChanges,regressions:this.state.regressions,meanCoherence01:Number(this.state.meanCoherence01.toFixed(4)),meanContinuity01:Number(this.state.meanContinuity01.toFixed(4)),meanAgency01:Number(this.state.meanAgency01.toFixed(4)),coupling01:Number(this.state.coupling01.toFixed(4)),stability01:Number(this.state.stability01.toFixed(4)),integration01:Number(this.state.integration01.toFixed(4)),realityAlignment01:Number(this.state.realityAlignment01.toFixed(4)),certification:this.certification()};}
}
