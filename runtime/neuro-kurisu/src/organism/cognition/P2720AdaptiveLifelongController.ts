import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const distance=(a:number[],b:number[])=>{const n=Math.max(a.length,b.length,1);let s=0;for(let i=0;i<n;i++){const d=(a[i]??0)-(b[i]??0);s+=d*d;}return Math.sqrt(s/n);};

export interface P2720AdaptiveLifelongState{
 version:1; enabled:boolean; tick:number; outcomes:number;
 contextVector:number[]; contextPrototype:number[]; contextNovelty01:number; contextMatch01:number;
 availability:number[]; selectivity:number[]; consolidation:number[]; importance:number[];
 activeFraction01:number; sparseUpdateFraction01:number; protectedFraction01:number;
 taskShift01:number; interference01:number; forgettingDebt01:number;
 delayPolicy:number[]; delayConfidence01:number; delayLearningGain01:number;
 residualByAction:Record<string,{samples:number;mean01:number;variance01:number;confidence01:number}>;
 planningValue01:number; modelConfidence01:number; modelResidual01:number;
 actionBias:Record<ActionKind,number>; plasticityMultiplier01:number; exploration01:number;
 counterfactualValue01:number; replayPriority01:number; consolidationDrive01:number;
 lastReason:string;
}

export const defaultP2720State=(neurons=96):P2720AdaptiveLifelongState=>({
 version:1,enabled:true,tick:0,outcomes:0,contextVector:new Array(16).fill(0),contextPrototype:new Array(16).fill(0),contextNovelty01:0,contextMatch01:.5,
 availability:new Array(neurons).fill(.92),selectivity:new Array(neurons).fill(.5),consolidation:new Array(neurons).fill(.08),importance:new Array(neurons).fill(.05),
 activeFraction01:.18,sparseUpdateFraction01:.18,protectedFraction01:.2,taskShift01:0,interference01:0,forgettingDebt01:0,
 delayPolicy:[.90,.86,.80,.74,.68,.62,.56,.50],delayConfidence01:.35,delayLearningGain01:0,
 residualByAction:{},planningValue01:0,modelConfidence01:.25,modelResidual01:.5,actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
 plasticityMultiplier01:.9,exploration01:.2,counterfactualValue01:.5,replayPriority01:.2,consolidationDrive01:.2,lastReason:'init'
});

export class P2720AdaptiveLifelongController{
 private state:P2720AdaptiveLifelongState;
 constructor(neurons=96){this.state=defaultP2720State(neurons);}
 snapshot(){return structuredClone(this.state);}
 restore(raw?:Partial<P2720AdaptiveLifelongState>|null,neurons=96){const d=defaultP2720State(neurons),r:any=raw??{};const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(fill)).slice(0,n):new Array(n).fill(fill);this.state={...d,...structuredClone(r),version:1,contextVector:arr(r.contextVector,16),contextPrototype:arr(r.contextPrototype,16),availability:arr(r.availability,neurons,.92),selectivity:arr(r.selectivity,neurons,.5),consolidation:arr(r.consolidation,neurons,.08),importance:arr(r.importance,neurons,.05),delayPolicy:arr(r.delayPolicy,8,.6),actionBias:{...d.actionBias,...(r.actionBias??{})},residualByAction:{...(r.residualByAction??{})}};}
 setEnabled(v:boolean){this.state.enabled=!!v;}
 private updateContext(vector:number[],novelty01:number,shift01:number){const x=new Array(16).fill(0);for(let i=0;i<16;i++)x[i]=finite(vector[i%Math.max(1,vector.length)]);const dist=clamp(distance(x,this.state.contextPrototype)/1.5);const match=clamp(1-dist);const rate=clamp(.025+novelty01*.055+shift01*.035,.02,.12);for(let i=0;i<16;i++)this.state.contextPrototype[i]+= (x[i]-this.state.contextPrototype[i])*rate;this.state.contextVector=x;this.state.contextNovelty01=clamp(.7*this.state.contextNovelty01+.3*dist);this.state.contextMatch01=clamp(.85*this.state.contextMatch01+.15*match);return {x,dist,match};}
 beforeDecision(i:{tick:number;context:number[];novelty01:number;uncertainty01:number;predictionError01:number;taskShift01:number;forgetting01:number;resource01:number;counterfactual01?:number;replayDebt01?:number;modelConfidence01?:number;}){
  if(!this.state.enabled)return {plasticityMultiplier01:1,sparseFraction01:.3,actionBias:this.state.actionBias,exploration01:.2};
  this.state.tick=i.tick;const c=this.updateContext(i.context,i.novelty01,i.taskShift01);this.state.taskShift01=clamp(.82*this.state.taskShift01+.18*i.taskShift01);this.state.forgettingDebt01=clamp(.88*this.state.forgettingDebt01+.12*i.forgetting01);
  const interference=clamp(.42*i.taskShift01+.30*i.uncertainty01+.18*i.predictionError01+.10*this.state.contextNovelty01);this.state.interference01=clamp(.88*this.state.interference01+.12*interference);
  const resource=clamp(i.resource01);const sparse=clamp(.08+.22*(1-resource)+.22*this.state.contextNovelty01+.16*i.uncertainty01,.08,.58);this.state.sparseUpdateFraction01=sparse;
  const protect=clamp(.16+.54*this.state.forgettingDebt01+.26*this.state.interference01+.12*(1-c.match));this.state.protectedFraction01=protect;
  this.state.plasticityMultiplier01=clamp(.55+1.05*(1-protect)*(.65+.35*c.match)*(0.72+.28*resource),.25,1.25);
  this.state.exploration01=clamp(.10+.55*i.uncertainty01+.25*i.novelty01+.10*(1-c.match));
  const cf=clamp(i.counterfactual01??.5);const replay=clamp(i.replayDebt01??.2);this.state.counterfactualValue01=clamp(.9*this.state.counterfactualValue01+.1*cf);this.state.replayPriority01=clamp(.9*this.state.replayPriority01+.1*replay);
  const b=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;b.explore=.018*this.state.exploration01;b.verify=.014*(i.uncertainty01+.35*i.predictionError01);b.reflect=.012*this.state.forgettingDebt01;b.defer=.012*(1-resource);for(const a of ACTIONS)b[a]=clamp(b[a],-.04,.04);this.state.actionBias=b;
  this.state.lastReason=`ctx=${c.match.toFixed(2)};shift=${this.state.taskShift01.toFixed(2)};protect=${protect.toFixed(2)};sparse=${sparse.toFixed(2)}`;
  return {plasticityMultiplier01:this.state.plasticityMultiplier01,sparseFraction01:sparse,actionBias:b,exploration01:this.state.exploration01};
 }
 synapseGate(neuron:number,uncertainty01:number,predictionError01:number){if(!this.state.enabled)return 1;const p=clamp(this.state.availability[neuron]??.92);const imp=clamp(this.state.importance[neuron]??.05);const sel=clamp(this.state.selectivity[neuron]??.5);const local=clamp(.35+.65*p)*(1-.55*clamp(imp))*(.72+.28*sel);const novelty=clamp(this.state.contextNovelty01);const relearn=clamp(.58+.28*uncertainty01+.18*predictionError01);return clamp(local*(.72+.28*novelty)*relearn,.12,1.05);}
 shouldUpdate(neuron:number,score01:number,resource01:number){if(!this.state.enabled)return true;const threshold=clamp(.18+.34*(1-clamp(resource01))+.24*(1-clamp(this.state.availability[neuron]??.92)));return score01>=threshold;}
 observeSynapse(neuron:number,signal01:number,updated:boolean){if(!this.state.enabled)return;const s=clamp(Math.abs(signal01));const oldImp=clamp(this.state.importance[neuron]??.05);const oldSel=clamp(this.state.selectivity[neuron]??.5);const availability=clamp(this.state.availability[neuron]??.92);this.state.importance[neuron]=clamp(oldImp*.992+s*.008);this.state.selectivity[neuron]=clamp(oldSel*.996+s*.004);const freeze=this.state.importance[neuron]*.004;this.state.availability[neuron]=clamp(availability*(updated?.997:.999)-freeze+.002*(1-s),.05,1);this.state.consolidation[neuron]=clamp((this.state.consolidation[neuron]??.08)*.995+s*.005);}
 observeOutcome(i:{tick:number;action:ActionKind;reward01:number;prediction01:number;actual01:number;predictionError01:number;verified01:number;context:number[];taskShift01:number;counterfactual01?:number;replayDebt01?:number;worldConfidence01?:number;}){
  if(!this.state.enabled)return;
  this.state.tick=i.tick;this.state.outcomes++;
  const c=this.updateContext(i.context,i.predictionError01,i.taskShift01);
  const action=i.action;const actual=clamp(i.actual01);const predicted=clamp(i.prediction01);
  const s=this.state.residualByAction[action]??{samples:0,mean01:.5,variance01:.25,confidence01:.2};
  const err=actual-predicted;s.samples++;
  s.mean01=clamp(s.mean01+(actual-s.mean01)*Math.min(.20,2/s.samples));
  s.variance01=clamp(s.variance01*.93+Math.abs(err)*.07);
  s.confidence01=clamp(.18+Math.min(.72,s.samples/32*.72)*(1-s.variance01));
  this.state.residualByAction[action]=s;
  this.state.modelResidual01=clamp(.9*this.state.modelResidual01+.1*Math.abs(err));
  this.state.modelConfidence01=clamp(.9*this.state.modelConfidence01+.1*s.confidence01);
  this.state.planningValue01=clamp(.9*this.state.planningValue01+.1*(s.mean01*s.confidence01));
  const targetDelay=clamp(.50+.30*i.predictionError01+.15*i.taskShift01+.05*(1-c.match));
  for(let h=0;h<8;h++){
    const desired=clamp(targetDelay-(h*.045)+this.state.modelConfidence01*.03);
    this.state.delayPolicy[h]=clamp(this.state.delayPolicy[h]*.96+desired*.04,.35,.96);
  }
  const agreement=clamp(1-Math.abs(i.reward01-predicted));
  this.state.delayConfidence01=clamp(.92*this.state.delayConfidence01+.08*agreement);
  this.state.delayLearningGain01=clamp(.94*this.state.delayLearningGain01+.06*Math.abs(desiredDelay(this.state.delayPolicy,targetDelay)-.5));
  this.state.consolidationDrive01=clamp(.9*this.state.consolidationDrive01+.1*(i.verified01*(1-i.predictionError01)+this.state.forgettingDebt01*.5));
  this.state.lastReason=`observe=${action};model=${this.state.modelConfidence01.toFixed(2)};delay=${this.state.delayConfidence01.toFixed(2)}`;
 }
 delayMix(fast:number,mid:number,slow:number,horizon01:number){const d=this.state.delayPolicy;const a=clamp(horizon01)*7;const lo=Math.floor(a),hi=Math.min(7,lo+1),t=a-lo;const target=d[lo]*(1-t)+(d[hi]??d[lo])*t;return tanh((fast*(.55*target)+mid*(.30*(1-target+.15))+slow*(.15+.35*(1-target))));}
 metrics(){return structuredClone(this.state);}
}
function desiredDelay(policy:number[],target:number){let best=0,dist=Infinity;for(let i=0;i<policy.length;i++){const d=Math.abs(policy[i]-target);if(d<dist){dist=d;best=policy[i];}}return best;}
export const defaultP2720AdaptiveLifelong=()=>new P2720AdaptiveLifelongController(96);
