import type { ActionKind } from '../core/types.ts';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const SOURCES=['persistent','counterfactual','sensorimotor','generative'] as const;
type Source=typeof SOURCES[number];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const softmax=(xs:number[])=>{const m=Math.max(...xs),es=xs.map(x=>Math.exp(Math.max(-20,Math.min(20,x-m))));const s=es.reduce((a,b)=>a+b,0)||1;return es.map(x=>x/s)};
export interface B2522State{version:1;enabled:boolean;tick:number;cycles:number;learningUpdates:number;sourceWeights:Record<Source,number>;sourceReliability:Record<Source,number>;actionBias:Record<ActionKind,number>;disagreement01:number;routingEntropy01:number;coverage01:number;selectedSource:Source|null;mixtureConfidence01:number;noveltyPressure01:number;lastCanonicalAnchor01:number;updatesBySource:Record<Source,number>;lesionFraction01:number;}
export const defaultB2522State=():B2522State=>({version:1,enabled:true,tick:0,cycles:0,learningUpdates:0,sourceWeights:{persistent:.25,counterfactual:.25,sensorimotor:.25,generative:.25},sourceReliability:{persistent:.45,counterfactual:.45,sensorimotor:.45,generative:.45},actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,disagreement01:.25,routingEntropy01:1,coverage01:0,selectedSource:null,mixtureConfidence01:.4,noveltyPressure01:0,lastCanonicalAnchor01:0,updatesBySource:{persistent:0,counterfactual:0,sensorimotor:0,generative:0},lesionFraction01:0});
export interface B2522BeforeInput{tick:number;baseUtilities:Record<ActionKind,number>;canonicalLatent?:number[];canonicalUncertainty01?:number;canonicalCoherence01?:number;persistentBias:Record<ActionKind,number>;counterfactualBias:Record<ActionKind,number>;sensorimotorBias:Record<ActionKind,number>;generativeBias:Record<ActionKind,number>;persistentConfidence01:number;counterfactualConfidence01:number;sensorimotorConfidence01:number;generativeConfidence01:number;uncertainty01:number;novelty01:number;predictionError01:number;computeBudget01:number;}
export class B2522AdaptiveWorldModelMixtureRouter{
 private state=defaultB2522State(); readonly systemName='cognition:b2522-adaptive-world-model-mixture-router' as const;
 snapshot(){return structuredClone(this.state)} restore(raw?:Partial<B2522State>|null){const d=defaultB2522State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,sourceWeights:{...d.sourceWeights,...(r.sourceWeights??{})},sourceReliability:{...d.sourceReliability,...(r.sourceReliability??{})},actionBias:{...d.actionBias,...(r.actionBias??{})},updatesBySource:{...d.updatesBySource,...(r.updatesBySource??{})}};}
 setEnabled(v:boolean){this.state.enabled=!!v} setLesion(v:number){this.state.lesionFraction01=clamp(v)}
 beforeDecision(i:B2522BeforeInput){this.state.tick=i.tick;const zero=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;if(!this.state.enabled)return {actionBias:zero,sourceWeights:{...this.state.sourceWeights},disagreement01:this.state.disagreement01,mixtureConfidence01:this.state.mixtureConfidence01,routingEntropy01:this.state.routingEntropy01,selectedSource:null};
  const vectors:Record<Source,Record<ActionKind,number>>={persistent:i.persistentBias,counterfactual:i.counterfactualBias,sensorimotor:i.sensorimotorBias,generative:i.generativeBias};
  const conf:Record<Source,number>={persistent:clamp(i.persistentConfidence01),counterfactual:clamp(i.counterfactualConfidence01),sensorimotor:clamp(i.sensorimotorConfidence01),generative:clamp(i.generativeConfidence01)};
  const sourceScores=SOURCES.map(s=>Math.max(.001,this.state.sourceReliability[s])*(.35+.65*conf[s])*(.65+.35*i.computeBudget01)*(1+.55*i.novelty01*(s==='generative'?1:.55)));
  const target=softmax(sourceScores.map(x=>Math.log(x)));
  for(let k=0;k<SOURCES.length;k++){const s=SOURCES[k]!;this.state.sourceWeights[s]=clamp(this.state.sourceWeights[s]*.82+target[k]! * .18,.02,.85);}
  const norm=SOURCES.reduce((z,s)=>z+this.state.sourceWeights[s],0)||1;for(const s of SOURCES)this.state.sourceWeights[s]/=norm;
  const disagreement=SOURCES.reduce((sum,s)=>sum+this.state.sourceWeights[s]*ACTIONS.reduce((z,a)=>z+Math.abs((vectors[s][a]??0)),0)/ACTIONS.length,0);
  const pair=SOURCES.reduce((sum,s,idx)=>sum+SOURCES.slice(idx+1).reduce((z,t)=>z+ACTIONS.reduce((q,a)=>q+Math.abs((vectors[s][a]??0)-(vectors[t][a]??0)),0)/ACTIONS.length,0),0)/6;
  this.state.disagreement01=clamp(this.state.disagreement01*.9+clamp(pair*5)*.1);
  const bias=zero;for(const a of ACTIONS){let b=0;for(const s of SOURCES)b+=this.state.sourceWeights[s]*(vectors[s][a]??0);const epistemic=(i.uncertainty01*.028+i.novelty01*.018)*((a==='explore'||a==='verify')?1:-.22);bias[a]=clamp((b+epistemic)*(1-.45*this.state.disagreement01)*(1-this.state.lesionFraction01),-.11,.11);}
  const ws=SOURCES.map(s=>this.state.sourceWeights[s]);const entropy=-ws.reduce((z,w)=>z+w*Math.log(Math.max(1e-9,w)),0)/Math.log(SOURCES.length);const selected=SOURCES.slice().sort((a,b)=>this.state.sourceWeights[b]-this.state.sourceWeights[a])[0]??null;
  // Canonical latent world state is the shared anchor; this router may shape it, but never owns a second world-state representation.
  if(i.canonicalLatent?.length){const latent=i.canonicalLatent;const latentMean=latent.reduce((z,x)=>z+x,0)/latent.length;this.state.lastCanonicalAnchor01=clamp(Math.abs(latentMean-.5)*2);const canonicalStrength=clamp((i.canonicalCoherence01??.5)*.06+(1-(i.canonicalUncertainty01??.5))*.04,0,.10);for(const [idx,a] of ACTIONS.entries()){const start=(idx*4)%latent.length;const chunk=latent.slice(start,start+4);const mean=chunk.length?chunk.reduce((x,y)=>x+y,0)/chunk.length:.5;bias[a]+=clamp((mean-.5)*canonicalStrength,-.018,.018);}}
  this.state.actionBias=bias;
  this.state.routingEntropy01=clamp(entropy);
  const coverageSignal=Math.max(...Object.values(conf))*.5+Math.min(1,i.computeBudget01)*.25+(1-i.predictionError01)*.25;
  this.state.coverage01=clamp(this.state.coverage01*.98+coverageSignal*.02);
  this.state.mixtureConfidence01=clamp(this.state.mixtureConfidence01*.94+(1-i.predictionError01)*.06);
  this.state.selectedSource=selected;
  this.state.noveltyPressure01=clamp(this.state.noveltyPressure01*.92+i.novelty01*.08);
  this.state.cycles++;
  return {actionBias:{...bias},sourceWeights:{...this.state.sourceWeights},disagreement01:this.state.disagreement01,mixtureConfidence01:this.state.mixtureConfidence01,routingEntropy01:this.state.routingEntropy01,selectedSource:selected,coverage01:this.state.coverage01};
 }
 afterOutcome(i:{tick:number;reward01:number;predictionError01:number;verified01:number;selectedAction:ActionKind}){
  if(!this.state.enabled)return;
  const advantage=clamp((i.reward01-.5)*.7+(1-i.predictionError01)*.25+i.verified01*.15,-1,1);
  for(const s of SOURCES){
    // Source-specific credit assignment: do not reward every model equally merely
    // because the final action happened to work. Agreement with the selected action,
    // signed contribution, and source weight determine the update. This prevents a
    // weak source from riding on the success of a stronger model.
    const signed=(this.state.actionBias[i.selectedAction]??0);
    const exposure=clamp(this.state.sourceWeights[s]*2.5);
    const contribution=exposure*signed;
    const alignment=contribution>=0 ? 1 : -1;
    const lr=.018+.055*exposure+.025*Math.abs(contribution);
    const evidence=advantage*alignment*(.35+.65*exposure);
    this.state.sourceReliability[s]=clamp(this.state.sourceReliability[s]+lr*(evidence-.012));
    this.state.updatesBySource[s]++;
  }
  this.state.learningUpdates++;this.state.tick=i.tick;
 }
 diagnostics(){return structuredClone(this.state)}
 lesion(f=.5){
  const base={tick:this.state.tick+1,baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>,
    persistentBias:this.state.actionBias,counterfactualBias:this.state.actionBias,sensorimotorBias:this.state.actionBias,generativeBias:this.state.actionBias,
    persistentConfidence01:.8,counterfactualConfidence01:.8,sensorimotorConfidence01:.8,generativeConfidence01:.8,
    uncertainty01:.7,novelty01:.6,predictionError01:.2,computeBudget01:.9};
  this.setLesion(0);const on=this.beforeDecision(base).actionBias;
  this.setLesion(f);const off=this.beforeDecision({...base,tick:base.tick+1}).actionBias;
  this.setLesion(0);
  const effect=ACTIONS.reduce((s,a)=>s+Math.abs(on[a]-off[a]),0);
  return {causalDrop01:clamp(effect*3),before01:this.state.mixtureConfidence01,after01:clamp(this.state.mixtureConfidence01-effect)};
 }
}
