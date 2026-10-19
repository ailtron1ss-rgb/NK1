import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01 = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x:number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const sigmoid = (x:number) => 1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const dot = (a:number[],b:number[]) => { let s=0; for(let i=0;i<Math.min(a.length,b.length);i++) s += a[i]*b[i]; return s; };
const norm = (v:number[]) => Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine = (a:number[],b:number[]) => clamp11(dot(a,b)/(norm(a)*norm(b)));
const seeded = (seed:number) => { let x = seed|0; x = Math.imul(x ^ (x>>>16),0x21f0aaad); x = Math.imul(x ^ (x>>>15),0x735a2d97); return (x ^ (x>>>13))>>>0; };
const rand = (seed:number,scale=.2) => ((seeded(seed)/0xffffffff)*2-1)*scale;

export interface B279State {
  version:1;
  neuronCount:number;
  inputDim:number;
  cycles:number;
  learningUpdates:number;
  consolidationCount:number;
  retrievalCount:number;
  successfulRecalls:number;
  lesionCount:number;
  recurrentWeights:number[][];
  inputWeights:number[][];
  thresholds:number[];
  adaptation:number[];
  actionWeights:number[][];
  lastInput:number[];
  lastAssembly:number[];
  lastSettled:number[];
  lastAction:ActionKind|null;
  firingRate01:number;
  sparsity01:number;
  stability01:number;
  homeostaticError01:number;
  recurrentEnergy01:number;
  plasticity01:number;
  attractorSharpness01:number;
  lastRecallSimilarity01:number;
  lastCausalDrop01:number;
  activeNeurons:number[];
  recentAssemblies:number[][];
  recentInputs:number[][];
  history:Array<{tick:number;action:ActionKind|null;reward01:number;similarity01:number;firingRate01:number}>;
}

export interface B279StepInput {
  tick:number;
  vector:number[];
  action?:ActionKind|null;
  selfLatent?:number[];
  worldLatent?:number[];
  goalVector?:number[];
  novelty01?:number;
  uncertainty01?:number;
  autonomy01?:number;
  predictionError01?:number;
  learningEnabled?:boolean;
}

export interface B279StepResult {
  assembly:number[];
  settled:number[];
  selectedAction?:ActionKind;
  firingRate01:number;
  sparsity01:number;
  stability01:number;
  attractorSharpness01:number;
  recurrentEnergy01:number;
}

export function defaultB279State():B279State {
  const n=24,d=16;
  const recurrent=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:rand(70_000+i*97+j*31,.085)));
  const inputWeights=Array.from({length:n},(_,i)=>Array.from({length:d},(_,j)=>rand(80_000+i*43+j*17,.16)));
  const actionWeights=ACTIONS.map((_,a)=>Array.from({length:n},(_,i)=>rand(90_000+a*71+i*19,.055)));
  return {
    version:1,neuronCount:n,inputDim:d,cycles:0,learningUpdates:0,consolidationCount:0,retrievalCount:0,successfulRecalls:0,lesionCount:0,
    recurrentWeights:recurrent,inputWeights,thresholds:new Array(n).fill(.48),adaptation:new Array(n).fill(0),actionWeights,
    lastInput:new Array(d).fill(0),lastAssembly:new Array(n).fill(0),lastSettled:new Array(n).fill(0),lastAction:null,
    firingRate01:.08,sparsity01:.92,stability01:.5,homeostaticError01:.1,recurrentEnergy01:.25,plasticity01:.5,attractorSharpness01:.3,lastRecallSimilarity01:.5,lastCausalDrop01:0,activeNeurons:[],recentAssemblies:[],recentInputs:[],history:[]
  };
}

export class B279NeuralAttractorAssemblies {
  private state=B279NeuralAttractorAssemblies.create();
  static create(){return defaultB279State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B279State>|null){
    const d=defaultB279State(),r=raw??{};
    const n=Math.max(16,Math.min(32,Math.floor(Number(r.neuronCount??d.neuronCount))));
    const m=(src:any[][]|undefined,rows:number,cols:number,scale=.1)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>clamp11(Number(src?.[i]?.[j]??(rand(100_000+i*31+j*17,scale))))));
    const arr=(src:unknown,len:number,fill=0)=>Array.isArray(src)?(src as any[]).slice(0,len).concat(new Array(Math.max(0,len-(src as any[]).length)).fill(fill)).slice(0,len):new Array(len).fill(fill);
    this.state={...d,...r,version:1,neuronCount:n,inputDim:16,
      recurrentWeights:m(r.recurrentWeights,n,n,.085),inputWeights:m(r.inputWeights,n,16,.16),
      thresholds:arr(r.thresholds,n,.48).map(v=>Math.max(.22,Math.min(.95,Number(v)))),
      adaptation:arr(r.adaptation,n),actionWeights:Array.from({length:ACTIONS.length},(_,a)=>arr((r.actionWeights as any)?.[a],n,0)),
      lastInput:arr(r.lastInput,16),lastAssembly:arr(r.lastAssembly,n),lastSettled:arr(r.lastSettled,n),
      recentAssemblies:Array.isArray(r.recentAssemblies)?r.recentAssemblies.slice(-16).map(v=>arr(v,n)) : [],
      recentInputs:Array.isArray(r.recentInputs)?r.recentInputs.slice(-16).map(v=>arr(v,16)) : [],
      activeNeurons:Array.isArray(r.activeNeurons)?r.activeNeurons.slice(0,Math.ceil(n*.25)).map(v=>Math.max(0,Math.min(n-1,Math.floor(Number(v))))):[],
      history:Array.isArray(r.history)?r.history.slice(-128):[]};
  }
  private encode(v:number[],self:number[]=[],world:number[]=[],goal:number[]=[]){
    const base=Array.from({length:16},(_,i)=>clamp11(Number(v[i]??0)));
    for(let i=0;i<16;i++) base[i]=clamp11(base[i]*.55+(Number(self[i]??0))*.2+(Number(world[i]??0))*.15+(Number(goal[i]??0))*.1);
    return base;
  }
  private settle(input:number[],action:ActionKind|null,steps=5,inputGain=1){
    const n=this.state.neuronCount, ai=action?ACTIONS.indexOf(action):-1;
    let x=new Array(n).fill(0);
    for(let t=0;t<steps;t++){
      const y=new Array(n).fill(0);
      for(let i=0;i<n;i++){
        let z=0;
        for(let j=0;j<input.length;j++) z += this.state.inputWeights[i][j]*input[j]*inputGain;
        for(let j=0;j<n;j++) z += this.state.recurrentWeights[i][j]*x[j]*1.65;
        if(ai>=0) z += this.state.actionWeights[ai][i];
        z -= this.state.adaptation[i]*.38;
        z -= this.state.thresholds[i]*.28;
        y[i]=sigmoid(z*2.4);
      }
      // k-winners-take-most: sparse recurrent assembly.
      const ranked=y.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
      const k=Math.max(3,Math.round(n*.18));
      const keep=new Set(ranked.slice(0,k).map(x=>x.i));
      for(let i=0;i<n;i++) y[i]=keep.has(i)?y[i]:y[i]*.16;
      x=y;
    }
    return x;
  }
  private energy(v:number[]){return clamp01(v.reduce((s,x)=>s+Math.abs(x),0)/(Math.max(1,v.length)*.7));}
  step(input:B279StepInput):B279StepResult {
    const encoded=this.encode(input.vector,input.selfLatent,input.worldLatent,input.goalVector);
    const settled=this.settle(encoded,input.action??null,5);
    const k=Math.max(3,Math.round(this.state.neuronCount*.18));
    const ranked=settled.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).slice(0,k);
    const assembly=new Array(this.state.neuronCount).fill(0); for(const x of ranked) assembly[x.i]=x.v;
    const firing=ranked.reduce((s,x)=>s+x.v,0)/this.state.neuronCount;
    const mean=settled.reduce((s,x)=>s+x,0)/this.state.neuronCount;
    const variance=settled.reduce((s,x)=>s+(x-mean)**2,0)/this.state.neuronCount;
    const sharp=clamp01(Math.sqrt(variance)*2.8);
    const stability=clamp01(this.state.stability01*.92+(cosine(assembly,this.state.lastAssembly)*.5+.5)*.08);
    const target=.075,homeo=Math.abs(firing-target);
    for(let i=0;i<this.state.neuronCount;i++){
      const active=assembly[i]>.42?1:0;
      this.state.adaptation[i]=clamp01(this.state.adaptation[i]*.9+active*.1);
      this.state.thresholds[i]=Math.max(.22,Math.min(.95,this.state.thresholds[i] + (firing-target)*.012));
    }
    this.state.lastInput=encoded;this.state.lastSettled=settled;this.state.lastAssembly=assembly;this.state.lastAction=input.action??null;this.state.activeNeurons=ranked.map(x=>x.i);
    this.state.firingRate01=this.state.firingRate01*.9+firing*.1;this.state.sparsity01=clamp01(1-this.state.firingRate01*2.4);
    this.state.homeostaticError01=this.state.homeostaticError01*.9+homeo*.1;this.state.stability01=stability;this.state.attractorSharpness01=sharp;this.state.recurrentEnergy01=clamp01(this.state.recurrentEnergy01*.92+this.energy(settled)*.08);
    this.state.cycles++;this.state.recentAssemblies=[...this.state.recentAssemblies,assembly.slice()].slice(-16);this.state.recentInputs=[...this.state.recentInputs,encoded.slice()].slice(-16);
    if(this.state.cycles%24===0) this.consolidateRecent(input.tick);
    return {assembly:[...assembly],settled:[...settled],selectedAction:input.action??undefined,firingRate01:this.state.firingRate01,sparsity01:this.state.sparsity01,stability01:this.state.stability01,attractorSharpness01:sharp,recurrentEnergy01:this.state.recurrentEnergy01};
  }
  private consolidateRecent(tick:number){
    if(this.state.recentAssemblies.length<4)return;
    const recent=this.state.recentAssemblies.slice(-8);
    for(let a=0;a<recent.length;a++) for(let b=a;b<recent.length;b++){
      const A=recent[a]!,B=recent[b]!;
      const sim=.5+.5*cosine(A,B);
      if(sim<.62) continue;
      for(let i=0;i<this.state.neuronCount;i++) for(let j=0;j<this.state.neuronCount;j++){
        if(i===j)continue;
        const delta=.0065*(A[i]*B[j]*.8 + B[i]*A[j]*.2); this.state.recurrentWeights[i][j]=clamp11(this.state.recurrentWeights[i][j]+delta);
      }
    }
    this.state.consolidationCount++; this.state.plasticity01=clamp01(this.state.plasticity01*.94+.06);
  }
  learnFromOutcome(input:{tick:number;reward01:number;predictionError01:number;action?:ActionKind|null;externalEvidence01?:number}){
    const reward=clamp11(input.reward01-.5),err=clamp11(input.predictionError01),third=clamp11(reward*.78-err*.35)*(0.55+0.45*this.state.plasticity01);
    let updates=0;
    const a=this.state.lastAssembly;
    for(let i=0;i<this.state.neuronCount;i++) for(let j=0;j<this.state.neuronCount;j++){
      if(i===j)continue;
      const hebb=a[i]*a[j];
      const anti=(Math.abs(a[i]-a[j])*.18);
      const d=.0115*third*(hebb-anti*.15)-.0005*this.state.recurrentWeights[i][j];
      if(Math.abs(d)>1e-7){this.state.recurrentWeights[i][j]=clamp11(this.state.recurrentWeights[i][j]+d);updates++;}
    }
    const ai=input.action?ACTIONS.indexOf(input.action):-1;
    if(ai>=0){for(let i=0;i<this.state.neuronCount;i++){this.state.actionWeights[ai][i]=clamp11(this.state.actionWeights[ai][i]+.0045*third*(a[i]-.08));}}
    // Oja-like input-synapse plasticity makes assemblies learn their sensory/contextual basis instead of relying on fixed random input weights.
    for(let i=0;i<this.state.neuronCount;i++){
      const activity=a[i]??0;
      if(activity<.3) continue;
      for(let j=0;j<this.state.inputDim;j++){
        const x=this.state.lastInput[j]??0;
        const d=.0038*third*(activity*x-activity*activity*this.state.inputWeights[i][j]);
        this.state.inputWeights[i][j]=clamp11(this.state.inputWeights[i][j]+d);
      }
    }
    // Heterosynaptic/homeostatic scaling keeps attractors sparse rather than exploding.
    for(let i=0;i<this.state.neuronCount;i++){
      const row=this.state.recurrentWeights[i]!;const mean=row.reduce((s,x)=>s+Math.abs(x),0)/row.length;
      if(mean>.12) for(let j=0;j<row.length;j++) row[j]*=.985;
      else if(mean<.035) for(let j=0;j<row.length;j++) row[j]=clamp11(row[j]*1.012);
    }
    this.state.learningUpdates++;this.state.plasticity01=clamp01(this.state.plasticity01*.94+Math.abs(third)*.06);this.state.history=[...this.state.history.slice(-127),{tick:input.tick,action:input.action??this.state.lastAction,reward01:clamp01(input.reward01),similarity01:this.state.lastRecallSimilarity01,firingRate01:this.state.firingRate01}];
    return {updates,thirdFactor01:Math.abs(third),consolidationCount:this.state.consolidationCount,stability01:this.state.stability01};
  }
  probe(input:number[],action:ActionKind|null=null,steps=7,inputGain=1){ const encoded=this.encode(input); return this.settle(encoded,action,steps,inputGain); }
  recall(input:number[],noise01=.15,steps=7,referenceAssembly?:number[]){
    const cue=input.slice(0,this.state.inputDim).map((v,i)=>clamp11(Number(v??0)+(rand(120_000+i*31+this.state.cycles,.16)*clamp01(noise01))));
    const before=this.settle(cue,this.state.lastAction,steps,.55);
    const sim=.5+.5*cosine(before,referenceAssembly??this.state.lastAssembly);
    this.state.retrievalCount++;this.state.lastRecallSimilarity01=clamp01(this.state.lastRecallSimilarity01*.85+sim*.15);
    if(sim>.62)this.state.successfulRecalls++;
    return {pattern:before,similarity01:sim,converged:sim>.62,selfConsistency01:.5+.5*cosine(before,this.settle(this.state.lastInput,this.state.lastAction,steps,.55)),steps};
  }
  replay(count=6){
    const n=Math.min(count,this.state.recentAssemblies.length);let applied=0;
    for(let k=0;k<n;k++){
      const a=this.state.recentAssemblies[this.state.recentAssemblies.length-1-k]!;
      for(let i=0;i<this.state.neuronCount;i++) for(let j=0;j<this.state.neuronCount;j++){
        if(i===j)continue; const d=.0018*a[i]*a[j]; if(Math.abs(d)>1e-7){this.state.recurrentWeights[i][j]=clamp11(this.state.recurrentWeights[i][j]+d);applied++;}
      }
    }
    return {episodes:n,applied};
  }
  lesion(fraction01=.3){
    const frac=clamp01(fraction01);const before=this.state.lastAssembly.slice();const ranked=before.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);const remove=Math.max(1,Math.floor(ranked.length*frac));
    const saved=this.state.recurrentWeights.map(r=>r.slice());
    const nodes=ranked.slice(0,remove).map(x=>x.i);
    for(const node of nodes){for(let j=0;j<this.state.neuronCount;j++){this.state.recurrentWeights[node][j]=0;this.state.recurrentWeights[j][node]=0;}}
    const after=this.settle(this.state.lastInput,this.state.lastAction,7);const drop=clamp01(1-(.5+.5*cosine(before,after)));
    this.state.recurrentWeights=saved;this.state.lesionCount++;this.state.lastCausalDrop01=drop;
    return {lesionedNeurons:nodes,causalDrop01:drop,similarityAfter01:.5+.5*cosine(before,after)};
  }
  actionBias(action:ActionKind){
    const ai=ACTIONS.indexOf(action);if(ai<0)return 0;return clamp11(dot(this.state.actionWeights[ai]??[],this.state.lastAssembly)/Math.max(1,this.state.neuronCount))*0.04;
  }
  diagnostics(){
    return { ...this.state, meanActivity:this.state.lastSettled.reduce((s,x)=>s+x,0)/Math.max(1,this.state.lastSettled.length),
      attractorReactivation01:this.state.lastRecallSimilarity01,consolidationEfficiency01:clamp01(this.state.consolidationCount/Math.max(1,this.state.cycles/24)),
      assemblyCount:this.state.activeNeurons.length };
  }
  snapshotAttractor(){
    return {cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,consolidationCount:this.state.consolidationCount,retrievalCount:this.state.retrievalCount,successfulRecalls:this.state.successfulRecalls,stability01:this.state.stability01,homeostaticError01:this.state.homeostaticError01,attractorSharpness01:this.state.attractorSharpness01,lastRecallSimilarity01:this.state.lastRecallSimilarity01,lastCausalDrop01:this.state.lastCausalDrop01,sparsity01:this.state.sparsity01};
  }
}
