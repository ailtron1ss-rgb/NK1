import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01 = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x:number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const seeded = (seed:number) => {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x ^= x >>> 13;
  return x >>> 0;
};
const rand = (seed:number, scale=0.35) => (((seeded(seed) / 0xffffffff) * 2) - 1) * scale;
const sigmoid = (x:number) => 1 / (1 + Math.exp(-Math.max(-8, Math.min(8, x))));

export interface B269Synapse { pre:number; post:number; weight:number; usage01:number; age:number; active:boolean; }

export interface B269SpikingPlasticState {
  version:1;
  neuronCount:number;
  inputDim:number;
  cycles:number;
  learningUpdates:number;
  spikes:number;
  synapticUpdates:number;
  structuralUpdates:number;
  structuralGrew:number;
  structuralPruned:number;
  membrane:number[];
  threshold:number[];
  refractory:number[];
  preTrace:number[];
  postTrace:number[];
  synapses:B269Synapse[];
  actionBias:number[][];
  lastSpikes:number[];
  lastAssembly:number[];
  lastInput:number[];
  lastAction:ActionKind|null;
  lastPrediction01:number;
  predictionErrorMean01:number;
  firingRate01:number;
  homeostaticError01:number;
  plasticity01:number;
  neuromodulation01:number;
  sparsity01:number;
  synapticEnergy01:number;
  lastTick:number;
  history:Array<{tick:number;action:ActionKind|null;spikes:number;prediction01:number;reward01:number;modulation01:number}>;
}

export interface B269StepInput {
  vector:number[];
  tick:number;
  action?:ActionKind|null;
  dopamine01?:number;
  norepinephrine01?:number;
  acetylcholine01?:number;
  novelty01?:number;
  uncertainty01?:number;
  predictionError01?:number;
  learningEnabled?:boolean;
}

export interface B269StepResult {
  spikes:number[];
  assembly:number[];
  prediction01:number;
  firingRate01:number;
  homeostaticError01:number;
  plasticity01:number;
  neuromodulation01:number;
  structuralUpdates:number;
  structuralGrew:number;
  structuralPruned:number;
}

function makeSynapses(neuronCount:number, fanIn:number):B269Synapse[] {
  const result:B269Synapse[]=[];
  for(let post=0;post<neuronCount;post++){
    for(let k=0;k<fanIn;k++){
      const pre=(post*17+k*7+3)%neuronCount;
      if(pre===post) continue;
      result.push({pre,post,weight:rand(100_000+post*31+k*13, .24),usage01:.08,age:0,active:true});
    }
  }
  return result;
}

export function defaultB269SpikingPlastic():B269SpikingPlasticState {
  const neuronCount=48;
  return {
    version:1,neuronCount,inputDim:24,cycles:0,learningUpdates:0,spikes:0,synapticUpdates:0,structuralUpdates:0,structuralGrew:0,structuralPruned:0,
    membrane:new Array(neuronCount).fill(0),
    threshold:new Array(neuronCount).fill(.34),
    refractory:new Array(neuronCount).fill(0),
    preTrace:new Array(neuronCount).fill(0),
    postTrace:new Array(neuronCount).fill(0),
    synapses:makeSynapses(neuronCount,6),
    actionBias:ACTIONS.map((_,ai)=>Array.from({length:neuronCount},(_,i)=>rand(200_000+ai*101+i*17,.08))),
    lastSpikes:new Array(neuronCount).fill(0),
    lastAssembly:new Array(neuronCount).fill(0),
    lastInput:new Array(24).fill(0),
    lastAction:null,lastPrediction01:.5,predictionErrorMean01:.5,firingRate01:.08,homeostaticError01:.1,
    plasticity01:.45,neuromodulation01:.5,sparsity01:.92,synapticEnergy01:.22,lastTick:0,history:[],
  };
}

export class B269SpikingPlasticNeuralSubstrate {
  private state=defaultB269SpikingPlastic();

  snapshot(){return structuredClone(this.state);}

  restore(raw?:Partial<B269SpikingPlasticState>|null){
    const d=defaultB269SpikingPlastic(),r=raw??{};
    const n=Math.max(24,Math.min(64,Math.floor(Number(r.neuronCount??d.neuronCount))));
    const arr=(v:unknown,len:number,fill=0)=>Array.isArray(v)?v.slice(0,len).concat(new Array(Math.max(0,len-(v as unknown[]).length)).fill(fill)).slice(0,len):new Array(len).fill(fill);
    const syn=Array.isArray(r.synapses)?r.synapses.slice(0,512).map((s:any)=>({pre:Math.max(0,Math.min(n-1,Math.floor(Number(s?.pre??0)))),post:Math.max(0,Math.min(n-1,Math.floor(Number(s?.post??0)))),weight:clamp11(Number(s?.weight??0)),usage01:clamp01(Number(s?.usage01??0)),age:Math.max(0,Math.floor(Number(s?.age??0))),active:s?.active!==false})):makeSynapses(n,6);
    const weights=Array.isArray(r.actionBias)?ACTIONS.map((_,ai)=>arr((r.actionBias as any)[ai],n,0)):defaultB269SpikingPlastic().actionBias;
    this.state={...d,...r,version:1,neuronCount:n,inputDim:24,
      membrane:arr(r.membrane,n),threshold:arr(r.threshold,n,.34).map(v=>Math.max(.16,Math.min(.9,Number(v)))),
      refractory:arr(r.refractory,n),preTrace:arr(r.preTrace,n),postTrace:arr(r.postTrace,n),
      synapses:syn,actionBias:weights,lastSpikes:arr(r.lastSpikes,n),lastAssembly:arr(r.lastAssembly,n),lastInput:arr(r.lastInput,24),
      history:Array.isArray(r.history)?r.history.slice(-256):[]};
  }

  private actionIndex(action:ActionKind|null|undefined){return action?Math.max(0,ACTIONS.indexOf(action)):-1;}

  private encode(v:number[]){return Array.from({length:24},(_,i)=>clamp11(Number(v[i]??0)));}

  private neuromodulation(input:B269StepInput){
    const d=clamp01(input.dopamine01??.5),ne=clamp01(input.norepinephrine01??.5),ac=clamp01(input.acetylcholine01??.5);
    const novelty=clamp01(input.novelty01??.2),unc=clamp01(input.uncertainty01??.3),err=clamp01(input.predictionError01??.2);
    return clamp01(.36*d+.22*ne+.18*ac+.12*novelty+.12*err+.08*unc);
  }

  step(input:B269StepInput):B269StepResult {
    const x=this.encode(input.vector), n=this.state.neuronCount, ai=this.actionIndex(input.action), mod=this.neuromodulation(input);
    const nextMem=new Array(n).fill(0), spikes=new Array(n).fill(0);
    for(let i=0;i<n;i++){
      let current=0;
      for(let k=0;k<24;k++) current += (rand(310_000+i*53+k*11,.11))*(x[k]??0);
      if(ai>=0) current += this.state.actionBias[ai][i] ?? 0;
      for(const s of this.state.synapses){if(s.active && s.post===i) current += s.weight*this.state.lastSpikes[s.pre];}
      const leak=this.state.membrane[i]*.78;
      nextMem[i]=leak+current;
      if(this.state.refractory[i]>0){this.state.refractory[i]=Math.max(0,this.state.refractory[i]-1);continue;}
      const fired=nextMem[i]>=this.state.threshold[i] ? 1 : 0;
      if(fired){spikes[i]=1;nextMem[i]=0;this.state.refractory[i]=1;}
    }
    // Sparse winner-take-all: retain the strongest ~12.5% events to avoid dense firing.
    const eventIndices=spikes.map((v,i)=>v?i:-1).filter(i=>i>=0);
    if(eventIndices.length>Math.max(2,Math.ceil(n*.14))){
      const keep=new Set(eventIndices.slice(0,Math.max(2,Math.ceil(n*.14))));
      for(const i of eventIndices) if(!keep.has(i)) spikes[i]=0;
    }
    for(let i=0;i<n;i++){
      this.state.preTrace[i]=this.state.preTrace[i]*.91+spikes[i]*.22;
      this.state.postTrace[i]=this.state.postTrace[i]*.86+spikes[i]*.35;
      this.state.membrane[i]=nextMem[i];
    }
    const firing=spikes.reduce((a,b)=>a+b,0)/n;
    // Causal prediction must depend materially on recurrent synaptic state, not merely
    // on instantaneous input. This makes structural lesions capable of changing the
    // neural prediction itself, which is required for Brick 3 causal evidence.
    let recurrentDrive=0; let recurrentMass=0;
    for(const syn of this.state.synapses){
      if(!syn.active) continue;
      recurrentDrive += syn.weight*(this.state.lastSpikes[syn.pre]??0);
      recurrentMass += Math.abs(syn.weight);
    }
    const recurrent01=clamp11(recurrentMass>1e-6?recurrentDrive/recurrentMass:0);
    const actionDrive=ai>=0 ? this.state.actionBias[ai].reduce((sum,w,i)=>sum+w*(spikes[i]??0),0)/Math.max(1,n) : 0;
    const prediction=sigmoid(.5 + recurrent01*2.8 + firing*.9 + clamp11(actionDrive)*1.15);
    const targetRate=.075;
    const homeostaticError=Math.abs(firing-targetRate);
    for(let i=0;i<n;i++){
      const drift=(targetRate-firing)*.018;
      this.state.threshold[i]=Math.max(.28,Math.min(.95,this.state.threshold[i]-drift));
    }
    this.state.lastSpikes=spikes;
    this.state.lastAssembly=spikes.map((v,i)=>clamp01(.7*v+.3*this.state.postTrace[i]));
    this.state.lastInput=x;this.state.lastAction=input.action??null;this.state.lastPrediction01=prediction;this.state.cycles++;this.state.spikes+=spikes.reduce((a,b)=>a+b,0);this.state.lastTick=input.tick;
    this.state.firingRate01=this.state.firingRate01*.92+firing*.08;
    this.state.homeostaticError01=this.state.homeostaticError01*.9+homeostaticError*.1;
    this.state.neuromodulation01=this.state.neuromodulation01*.88+mod*.12;
    this.state.sparsity01=clamp01(1-this.state.firingRate01*1.8);
    this.state.synapticEnergy01=clamp01(this.state.synapses.filter(s=>s.active).reduce((sum,s)=>sum+Math.abs(s.weight),0)/(Math.max(1,this.state.synapses.length)*.24*1.6));
    this.state.plasticity01=clamp01(this.state.plasticity01*.96+mod*.025+Math.min(1,homeostaticError*3)*.015);
    let structuralUpdates=0;
    if(this.state.cycles%32===0) structuralUpdates=this.structuralPlasticity(mod,input.novelty01??.2);
    this.state.structuralUpdates+=structuralUpdates;
    return {spikes:[...spikes],assembly:[...this.state.lastAssembly],prediction01:prediction,firingRate01:this.state.firingRate01,homeostaticError01:this.state.homeostaticError01,plasticity01:this.state.plasticity01,neuromodulation01:this.state.neuromodulation01,structuralUpdates,structuralGrew:this.state.structuralGrew,structuralPruned:this.state.structuralPruned};
  }

  /** Action-conditioned predictions from the current recurrent assembly. No mutation. */
  actionPredictions(){
    const n=this.state.neuronCount;
    const firing=this.state.lastSpikes.reduce((a,b)=>a+b,0)/Math.max(1,n);
    let recurrentDrive=0; let recurrentMass=0;
    for(const syn of this.state.synapses){
      if(!syn.active) continue;
      recurrentDrive += syn.weight*(this.state.lastSpikes[syn.pre]??0);
      recurrentMass += Math.abs(syn.weight);
    }
    const recurrent01=clamp11(recurrentMass>1e-6?recurrentDrive/recurrentMass:0);
    const base=.5 + recurrent01*2.8 + firing*.9;
    return ACTIONS.map((action,ai)=>{
      const actionDrive=this.state.actionBias[ai].reduce((sum,w,i)=>sum+w*(this.state.lastSpikes[i]??0),0)/Math.max(1,n);
      return [action,sigmoid(base+clamp11(actionDrive)*1.15)] as const;
    }).reduce((out,[action,pred])=>{out[action]=pred;return out;},{} as Record<ActionKind,number>);
  }

  actionPrediction(action:ActionKind){ return this.actionPredictions()[action] ?? .5; }

  learnFromOutcome(input:{reward01:number;predictionError01:number;tick:number;action?:ActionKind|null}){
    const reward=clamp11(input.reward01-.5),error=clamp11(input.predictionError01),third=clamp11(reward*.72+error*.58)*this.state.neuromodulation01;
    let updates=0;
    for(const s of this.state.synapses){
      if(!s.active) continue;
      const pre=this.state.preTrace[s.pre]??0,post=this.state.postTrace[s.post]??0,hebb=pre*post;
      const stdp=(pre*spikeAt(this.state.lastSpikes,s.post)-post*spikeAt(this.state.lastSpikes,s.pre));
      const delta=.006*this.state.plasticity01*(third*(hebb+.45*stdp)-.0025*s.weight);
      if(Math.abs(delta)>1e-7){s.weight=clamp11(s.weight+delta);s.usage01=clamp01(s.usage01*.96+Math.abs(delta)*5+.04*(this.state.lastSpikes[s.post]??0));updates++;}
      s.age++;
    }
    const ai=this.actionIndex(input.action??this.state.lastAction);
    if(ai>=0){for(let i=0;i<this.state.neuronCount;i++){const spike=this.state.lastSpikes[i]??0;this.state.actionBias[ai][i]=clamp11(this.state.actionBias[ai][i]+.004*third*spike);}}
    // Homeostatic synaptic scaling: normalize active afferents without erasing learned sign.
    for(let post=0;post<this.state.neuronCount;post++){
      const aff=this.state.synapses.filter(s=>s.active&&s.post===post);
      if(!aff.length)continue;
      const mean=aff.reduce((sum,s)=>sum+Math.abs(s.weight),0)/aff.length;
      const scale=mean>.34?.97:mean<.08?1.03:1;
      if(scale!==1)for(const s of aff)s.weight=clamp11(s.weight*scale);
    }
    this.state.learningUpdates++;this.state.synapticUpdates+=updates;
    const absErr=Math.abs(error);
    this.state.predictionErrorMean01=this.state.predictionErrorMean01*.94+absErr*.06;
    this.state.plasticity01=clamp01(this.state.plasticity01*.95+Math.abs(third)*.04);
    this.state.history=[...this.state.history.slice(-255),{tick:input.tick,action:input.action??this.state.lastAction,spikes:this.state.lastSpikes.reduce((a,b)=>a+b,0),prediction01:this.state.lastPrediction01,reward01:clamp01(input.reward01),modulation01:this.state.neuromodulation01}];
    return {updates,thirdFactor01:clamp01(Math.abs(third)),predictionError01:absErr,meanWeight01:this.activeMeanWeight()};
  }

  private structuralPlasticity(mod01:number,novelty01:number){
    const active=this.state.synapses.filter(s=>s.active);
    let updates=0; let pruned=0; let grew=0;
    for(const s of active){s.usage01=clamp01(s.usage01*.98+(this.state.lastSpikes[s.post]??0)*.02);if(s.age>96&&s.usage01<.025&&active.length>this.state.neuronCount*4.5){s.active=false;updates++;pruned++;}}
    const activeCount=this.state.synapses.filter(s=>s.active).length;
    if(activeCount<this.state.neuronCount*5.2 && mod01>.45 && novelty01>.35){
      for(let k=0;k<Math.min(6,this.state.neuronCount);k++){
        const pre=(this.state.cycles*11+k*7)%this.state.neuronCount;
        const post=(pre*13+k*5+3)%this.state.neuronCount;
        if(pre===post)continue;
        if(this.state.synapses.some(s=>s.active&&s.pre===pre&&s.post===post))continue;
        this.state.synapses.push({pre,post,weight:rand(this.state.cycles*37+k*19,.06),usage01:.01,age:0,active:true});updates++;grew++;
      }
    }
    this.state.structuralGrew+=grew;
    this.state.structuralPruned+=pruned;
    return updates;
  }

  private activeMeanWeight(){const a=this.state.synapses.filter(s=>s.active);return a.length?a.reduce((sum,s)=>sum+Math.abs(s.weight),0)/a.length:0;}

  /** Persistent structural lesion for causal experiments. Unlike lesion(), this does not restore the source state. */
  applyStructuralLesion(fraction01=.35){
    const fraction=clamp01(fraction01);
    const activeSynapses=this.state.synapses.filter(s=>s.active);
    const baselineActive=activeSynapses.length;
    const neuronCount=Math.max(1,Math.floor(this.state.neuronCount*fraction));
    const degree=Array.from({length:this.state.neuronCount},(_,i)=>({i,degree:activeSynapses.reduce((n,s)=>n+(s.pre===i||s.post===i?1:0),0)}));
    const lesionedNeurons=degree.sort((a,b)=>b.degree-a.degree||a.i-b.i).slice(0,neuronCount).map(x=>x.i);
    const neuronSet=new Set(lesionedNeurons);
    for(const i of lesionedNeurons){
      this.state.membrane[i]=0; this.state.threshold[i]=.95; this.state.refractory[i]=3;
      this.state.preTrace[i]=0; this.state.postTrace[i]=0; this.state.lastSpikes[i]=0; this.state.lastAssembly[i]=0;
      for(let ai=0;ai<this.state.actionBias.length;ai++) this.state.actionBias[ai][i]=0;
    }
    for(const syn of this.state.synapses) if(neuronSet.has(syn.pre)||neuronSet.has(syn.post)) syn.active=false;
    const lesionedActive=this.state.synapses.filter(s=>s.active).length;
    return {fraction01:fraction,lesionedNeurons:lesionedNeurons.length,baselineActiveSynapses:baselineActive,lesionedActiveSynapses:lesionedActive,removedSynapses:Math.max(0,baselineActive-lesionedActive),structural:true,persistent:true};
  }

  probe(){
    const l=this.state.lastSpikes.reduce((a,b)=>a+b,0)/Math.max(1,this.state.neuronCount);
    const active=this.state.synapses.filter(s=>s.active).length;
    return {neuronCount:this.state.neuronCount,activeSynapses:active,spikeRate01:l,firingRate01:this.state.firingRate01,sparsity01:this.state.sparsity01,homeostaticError01:this.state.homeostaticError01,plasticity01:this.state.plasticity01,neuromodulation01:this.state.neuromodulation01,prediction01:this.state.lastPrediction01,predictionErrorMean01:this.state.predictionErrorMean01,synapticUpdates:this.state.synapticUpdates,structuralUpdates:this.state.structuralUpdates,structuralGrew:this.state.structuralGrew,structuralPruned:this.state.structuralPruned,meanActiveWeight:this.activeMeanWeight(),historyLength:this.state.history.length};
  }

  lesion(fraction01=.35){
    const fraction=clamp01(fraction01);
    const original=this.snapshot();
    const activeSynapses=this.state.synapses.filter(s=>s.active);
    const baselineActive=activeSynapses.length;
    const neuronCount=Math.max(1,Math.floor(this.state.neuronCount*fraction));
    const degree=Array.from({length:this.state.neuronCount},(_,i)=>({i,degree:activeSynapses.reduce((n,s)=>n+(s.pre===i||s.post===i?1:0),0)}));
    // Target neurons that actually participate in the current circuit instead of arbitrary edges.
    const lesionedNeurons=degree.sort((a,b)=>b.degree-a.degree||a.i-b.i).slice(0,neuronCount).map(x=>x.i);
    const neuronSet=new Set(lesionedNeurons);
    const baselineInput=[...this.state.lastInput];
    const baselineAction=this.state.lastAction;
    let baselineSum=0; let lesionSum=0;
    for(let i=0;i<8;i++) baselineSum+=this.step({vector:baselineInput,tick:this.state.lastTick+i+1,action:baselineAction,learningEnabled:false}).spikes.reduce((a,b)=>a+b,0)/this.state.neuronCount;
    this.restore(original);
    const lesionState=this.snapshot();
    for(const i of lesionedNeurons){
      this.state.membrane[i]=0;
      this.state.threshold[i]=.95;
      this.state.refractory[i]=3;
      this.state.preTrace[i]=0;
      this.state.postTrace[i]=0;
      this.state.lastSpikes[i]=0;
      this.state.lastAssembly[i]=0;
      for(let ai=0;ai<this.state.actionBias.length;ai++) this.state.actionBias[ai][i]=0;
    }
    for(const s of this.state.synapses) if(neuronSet.has(s.pre)||neuronSet.has(s.post)) s.active=false;
    let lesionedActive=this.state.synapses.filter(s=>s.active).length;
    for(let i=0;i<8;i++) lesionSum+=this.step({vector:baselineInput,tick:this.state.lastTick+i+1,action:baselineAction,learningEnabled:false}).spikes.reduce((a,b)=>a+b,0)/this.state.neuronCount;
    const baselineRate=baselineSum/8;
    const lesionedRate=lesionSum/8;
    const drop=clamp01(Math.max(0,baselineRate-lesionedRate)*6);
    this.restore(lesionState);
    return {lesionFraction01:fraction,lesionedNeurons:lesionedNeurons.length,baselineActiveSynapses:baselineActive,lesionedActiveSynapses:lesionedActive,removedSynapses:Math.max(0,baselineActive-lesionedActive),baselineFiringRate01:baselineRate,lesionedFiringRate01:lesionedRate,causalDrop01:drop,structural:true};
  }
}
function spikeAt(v:number[],i:number){return v[i]??0;}
