import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const mean=(v:number[])=>v.length?v.reduce((s,x)=>s+finite(x),0)/v.length:0;
const zeros=(n:number)=>new Array(n).fill(0);

export interface P2805State{
  version:1;
  enabled:boolean;
  tick:number;
  outcomes:number;
  learningEvents:number;
  neurons:number;
  stability01:number;
  plasticity01:number;
  dormant01:number;
  resetPressure01:number;
  conflict01:number;
  teacherAgreement01:number;
  weightDrift01:number;
  referenceSeeded:boolean;
  consolidatedWeights:number;
  selectiveResets:number;
  skippedResets:number;
  sparseUpdates:number;
  protectedUpdates:number;
  replayProtectedEvents:number;
  contextUtility01:number[];
  neuronImportance01:number[];
  neuronAvailability01:number[];
  neuronPlasticity01:number[];
  neuronActivity01:number[];
  slowActionReadout:number[][];
  slowEdgeWeights:number[][];
}

export interface P2805DecisionInput{
  tick:number;
  contextId:number;
  novelty01:number;
  uncertainty01:number;
  predictionError01:number;
  forgetting01:number;
  replayPressure01:number;
  resource01:number;
  contextMatch01:number;
}

export interface P2805DecisionOutput{
  plasticityScale01:number;
  stabilityScale01:number;
  dormantBudget:number;
  resetThreshold01:number;
  teacherBlend01:number;
  actionBias:Record<ActionKind,number>;
}

const defaultState=(neurons=96):P2805State=>({
  version:1,enabled:true,tick:0,outcomes:0,learningEvents:0,neurons,
  stability01:.56,plasticity01:.64,dormant01:.18,resetPressure01:.08,conflict01:.12,teacherAgreement01:.78,weightDrift01:0,referenceSeeded:false,
  consolidatedWeights:0,selectiveResets:0,skippedResets:0,sparseUpdates:0,protectedUpdates:0,replayProtectedEvents:0,
  contextUtility01:new Array(8).fill(.5),neuronImportance01:new Array(neurons).fill(.14),neuronAvailability01:new Array(neurons).fill(.72),
  neuronPlasticity01:new Array(neurons).fill(.64),neuronActivity01:new Array(neurons).fill(.10),
  slowActionReadout:Array.from({length:ACTIONS.length},()=>zeros(neurons)),slowEdgeWeights:Array.from({length:neurons},()=>new Array(12).fill(0))
});

export class P2805StabilityPlasticityArbiter{
  private state:P2805State=defaultState();
  constructor(neurons=96){this.state=defaultState(neurons);}
  snapshot(){return structuredClone(this.state);}
  metrics(){return structuredClone(this.state);}
  setEnabled(v:boolean){this.state.enabled=!!v;}
  restore(raw?:Partial<P2805State>|null,neurons=this.state.neurons){
    const d=defaultState(neurons),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const matrix=(v:any,rows:number,cols:number,fill=0)=>Array.from({length:rows},(_,i)=>arr(v?.[i],cols,fill));
    this.state={...d,...structuredClone(r),version:1,neurons,
      contextUtility01:arr(r.contextUtility01,8,.5),neuronImportance01:arr(r.neuronImportance01,neurons,.14),neuronAvailability01:arr(r.neuronAvailability01,neurons,.72),
      neuronPlasticity01:arr(r.neuronPlasticity01,neurons,.64),neuronActivity01:arr(r.neuronActivity01,neurons,.10),
      slowActionReadout:matrix(r.slowActionReadout,ACTIONS.length,neurons),slowEdgeWeights:matrix(r.slowEdgeWeights,neurons,12)};
  }
  bootstrapFromCurrent(actionReadout:number[][],edgeWeights:number[][]){
    if(!this.state.enabled||this.state.referenceSeeded)return;
    for(let a=0;a<Math.min(ACTIONS.length,actionReadout.length);a++)for(let n=0;n<this.state.neurons;n++)this.state.slowActionReadout[a]![n]=finite(actionReadout[a]?.[n]);
    for(let n=0;n<this.state.neurons;n++)for(let q=0;q<12;q++)this.state.slowEdgeWeights[n]![q]=finite(edgeWeights[n]?.[q]);
    this.state.referenceSeeded=true;
    this.state.teacherAgreement01=1;
  }
  resetEdgeWeight(neuron:number,edge:number,current:number):number{
    const n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron))),q=Math.max(0,Math.min(11,Math.floor(edge)));
    const slow=this.state.slowEdgeWeights[n]?.[q]??0;
    this.state.selectiveResets++;
    return clamp(slow*.78+finite(current)*.22,-.35,.35);
  }
  resetActionWeight(actionIndex:number,neuron:number,current:number):number{
    const a=Math.max(0,Math.min(ACTIONS.length-1,Math.floor(actionIndex))),n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));
    const slow=this.state.slowActionReadout[a]?.[n]??0;
    return clamp(slow*.82+finite(current)*.18,-.25,.25);
  }
  beforeDecision(i:P2805DecisionInput):P2805DecisionOutput{
    if(!this.state.enabled)return {plasticityScale01:1,stabilityScale01:1,dormantBudget:0,resetThreshold01:1,teacherBlend01:0,actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>};
    this.state.tick=i.tick;
    const ctx=Math.max(0,Math.min(7,Math.floor(i.contextId)));
    const novelty=clamp(i.novelty01),uncertainty=clamp(i.uncertainty01),error=clamp(i.predictionError01),forgetting=clamp(i.forgetting01),replay=clamp(i.replayPressure01),resource=clamp(i.resource01),match=clamp(i.contextMatch01);
    const conflict=clamp(.30*error+.23*uncertainty+.17*forgetting+.15*(1-match)+.15*replay);
    this.state.conflict01=clamp(this.state.conflict01*.90+conflict*.10);
    this.state.plasticity01=clamp(this.state.plasticity01*.94+(novelty*.32+uncertainty*.26+forgetting*.24+(1-match)*.18)*.06,.18,.92);
    this.state.stability01=clamp(this.state.stability01*.94+((1-error)*.42+match*.34+(1-novelty)*.24)*.06,.20,.96);
    this.state.resetPressure01=clamp(.46*this.state.conflict01+.24*(1-this.state.plasticity01)+.18*novelty+.12*forgetting);
    const available=this.state.neuronAvailability01;
    this.state.dormant01=clamp(mean(available.map((a,idx)=>a>.79&&(this.state.neuronActivity01[idx]??.1)<.08?1:0)));
    const dormantBudget=Math.max(0,Math.min(Math.ceil(this.state.neurons*.12),Math.floor(this.state.neurons*(.04+.16*(1-resource)+.12*this.state.resetPressure01))));
    const resetThreshold01=clamp(.19+.34*this.state.resetPressure01+.12*forgetting-.10*match,.12,.62);
    const teacherBlend=clamp(.018+.064*this.state.stability01+.052*(1-this.state.plasticity01)-.030*novelty,.01,.12);
    this.state.contextUtility01[ctx]=clamp((this.state.contextUtility01[ctx]??.5)*.93+(.35*match+.30*(1-error)+.20*(1-uncertainty)+.15*resource)*.07);
    const actionBias:Record<ActionKind,number>=Object.fromEntries(ACTIONS.map((a,ai)=>{
      const utility=this.state.contextUtility01[ctx]??.5;
      const sign=ai===1?1:ai===2?-1:ai===4?.5:0;
      return [a,clamp(sign*(novelty*.012+uncertainty*.008+(1-utility)*.006),-.024,.024)];
    })) as Record<ActionKind,number>;
    return {plasticityScale01:clamp(.84+.34*this.state.plasticity01+.10*novelty-.12*this.state.stability01,.68,1.18),stabilityScale01:clamp(.82+.26*this.state.stability01+.10*match,.78,1.16),dormantBudget,resetThreshold01,teacherBlend01:teacherBlend,actionBias};
  }
  gateNeuron(neuron:number,signal01:number,contextMatch01:number,importance01?:number):number{
    if(!this.state.enabled)return 1;
    const n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));const imp=clamp(importance01??this.state.neuronImportance01[n]??.14);const match=clamp(contextMatch01);const avail=clamp(this.state.neuronAvailability01[n]??.72);const sig=clamp(signal01);
    const gate=clamp(.68+.16*sig+.10*(1-match)-.46*imp*avail+.12*(1-avail),.24,1.14);
    if(gate<.74)this.state.protectedUpdates++;else this.state.sparseUpdates++;
    return gate;
  }
  replayCompatibility(contextMatch01:number,worldConfidence01:number,predictionError01:number,resource01:number):number{
    if(!this.state.enabled)return 1;
    const match=clamp(contextMatch01),world=clamp(worldConfidence01),error=clamp(predictionError01),resource=clamp(resource01);
    const risk=clamp(.34*(1-match)+.28*error+.22*(1-world)+.16*(1-resource)+.08*this.state.conflict01);
    const gate=clamp(1-.78*risk,.12,1);
    if(gate<.58)this.state.replayProtectedEvents++;
    return gate;
  }
  actionGate(action:ActionKind,signal01:number):number{
    const a=Math.max(0,ACTIONS.indexOf(action));const dormant=mean(this.state.neuronAvailability01.map((x,i)=>x>.82&&(this.state.neuronActivity01[i]??.1)<.08?1:0));
    return clamp(1+.06*signal01-.08*this.state.stability01+((a===1||a===2)?.03*dormant:0),.84,1.08);
  }
  observeNeuron(neuron:number,delta01:number,activity01:number,importanceSignal01:number,contextMatch01:number){
    if(!this.state.enabled)return;
    const n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));const d=clamp(Math.abs(delta01));const act=clamp(activity01);const imp=clamp(importanceSignal01);const match=clamp(contextMatch01);
    this.state.learningEvents++;
    this.state.neuronActivity01[n]=clamp((this.state.neuronActivity01[n]??.1)*.92+act*.08);
    this.state.neuronImportance01[n]=clamp((this.state.neuronImportance01[n]??.14)*.95+(imp*.70+d*.30)*.05);
    this.state.neuronAvailability01[n]=clamp((this.state.neuronAvailability01[n]??.72)*.965+(1-match)*.02-d*.006);
    this.state.neuronPlasticity01[n]=clamp((this.state.neuronPlasticity01[n]??.64)*.96+(1-this.state.neuronImportance01[n]!)*.025+d*.015,.08,1);
  }
  shouldResetNeuron(neuron:number,threshold01:number):boolean{
    if(!this.state.enabled)return false;
    const n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));const imp=this.state.neuronImportance01[n]??.14;const act=this.state.neuronActivity01[n]??.1;const avail=this.state.neuronAvailability01[n]??.72;
    const score=clamp((1-imp)*.48+(1-avail)*.24+(1-clamp(act/.18))*.18+this.state.resetPressure01*.10);
    if(score>=threshold01){this.state.selectiveResets++;return true;}this.state.skippedResets++;return false;
  }
  teacherPull(current:number,slow:number,blend01:number,importance01:number):number{
    if(!this.state.enabled)return current;
    const protectedWeight=clamp(importance01)*clamp(this.state.stability01);
    const b=clamp(blend01)*(1-.55*protectedWeight);
    return current+(finite(slow)-finite(current))*b;
  }
  importanceAt(neuron:number){const n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));return this.state.neuronImportance01[n]??.14;}
  slowActionAt(actionIndex:number,neuron:number){const a=Math.max(0,Math.min(ACTIONS.length-1,Math.floor(actionIndex))),n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));return this.state.slowActionReadout[a]?.[n]??0;}
  consolidateActionWeight(actionIndex:number,neuron:number,current:number,teacherBlend01:number,importance01:number){
    if(!this.state.enabled)return current;
    const a=Math.max(0,Math.min(ACTIONS.length-1,Math.floor(actionIndex))),n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));
    const imp=clamp(importance01);
    const previous=this.state.slowActionReadout[a]![n]??0;
    const b=clamp(teacherBlend01)*(1-.35*imp);
    this.state.slowActionReadout[a]![n]=finite(previous)+(finite(current)-finite(previous))*clamp(.006+teacherBlend01*.18)*(1-.35*imp);
    const next=finite(current)+(finite(this.state.slowActionReadout[a]![n])-finite(current))*b;
    this.state.consolidatedWeights++;
    this.state.teacherAgreement01=clamp(this.state.teacherAgreement01*.999+((1-Math.min(1,Math.abs(next-current)*8)))*.001);
    return next;
  }
  consolidateEdgeWeight(neuron:number,edge:number,current:number,teacherBlend01:number,importance01:number){
    if(!this.state.enabled)return current;
    const n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron))),q=Math.max(0,Math.min(11,Math.floor(edge))),imp=clamp(importance01);
    const previous=this.state.slowEdgeWeights[n]![q]??0;
    this.state.slowEdgeWeights[n]![q]=finite(previous)+(finite(current)-finite(previous))*clamp(.004+teacherBlend01*.12)*(1-.38*imp);
    const next=finite(current)+(finite(this.state.slowEdgeWeights[n]![q])-finite(current))*clamp(teacherBlend01)*(1-.42*imp);
    this.state.consolidatedWeights++;
    this.state.weightDrift01=clamp(this.state.weightDrift01*.97+Math.abs(finite(current)-finite(previous))*.03);
    return next;
  }
  updateSlowAction(actionIndex:number,neuron:number,current:number,teacherBlend01:number,importance01:number){
    if(!this.state.enabled)return;
    const a=Math.max(0,Math.min(ACTIONS.length-1,Math.floor(actionIndex))),n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron)));
    const prev=this.state.slowActionReadout[a]![n]??0;this.state.slowActionReadout[a]![n]=finite(prev)+(finite(current)-finite(prev))*clamp(.006+teacherBlend01*.18)*(1-.35*clamp(importance01));this.state.consolidatedWeights++;
  }
  updateSlowEdge(neuron:number,edge:number,current:number,teacherBlend01:number,importance01:number){
    if(!this.state.enabled)return;
    const n=Math.max(0,Math.min(this.state.neurons-1,Math.floor(neuron))),q=Math.max(0,Math.min(11,Math.floor(edge)));const prev=this.state.slowEdgeWeights[n]![q]??0;this.state.slowEdgeWeights[n]![q]=finite(prev)+(finite(current)-finite(prev))*clamp(.004+teacherBlend01*.12)*(1-.38*clamp(importance01));this.state.consolidatedWeights++;this.state.weightDrift01=clamp(this.state.weightDrift01*.97+Math.abs(finite(current)-finite(prev))*.03);
  }
  metricsCompact(){const m=this.metrics();return {stability01:m.stability01,plasticity01:m.plasticity01,dormant01:m.dormant01,resetPressure01:m.resetPressure01,conflict01:m.conflict01,teacherAgreement01:m.teacherAgreement01,weightDrift01:m.weightDrift01,selectiveResets:m.selectiveResets,consolidatedWeights:m.consolidatedWeights,sparseUpdates:m.sparseUpdates,protectedUpdates:m.protectedUpdates};}
}
