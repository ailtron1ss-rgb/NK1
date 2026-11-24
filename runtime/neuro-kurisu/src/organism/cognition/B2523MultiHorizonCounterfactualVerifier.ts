import type { ActionKind } from '../core/types.ts';
const A:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
export interface B2523State{version:1;enabled:boolean;tick:number;cycles:number;rollouts:number;learningUpdates:number;selectedHorizon:number;verificationConfidence01:number;counterfactualAgreement01:number;actionBias:Record<ActionKind,number>;horizonValues:Record<ActionKind,number[]>;lastAction:ActionKind|null;lastValue01:number;lastCanonicalAnchor01:number;lesionFraction01:number;}
export const defaultB2523State=():B2523State=>({version:1,enabled:true,tick:0,cycles:0,rollouts:0,learningUpdates:0,selectedHorizon:3,verificationConfidence01:.35,counterfactualAgreement01:.35,actionBias:Object.fromEntries(A.map(a=>[a,0])) as Record<ActionKind,number>,horizonValues:Object.fromEntries(A.map(a=>[a,[.5,.5,.5,.5,.5,.5,.5,.5]])) as Record<ActionKind,number[]>,lastAction:null,lastValue01:.5,lastCanonicalAnchor01:0,lesionFraction01:0});
export class B2523MultiHorizonCounterfactualVerifier{
 private state=defaultB2523State();readonly systemName='cognition:b2523-multi-horizon-counterfactual-verifier' as const;
 snapshot(){return structuredClone(this.state)} restore(raw?:Partial<B2523State>|null){const d=defaultB2523State(),r:any=raw??{};this.state={...d,...structuredClone(r),actionBias:{...d.actionBias,...(r.actionBias??{})},horizonValues:{...d.horizonValues,...(r.horizonValues??{})},version:1};}
 setEnabled(v:boolean){this.state.enabled=!!v} setLesion(v:number){this.state.lesionFraction01=clamp(v)}
 beforeDecision(i:{tick:number;baseUtilities:Record<ActionKind,number>;uncertainty01:number;predictionError01:number;goalPressure01:number;modelConfidence01:number;routerDisagreement01:number;computeBudget01:number;canonicalLatent?:number[];canonicalUncertainty01?:number;canonicalCoherence01?:number}){this.state.tick=i.tick;const zero=Object.fromEntries(A.map(a=>[a,0])) as Record<ActionKind,number>;if(!this.state.enabled)return {actionBias:zero,selectedHorizon:this.state.selectedHorizon,verificationConfidence01:this.state.verificationConfidence01,counterfactualAgreement01:this.state.counterfactualAgreement01,rollouts:0};
  const budget=clamp(i.computeBudget01),maxH=Math.max(2,Math.min(8,Math.round(2+6*budget*(1-.45*i.uncertainty01))));const h=Math.max(2,Math.min(maxH,Math.round(2+(1-i.predictionError01)*2+i.modelConfidence01*2+i.routerDisagreement01*2)));this.state.selectedHorizon=h;
  const bias=zero;
  if(i.canonicalLatent?.length){const latentMean=i.canonicalLatent.reduce((z,
    x)=>z+x,
    0)/i.canonicalLatent.length;this.state.lastCanonicalAnchor01=clamp(Math.abs(latentMean-.5)*2);}const canonicalUncertainty=i.canonicalUncertainty01??i.uncertainty01;
  const canonicalCoherence=i.canonicalCoherence01??.5;
  let totalAgree=0,total=0;
  for(const a of A){let v=clamp(i.baseUtilities[a]??.5),
    prev=v,
    arr:number[]=[];for(let d=0;d<h;d++){const decay=Math.pow(.88,
    d);const epistemic=(a==='explore'||a==='verify')?i.uncertainty01*.035:0;const goal=(i.goalPressure01-.5)*.025;const disagreement=i.routerDisagreement01*.018;v=clamp(v*.72+(v+epistemic+goal+disagreement*(a==='verify'?1:.25))*.28*decay);arr.push(v);totalAgree+=1-Math.abs(v-prev);total++;prev=v;}this.state.horizonValues[a]=[...arr,
    ...new Array(8-arr.length).fill(arr.at(-1)??.5)];const tail=arr.length?arr.reduce((s,
    x,
    k)=>s+x*(.5+.5*(k+1)/arr.length),
    0)/arr.reduce((s,
    _,
    k)=>s+(.5+.5*(k+1)/arr.length),
    0):v;bias[a]=clamp((tail-(i.baseUtilities[a]??.5))*.38*(1-this.state.lesionFraction01),
    -.12,
    .12);if(i.canonicalLatent?.length){const start=(A.indexOf(a)*4)%i.canonicalLatent.length;const chunk=i.canonicalLatent.slice(start,
    start+4);const latentMean=chunk.length?chunk.reduce((s,
    x)=>s+x,
    0)/chunk.length:.5;bias[a]+=clamp((latentMean-.5)*.025*(.5+canonicalCoherence*.5)*(1-canonicalUncertainty),
    -.012,
    .012);}}
  this.state.counterfactualAgreement01=clamp(this.state.counterfactualAgreement01*.92+(totalAgree/Math.max(1,total))*.08);this.state.verificationConfidence01=clamp(this.state.verificationConfidence01*.93+((1-i.predictionError01)*.40+i.modelConfidence01*.32+(1-i.routerDisagreement01)*.18+(1-canonicalUncertainty)*.10)*.07);this.state.actionBias=bias;this.state.cycles++;this.state.rollouts+=A.length*h;const best=A.slice().sort((x,y)=>(bias[y]??0)-(bias[x]??0))[0]??'wait';this.state.lastAction=best;this.state.lastValue01=clamp((i.baseUtilities[best]??.5)+(bias[best]??0));return {actionBias:{...bias},selectedHorizon:h,verificationConfidence01:this.state.verificationConfidence01,counterfactualAgreement01:this.state.counterfactualAgreement01,rollouts:A.length*h};}
 afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number}){if(!this.state.enabled)return;const predicted=this.state.lastValue01;const error=Math.abs(i.reward01-predicted);this.state.verificationConfidence01=clamp(this.state.verificationConfidence01*.95+((1-error)*.6+i.verified01*.4)*.05);this.state.learningUpdates++;this.state.tick=i.tick;}
 diagnostics(){return structuredClone(this.state)}
 lesion(f=.5){const args={tick:this.state.tick+1,baseUtilities:Object.fromEntries(A.map(a=>[a,.5])) as Record<ActionKind,number>,uncertainty01:.7,predictionError01:.2,goalPressure01:.8,modelConfidence01:.8,routerDisagreement01:.35,computeBudget01:.9};this.setLesion(0);const on=this.beforeDecision(args).actionBias;this.setLesion(f);const off=this.beforeDecision({...args,tick:args.tick+1}).actionBias;this.setLesion(0);const effect=A.reduce((s,a)=>s+Math.abs(on[a]-off[a]),0);return {causalDrop01:clamp(effect*3),before01:this.state.verificationConfidence01,after01:clamp(this.state.verificationConfidence01-effect)};}
}
