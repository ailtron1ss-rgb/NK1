/**
 * B293 — Self/World Predictive Microcircuit.
 *
 * A deliberately small recurrent leaky-integrator / spiking microcircuit that
 * predicts the near-term consequence of the organism's selected action for
 * self/world coherence. It is not a new executive owner: it supplies
 * predictive evidence to B290/B291 and learns only from observed outcomes.
 * The bounded topology is designed for low-resource execution.
 */
import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const hash=(n:number)=>{let x=n|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return x>>>0;};
const seeded=(n:number,scale=.18)=>(((hash(n)/0xffffffff)*2)-1)*scale;

export interface B293State {
  version:1;
  neuronCount:number;
  inputDim:number;
  cycles:number;
  learningUpdates:number;
  spikes:number;
  synapticUpdates:number;
  membrane:number[];
  threshold:number[];
  refractory:number[];
  preTrace:number[];
  postTrace:number[];
  weights:number[][];
  actionBias:number[][];
  lastSpikes:number[];
  lastInput:number[];
  lastAction:ActionKind|null;
  predictedSelf01:number;
  predictedWorld01:number;
  predictionError01:number;
  causalConfidence01:number;
  plasticity01:number;
  firingRate01:number;
  lesion01:number;
  history:Array<{tick:number;action:ActionKind|null;predicted01:number;actual01:number;error01:number}>;
}

export interface B293Input {
  tick:number;
  action?:ActionKind|null;
  selfContinuity01:number;
  selfCoherence01:number;
  identityFit01:number;
  worldCoherence01:number;
  realityAlignment01:number;
  goalPressure01:number;
  novelty01:number;
  uncertainty01:number;
  predictionError01:number;
  energy01:number;
  thermal01:number;
}

export interface B293StepResult {
  spikes:number;
  firingRate01:number;
  predictedSelf01:number;
  predictedWorld01:number;
  predictionError01:number;
  causalConfidence01:number;
  actionBias:Record<ActionKind,number>;
}

export const defaultB293State=():B293State=>{
  const n=24;
  const weights=Array.from({length:n},(_,post)=>Array.from({length:n},(_,pre)=>pre===post?0:seeded(100_000+post*53+pre*17,.12)));
  return {
    version:1,neuronCount:n,inputDim:12,cycles:0,learningUpdates:0,spikes:0,synapticUpdates:0,
    membrane:new Array(n).fill(0),threshold:new Array(n).fill(.42),refractory:new Array(n).fill(0),
    preTrace:new Array(n).fill(0),postTrace:new Array(n).fill(0),weights,
    actionBias:ACTIONS.map((_,ai)=>Array.from({length:n},(_,i)=>seeded(200_000+ai*71+i*29,.055))),
    lastSpikes:new Array(n).fill(0),lastInput:new Array(12).fill(0),lastAction:null,
    predictedSelf01:.5,predictedWorld01:.5,predictionError01:.5,causalConfidence01:.25,
    plasticity01:.42,firingRate01:.06,lesion01:0,history:[]
  };
};

export class B293SelfWorldPredictiveMicrocircuit {
  private state=B293SelfWorldPredictiveMicrocircuit.normalize(defaultB293State());

  private static normalize(raw:Partial<B293State>):B293State{
    const d=defaultB293State(); const r:any=raw??{}; const n=Math.max(16,Math.min(32,Math.floor(Number(r.neuronCount??d.neuronCount))));
    const vec=(v:unknown,len:number,fill=0)=>Array.isArray(v)?v.slice(0,len).concat(new Array(Math.max(0,len-(v as unknown[]).length)).fill(fill)).slice(0,len):new Array(len).fill(fill);
    const weights=Array.from({length:n},(_,post)=>Array.from({length:n},(_,pre)=>pre===post?0:clamp11(Number(((r.weights as any)?.[post]?.[pre]) ?? seeded(100_000+post*53+pre*17,.12)))));
    const actionBias=ACTIONS.map((_,ai)=>vec((r.actionBias as any)?.[ai],n,0));
    return {...d,...r,version:1,neuronCount:n,inputDim:12,
      membrane:vec(r.membrane,n),threshold:vec(r.threshold,n,.42).map(v=>Math.max(.22,Math.min(.95,Number(v)))),
      refractory:vec(r.refractory,n),preTrace:vec(r.preTrace,n),postTrace:vec(r.postTrace,n),
      weights,actionBias,lastSpikes:vec(r.lastSpikes,n),lastInput:vec(r.lastInput,12),
      history:Array.isArray(r.history)?r.history.slice(-128):[]};
  }

  restore(raw?:Partial<B293State>|null){this.state=B293SelfWorldPredictiveMicrocircuit.normalize(raw??defaultB293State());}
  snapshot(){return structuredClone(this.state);}

  private encode(input:B293Input){
    return [input.selfContinuity01,input.selfCoherence01,input.identityFit01,input.worldCoherence01,input.realityAlignment01,input.goalPressure01,input.novelty01,input.uncertainty01,input.predictionError01,input.energy01,input.thermal01,input.action? (ACTIONS.indexOf(input.action)+1)/ACTIONS.length:0].map(clamp01);
  }

  private actionIndex(action:ActionKind|null|undefined){return action?Math.max(0,ACTIONS.indexOf(action)):-1;}

  step(input:B293Input):B293StepResult{
    const x=this.encode(input),n=this.state.neuronCount,ai=this.actionIndex(input.action),spikes=new Array(n).fill(0),nextMem=new Array(n).fill(0);
    const lesionScale=1-this.state.lesion01;
    for(let post=0;post<n;post++){
      let current=0;
      for(let k=0;k<12;k++) current += seeded(300_000+post*41+k*13,.09)*(x[k]-.5);
      if(ai>=0) current += (this.state.actionBias[ai]?.[post]??0)*.72;
      for(let pre=0;pre<n;pre++) current += (this.state.weights[post]?.[pre]??0)*this.state.lastSpikes[pre]*lesionScale;
      nextMem[post]=this.state.membrane[post]*.82 + current;
      if(this.state.refractory[post]>0){this.state.refractory[post]=Math.max(0,this.state.refractory[post]-1);continue;}
      if(nextMem[post]>=this.state.threshold[post]){spikes[post]=1;nextMem[post]=0;this.state.refractory[post]=1;}
    }
    let fired=spikes.reduce((a,b)=>a+b,0);
    const top=Math.max(2,Math.ceil(n*.16));
    if(fired>top){
      const keep=new Set(Array.from({length:n},(_,i)=>i).filter(i=>spikes[i]>0).sort((a,b)=>b-a).slice(0,top));
      for(let i=0;i<n;i++) if(spikes[i] && !keep.has(i)) spikes[i]=0;
      fired=top;
    }
    for(let i=0;i<n;i++){
      this.state.preTrace[i]=this.state.preTrace[i]*.93+spikes[i]*.20;
      this.state.postTrace[i]=this.state.postTrace[i]*.90+spikes[i]*.30;
      this.state.membrane[i]=nextMem[i];
    }
    const firing=fired/n;
    const circuitGain=.72 + .28*lesionScale;
    const selfEvidence=clamp01((.45 + .22*x[0]+.18*x[1]+.15*x[2]+.10*(firing/.25-.5))*circuitGain);
    const worldEvidence=clamp01((.45 + .27*x[3]+.20*x[4]+.12*x[5]+.08*(1-x[7]) + .08*(firing/.25-.5))*circuitGain);
    const pError=clamp01(Math.abs((selfEvidence+worldEvidence)*.5 - clamp01(.52 + input.predictionError01*.16)));
    this.state.lastSpikes=spikes;this.state.lastInput=x;this.state.lastAction=input.action??null;
    this.state.predictedSelf01=selfEvidence;this.state.predictedWorld01=worldEvidence;this.state.predictionError01=this.state.predictionError01*.92+pError*.08;
    this.state.causalConfidence01=clamp01(this.state.causalConfidence01*.96+(1-pError)*.04);
    this.state.firingRate01=this.state.firingRate01*.92+firing*.08;
    this.state.cycles++;this.state.spikes+=fired;
    const actionBias=Object.fromEntries(ACTIONS.map((a,index)=>[a,this.actionBias(a)])) as Record<ActionKind,number>;
    return {spikes:fired,firingRate01:this.state.firingRate01,predictedSelf01:selfEvidence,predictedWorld01:worldEvidence,predictionError01:this.state.predictionError01,causalConfidence01:this.state.causalConfidence01,actionBias};
  }

  learnFromOutcome(input:{tick:number;action?:ActionKind|null;reward01:number;actualSelf01:number;actualWorld01:number;predictionError01:number;identityContinuity01:number;novelty01:number}){
    const r=clamp01(input.reward01),actualSelf=clamp01(input.actualSelf01),actualWorld=clamp01(input.actualWorld01),obsError=clamp01(Math.abs(this.state.predictedSelf01-actualSelf)*.5+Math.abs(this.state.predictedWorld01-actualWorld)*.5);
    const teaching=clamp11((r-.5)*.75+(1-obsError)*.35-input.predictionError01*.30+(input.identityContinuity01-.5)*.20);
    let updates=0;
    for(let post=0;post<this.state.neuronCount;post++){
      for(let pre=0;pre<this.state.neuronCount;pre++){
        if(pre===post)continue;
        const hebb=this.state.preTrace[pre]*this.state.postTrace[post];
        const stdp=this.state.preTrace[pre]*(this.state.lastSpikes[post]??0)-this.state.postTrace[post]*(this.state.lastSpikes[pre]??0);
        const delta=.0032*this.state.plasticity01*(teaching*(hebb+.35*stdp)-this.state.weights[post][pre]*.003);
        if(Math.abs(delta)>1e-8){this.state.weights[post][pre]=clamp11(this.state.weights[post][pre]+delta);updates++;}
      }
    }
    const ai=this.actionIndex(input.action??this.state.lastAction);
    if(ai>=0){for(let i=0;i<this.state.neuronCount;i++){const spike=this.state.lastSpikes[i]??0;this.state.actionBias[ai][i]=clamp11(this.state.actionBias[ai][i]+.0035*teaching*spike);}}
    this.state.learningUpdates++;this.state.synapticUpdates+=updates;this.state.plasticity01=clamp01(this.state.plasticity01*.95+Math.abs(teaching)*.045+input.novelty01*.01);
    this.state.predictionError01=this.state.predictionError01*.88+obsError*.12;
    this.state.history=[...this.state.history.slice(-127),{tick:input.tick,action:input.action??this.state.lastAction,predicted01:(this.state.predictedSelf01+this.state.predictedWorld01)/2,actual01:(actualSelf+actualWorld)/2,error01:obsError}];
    return {updates,teaching01:teaching,observationError01:obsError,causalConfidence01:this.state.causalConfidence01};
  }

  actionBias(action:ActionKind){
    const ai=this.actionIndex(action); if(ai<0)return 0;
    const mean=(this.state.actionBias[ai]??[]).reduce((s,v)=>s+v,0)/Math.max(1,this.state.neuronCount);
    return clamp11(mean*(1-this.state.predictionError01*.55)*.22);
  }

  metrics(){return {cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,spikes:this.state.spikes,synapticUpdates:this.state.synapticUpdates,predictedSelf01:this.state.predictedSelf01,predictedWorld01:this.state.predictedWorld01,predictionError01:this.state.predictionError01,causalConfidence01:this.state.causalConfidence01,plasticity01:this.state.plasticity01,firingRate01:this.state.firingRate01,lesion01:this.state.lesion01,historyDepth:this.state.history.length};}
  diagnostics(){return {...this.metrics(),activeSynapses:this.state.neuronCount*(this.state.neuronCount-1),actionBias:Object.fromEntries(ACTIONS.map(a=>[a,this.actionBias(a)]))};}
  lesion(fraction01=.35){this.state.lesion01=clamp01(fraction01);return this.metrics();}
  clearLesion(){this.state.lesion01=0;return this.metrics();}
}
