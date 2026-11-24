import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const TRAITS=['curiosity','truth','reflection','care','preservation','persistence','caution','autonomy','epistemic','social','initiative','restraint'] as const;
type Trait=typeof TRAITS[number];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const clamp11=(x:number)=>clamp(x,-1,1);
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const affinity:Record<ActionKind,Partial<Record<Trait,number>>>={
  respond:{care:.85,social:.72,restraint:.18},explore:{curiosity:.82,initiative:.66,autonomy:.40,epistemic:.30},verify:{truth:.86,epistemic:.72,caution:.36,reflection:.18},
  rest:{preservation:.82,restraint:.48,caution:.20},reflect:{reflection:.86,epistemic:.42,autonomy:.40},wait:{persistence:.72,caution:.48,restraint:.24},defer:{caution:.84,restraint:.42,epistemic:.22},
};

export interface B2510State{
  version:1; enabled:boolean; tick:number; samples:number; verifiedSamples:number; autonomousSamples:number; consolidationSteps:number;
  fast:Record<Trait,number>; slow:Record<Trait,number>; anchor:Record<Trait,number>; evidence:Record<Trait,number>;
  actionBias:number[]; lastBias:number[]; plasticity01:number; stability01:number; selfAuthoredDevelopment01:number; maturity01:number;
  developmentalStage:'nascent'|'plastic'|'calibrating'|'consolidating'|'generalizing'; lesionFraction01:number;
}
export interface B2510Input{
  tick:number; baseUtilities:Record<ActionKind,number>; b299TraitSignals?:Record<string,number>; b299Stability01?:number; agency01:number; authorship01:number;
  selfContinuity01:number; autonomy01:number; uncertainty01:number; novelty01:number; goalPressure01:number; predictionError01:number; socialNeed01:number; verifiedHistory01:number;
}
export interface B2510Output{
  actionBias:Record<ActionKind,number>; traitVector:Record<Trait,number>; developmentalConfidence01:number; maturity01:number; plasticity01:number; identityStability01:number; selectedAction:ActionKind;
}

export const defaultB2510State=():B2510State=>{const z=Object.fromEntries(TRAITS.map(t=>[t,0])) as Record<Trait,number>;return {version:1,enabled:true,tick:0,samples:0,verifiedSamples:0,autonomousSamples:0,consolidationSteps:0,fast:{...z},slow:{...z},anchor:{...z},evidence:{...z},actionBias:ACTIONS.map(()=>0),lastBias:ACTIONS.map(()=>0),plasticity01:.42,stability01:.55,selfAuthoredDevelopment01:0,maturity01:0,developmentalStage:'nascent',lesionFraction01:0};};

export class B2510DevelopmentalPersonalityCoupling{
  readonly systemName='cognition:b2510-developmental-personality-coupling' as const;
  private state=defaultB2510State();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B2510State>|null){const d=defaultB2510State(),r:any=raw??{};const norm=(v:any,fb:number)=>Object.fromEntries(TRAITS.map(t=>[t,clamp11(Number(v?.[t]??fb))])) as Record<Trait,number>;this.state={...d,...structuredClone(r),version:1,fast:norm(r.fast,0),slow:norm(r.slow,0),anchor:norm(r.anchor,0),evidence:Object.fromEntries(TRAITS.map(t=>[t,clamp(r.evidence?.[t]??0)])) as Record<Trait,number>,actionBias:ACTIONS.map((_,i)=>clamp(Number(r.actionBias?.[i]??0),-.14,.14)),lastBias:ACTIONS.map((_,i)=>clamp(Number(r.lastBias?.[i]??0),-.14,.14)),plasticity01:clamp(r.plasticity01??.42),stability01:clamp(r.stability01??.55),selfAuthoredDevelopment01:clamp(r.selfAuthoredDevelopment01??0),maturity01:clamp(r.maturity01??0),lesionFraction01:clamp(r.lesionFraction01??0)};}
  setEnabled(x:boolean){this.state.enabled=!!x;}
  private traitVector(){const out={} as Record<Trait,number>;for(const t of TRAITS)out[t]=clamp11(this.state.fast[t]!*0.34+this.state.slow[t]!*0.66);return out;}
  private actionSignal(action:ActionKind,b299?:Record<string,number>){const tr=this.traitVector(),aff=affinity[action]??{};let m=0,s=0;for(const t of TRAITS){const w=Number(aff[t]??0);if(w<=0)continue;m+=w;s+=w*tr[t]!;}const trait=s/Math.max(.001,m);let external=0,externalMass=0;for(const t of TRAITS){const w=Number(aff[t]??0);if(w<=0)continue;external+=w*Number(b299?.[t]??0);externalMass+=w;}const b=external/Math.max(.001,externalMass);return clamp11((trait*.70+b*.30)*(1-this.state.lesionFraction01));}
  beforeDecision(i:B2510Input):B2510Output{
    const base=ACTIONS.map(a=>clamp(i.baseUtilities[a]??.5));
    if(!this.state.enabled){const idx=base.indexOf(Math.max(...base));return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as any,traitVector:this.traitVector(),developmentalConfidence01:0.2,maturity01:this.state.maturity01,plasticity01:this.state.plasticity01,identityStability01:this.state.stability01,selectedAction:ACTIONS[idx]??'wait'};}
    const evidenceGate=clamp(.24+.30*i.selfContinuity01+.20*i.autonomy01+.16*i.verifiedHistory01+.10*(i.b299Stability01??.5));
    const volatility=clamp(i.uncertainty01*.38+i.predictionError01*.24+i.novelty01*.14+(1-i.selfContinuity01)*.24);
    this.state.plasticity01=clamp(.10+volatility*.52+(1-evidenceGate)*.16);
    const biases=ACTIONS.map(a=>clamp(this.actionSignal(a,i.b299TraitSignals)*(.34+.36*evidenceGate)*(1-.35*this.state.stability01),-.14,.14));
    const scores=base.map((u,k)=>u+biases[k]!);
    const selected=ACTIONS[scores.indexOf(Math.max(...scores))]??'wait';
    this.state.tick=i.tick;this.state.samples++;this.state.lastBias=biases;this.state.actionBias=biases;
    const confidence=clamp(.20+.30*evidenceGate+.25*this.state.stability01+.25*Math.min(1,this.state.samples/128));
    return {actionBias:Object.fromEntries(ACTIONS.map((a,k)=>[a,biases[k]!])) as any,traitVector:this.traitVector(),developmentalConfidence01:confidence,maturity01:this.state.maturity01,plasticity01:this.state.plasticity01,identityStability01:this.state.stability01,selectedAction:selected};
  }
  afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;autonomous01:number;causalMatch01:number;selfContinuity01:number;goalPressure01:number;novelty01:number;socialNeed01:number;b299TraitSignals?:Record<string,number>} ){
    if(!this.state.enabled)return this.diagnostics();
    const ai=Math.max(0,ACTIONS.indexOf(i.action)),aff=affinity[i.action]??{};const surprise=clamp(i.predictionError01);const signal=clamp11((i.reward01-.5)*.9+(i.causalMatch01-.5)*.45+(i.autonomous01-.5)*.24+(i.selfContinuity01-.5)*.18);
    const lr=.022*Math.max(.08,this.state.plasticity01)/Math.sqrt(1+this.state.samples/600);
    for(const t of TRAITS){const w=Number(aff[t]??0);const external=clamp11(Number(i.b299TraitSignals?.[t]??0));const target=clamp11(signal*w*.58+external*.22+(i.goalPressure01-.5)*.18);this.state.fast[t]=clamp11(this.state.fast[t]!+lr*target*(1-this.state.evidence[t]!*.72));this.state.evidence[t]=clamp(this.state.evidence[t]!*0.995+(Math.abs(target)*.35+i.verified01*.30+i.autonomous01*.15+i.causalMatch01*.20)*.005);}
    if(i.verified01>0)this.state.verifiedSamples++;if(i.autonomous01>.5)this.state.autonomousSamples++;
    if(this.state.samples%16===0){const protectedRate=.10+.32*this.state.stability01;for(const t of TRAITS){const e=this.state.evidence[t]!;const pull=(this.state.fast[t]!-this.state.anchor[t]!)*(1-protectedRate);this.state.slow[t]=clamp11(this.state.slow[t]!+Math.max(.004,e*.018)*pull);this.state.anchor[t]=clamp11(this.state.anchor[t]!*.995+this.state.slow[t]!*0.005*(1-e));}this.state.consolidationSteps++;}
    const drift=mean(TRAITS.map(t=>Math.abs(this.state.slow[t]!-this.state.anchor[t]!)));this.state.stability01=clamp(.98*this.state.stability01+.02*(1-drift));this.state.selfAuthoredDevelopment01=clamp(.985*this.state.selfAuthoredDevelopment01+.015*clamp(i.autonomous01*.36+i.causalMatch01*.34+i.verified01*.18+i.selfContinuity01*.12));const evidence=mean(TRAITS.map(t=>this.state.evidence[t]!));this.state.maturity01=clamp(.99*this.state.maturity01+.01*(evidence*.48+this.state.stability01*.24+Math.min(1,this.state.verifiedSamples/96)*.16+Math.min(1,this.state.samples/192)*.12));this.state.developmentalStage=this.state.maturity01<.18?'nascent':this.state.maturity01<.38?'plastic':this.state.maturity01<.62?'calibrating':this.state.maturity01<.80?'consolidating':'generalizing';
    return this.diagnostics();
  }
  lesionFraction(f=.5){this.state.lesionFraction01=clamp(f);return {lesionFraction01:this.state.lesionFraction01,actionBiasEffect01:mean(this.state.lastBias.map(x=>Math.abs(x)*(1-this.state.lesionFraction01)))};}
  clearLesion(){this.state.lesionFraction01=0;}
  diagnostics(){return {samples:this.state.samples,verifiedSamples:this.state.verifiedSamples,autonomousSamples:this.state.autonomousSamples,consolidationSteps:this.state.consolidationSteps,plasticity01:this.state.plasticity01,stability01:this.state.stability01,selfAuthoredDevelopment01:this.state.selfAuthoredDevelopment01,maturity01:this.state.maturity01,developmentalStage:this.state.developmentalStage,traitVector:this.traitVector(),lesionFraction01:this.state.lesionFraction01};}
}
