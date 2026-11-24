import type { ActionKind, OrganismNeeds } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const D=12;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const sq=(x:number)=>x*x;
const hash=(x:number)=>{x|=0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.04)=>((hash(seed)/0xffffffff)*2-1)*scale;
const TARGETS=[.68,.32,.74,.72,.62,.30,.28,1,.45,.42,.30,.58];

export interface B2509EmbodiedState{
  version:1; enabled:boolean; tick:number; cycles:number; learningUpdates:number;
  predictionError01:number; homeostaticError01:number; sensorReliability01:number;
  causalEffect01:number; proactiveRegulation01:number; energyEfficiency01:number;
  actionUtility:number[]; actionBias:number[]; actionUncertainty:number[];
  lastBody:number[]; lastPredictedBody:number[]; lastAction:ActionKind|null;
  weights:number[][]; actionBiasWeights:number[]; lesionFraction01:number;
  verifiedSamples:number;
}

export interface B2509Input{
  tick:number; baseUtilities:Record<ActionKind,number>; needs:OrganismNeeds;
  embodiment?:{bodyEnergy01:number;cognitiveCapacity01:number;thermalStrain01:number;sensoryFreshness01:number;awake:boolean;battery01:number;cpuLoad01:number;ramPressure01:number};
  sensorFreshness01:number; visionSignal01?:number; audioSignal01?:number; uncertainty01:number;
  predictionError01:number; goalPressure01:number; b2504Prediction?:Record<ActionKind,number>; computeBudget01?:number;
}

export interface B2509Output{
  actionBias:Record<ActionKind,number>; predictedUtility:Record<ActionKind,number>; uncertainty:Record<ActionKind,number>;
  predictedBody:number[]; homeostaticRelief:Record<ActionKind,number>; sensorReliability01:number; selectedAction:ActionKind;
  proactiveRegulation01:number; bottleneckConfidence01:number;
}

export const defaultB2509State=():B2509EmbodiedState=>({
  version:1,enabled:true,tick:0,cycles:0,learningUpdates:0,predictionError01:.48,homeostaticError01:.42,sensorReliability01:.62,
  causalEffect01:0,proactiveRegulation01:0,energyEfficiency01:.5,actionUtility:ACTIONS.map(()=>.5),actionBias:ACTIONS.map(()=>0),
  actionUncertainty:ACTIONS.map(()=>.6),lastBody:TARGETS.slice(),lastPredictedBody:TARGETS.slice(),lastAction:null,
  weights:ACTIONS.map((_,a)=>Array.from({length:D},(_,k)=>rand(250900+a*100+k,.035))),actionBiasWeights:ACTIONS.map((_,a)=>rand(250950+a,.015)),lesionFraction01:0,verifiedSamples:0,
});

export class B2509EmbodiedHomeostaticActionField{
  readonly systemName='cognition:b2509-embodied-homeostatic-action-field' as const;
  private state=defaultB2509State();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B2509EmbodiedState>|null){
    const d=defaultB2509State(),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.from({length:n},(_,i)=>Number.isFinite(Number(v?.[i]))?Number(v[i]):fill);
    const rows=Array.isArray(r.weights)?r.weights:[];
    this.state={...d,...structuredClone(r),version:1,
      weights:ACTIONS.map((_,a)=>arr(rows[a],D).map((x,k)=>clamp(x,-.8,.8)===0 && !Number.isFinite(Number(rows[a]?.[k]))?d.weights[a]![k]!:clamp(x,-.8,.8))),
      actionBiasWeights:arr(r.actionBiasWeights,ACTIONS.length).map((x,a)=>Number.isFinite(Number(r.actionBiasWeights?.[a]))?clamp(x,-.5,.5):d.actionBiasWeights[a]!),
      actionUtility:arr(r.actionUtility,ACTIONS.length,.5).map(x=>clamp(x)),actionBias:arr(r.actionBias,ACTIONS.length).map(x=>clamp(x,-.18,.18)),actionUncertainty:arr(r.actionUncertainty,ACTIONS.length,.6).map(x=>clamp(x)),
      lastBody:arr(r.lastBody,D,.5).map(x=>clamp(x)),lastPredictedBody:arr(r.lastPredictedBody,D,.5).map(x=>clamp(x)),
      lesionFraction01:clamp(r.lesionFraction01??0),predictionError01:clamp(r.predictionError01??.48),homeostaticError01:clamp(r.homeostaticError01??.42),sensorReliability01:clamp(r.sensorReliability01??.62),
      causalEffect01:clamp(r.causalEffect01??0),proactiveRegulation01:clamp(r.proactiveRegulation01??0),energyEfficiency01:clamp(r.energyEfficiency01??.5),verifiedSamples:Math.max(0,Math.floor(Number(r.verifiedSamples??0))),
    };
  }
  setEnabled(x:boolean){this.state.enabled=!!x;}
  private body(i:B2509Input){
    const e=i.embodiment;
    const v=[e?.bodyEnergy01??i.needs.energy,e?.thermalStrain01??.2,e?.cognitiveCapacity01??(1-i.needs.cognitiveLoad),e?.sensoryFreshness01??i.sensorFreshness01,e?.battery01??i.needs.energy,e?.cpuLoad01??i.needs.cognitiveLoad,e?.ramPressure01??i.needs.cognitiveLoad,e?.awake===false?0:1,i.needs.uncertainty,i.needs.novelty,i.goalPressure01,i.predictionError01];
    return v.map(x=>clamp(x));
  }
  private error(body:number[]){return mean(body.map((x,k)=>sq(x-(TARGETS[k]??.5))));}
  private project(body:number[],a:number){
    const row=this.state.weights[a]!,factor=1-this.state.lesionFraction01;
    const next=body.map((x,k)=>clamp(x*(0.78+0.08*factor)+row[k]!*(0.34*factor)+this.state.actionBiasWeights[a]!*(k%3===0?0.4:0.15)));
    const before=this.error(body),after=this.error(next),relief=clamp((before-after)*2.4+.5);
    const uncertainty=clamp(.16+this.state.predictionError01*.34+(1-this.state.sensorReliability01)*.28+Math.abs(after-before)*.70);
    return {next,relief,uncertainty,errorBefore:before,errorAfter:after};
  }
  beforeDecision(i:B2509Input):B2509Output{
    const base=ACTIONS.map(a=>clamp(i.baseUtilities[a]??.5));
    if(!this.state.enabled){const idx=base.indexOf(Math.max(...base));return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as any,predictedUtility:Object.fromEntries(ACTIONS.map((a,k)=>[a,base[k]!])) as any,uncertainty:Object.fromEntries(ACTIONS.map(a=>[a,.75])) as any,predictedBody:this.state.lastPredictedBody.slice(),homeostaticRelief:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as any,sensorReliability01:this.state.sensorReliability01,selectedAction:ACTIONS[idx]??'wait',proactiveRegulation01:this.state.proactiveRegulation01,bottleneckConfidence01:.2};}
    const body=this.body(i),reliability=clamp(.25+.55*i.sensorFreshness01+.20*(evidenceSensor(i)));
    this.state.sensorReliability01=clamp(this.state.sensorReliability01*.95+reliability*.05);
    const projected=ACTIONS.map((_,a)=>this.project(body,a));
    const precision=clamp(.25+.30*reliability+.20*(1-i.uncertainty01)+.15*(1-i.predictionError01)+.10*(i.computeBudget01??.7));
    const utility=projected.map((p,k)=>clamp(.58*base[k]!+.24*p.relief+.10*(i.b2504Prediction?.[ACTIONS[k]!]??.5)+.08*precision));
    const bias=utility.map((u,k)=>clamp((u-base[k]!)*(.15+.34*precision),-.16,.16));
    const unc=projected.map(p=>p.uncertainty);
    const scores=utility.map((u,k)=>u+bias[k]!);
    const selected=ACTIONS[scores.indexOf(Math.max(...scores))]??'wait';
    const selectedP=projected[Math.max(0,ACTIONS.indexOf(selected))]!;
    this.state.tick=i.tick;this.state.cycles++;this.state.lastBody=body;this.state.lastPredictedBody=selectedP.next.slice();this.state.lastAction=selected;this.state.actionUtility=utility;this.state.actionBias=bias;this.state.actionUncertainty=unc;
    this.state.homeostaticError01=clamp(this.state.homeostaticError01*.96+mean(projected.map(p=>p.errorAfter))*.04);
    this.state.proactiveRegulation01=clamp(this.state.proactiveRegulation01*.94+selectedP.relief*.06);
    this.state.energyEfficiency01=clamp(this.state.energyEfficiency01*.97+(selectedP.relief/(.05+mean(body)))*.03);
    this.state.lastPredictedBody=selectedP.next.slice();
    return {actionBias:Object.fromEntries(ACTIONS.map((a,k)=>[a,bias[k]!])) as any,predictedUtility:Object.fromEntries(ACTIONS.map((a,k)=>[a,utility[k]!])) as any,uncertainty:Object.fromEntries(ACTIONS.map((a,k)=>[a,unc[k]!])) as any,predictedBody:selectedP.next.slice(),homeostaticRelief:Object.fromEntries(ACTIONS.map((a,k)=>[a,projected[k]!.relief])) as any,sensorReliability01:this.state.sensorReliability01,selectedAction:selected,proactiveRegulation01:this.state.proactiveRegulation01,bottleneckConfidence01:clamp(.22+.50*precision+.28*this.state.sensorReliability01)};
  }
  afterOutcome(i:{tick:number;action:ActionKind;nextBody:number[];reward01:number;verified01:number;predictionError01:number}){
    if(!this.state.enabled)return this.diagnostics();
    const body=Array.from({length:D},(_,k)=>clamp(i.nextBody[k]??this.state.lastPredictedBody[k]??.5));
    const targetError=this.error(body),predError=mean(body.map((x,k)=>Math.abs(x-(this.state.lastPredictedBody[k]??x))));
    const ai=Math.max(0,ACTIONS.indexOf(i.action));
    const err=body.map((x,k)=>x-(this.state.lastPredictedBody[k]??x));
    const lr=.018/Math.sqrt(1+this.state.learningUpdates/2500);
    if(i.verified01>0){for(let k=0;k<D;k++){this.state.weights[ai]![k]=clamp(this.state.weights[ai]![k]!+lr*err[k]!*(1-.42*Math.abs(err[k]!)),-.8,.8);}this.state.actionBiasWeights[ai]=clamp(this.state.actionBiasWeights[ai]!+lr*mean(err)*(.7+.3*i.reward01),-.5,.5);this.state.learningUpdates++;this.state.verifiedSamples++;}
    const causal=clamp(Math.abs(mean(err))+.35*Math.abs(i.reward01-.5));
    this.state.causalEffect01=clamp(this.state.causalEffect01*.92+causal*.08);
    this.state.predictionError01=clamp(this.state.predictionError01*.94+predError*.06);
    this.state.homeostaticError01=clamp(this.state.homeostaticError01*.92+targetError*.08);
    this.state.lastBody=body;
    return this.diagnostics();
  }
  lesionFraction(fraction01=.5){this.state.lesionFraction01=clamp(fraction01);const before=this.state.actionUtility.slice();const scaled=before.map((v,k)=>clamp(.5+(v-.5)*(1-this.state.lesionFraction01)));const effect=mean(before.map((v,k)=>Math.abs(v-scaled[k]!)));this.state.causalEffect01=clamp(this.state.causalEffect01*.85+effect*.15);return {lesionFraction01:this.state.lesionFraction01,utilityEffect01:effect,causalEffect01:this.state.causalEffect01};}
  clearLesion(){this.state.lesionFraction01=0;}
  diagnostics(){return {cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,verifiedSamples:this.state.verifiedSamples,predictionError01:this.state.predictionError01,homeostaticError01:this.state.homeostaticError01,sensorReliability01:this.state.sensorReliability01,causalEffect01:this.state.causalEffect01,proactiveRegulation01:this.state.proactiveRegulation01,energyEfficiency01:this.state.energyEfficiency01,lastAction:this.state.lastAction,lesionFraction01:this.state.lesionFraction01};}
}
function evidenceSensor(i:B2509Input){return clamp(.5+.25*(i.embodiment?.sensoryFreshness01??i.sensorFreshness01)-.12*(i.embodiment?.ramPressure01??0)-.10*(i.embodiment?.cpuLoad01??0));}
