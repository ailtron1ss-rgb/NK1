import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
function w(seed:number, scale=.035){ let x=(seed|0)^0x9e3779b9; x=Math.imul(x^(x>>>16),0x21f0aaad); x=Math.imul(x^(x>>>15),0x735a2d97); x^=x>>>15; return (((x>>>0)/4294967295)*2-1)*scale; }
function matrix(rows:number,cols:number,seed:number,scale=.035){ return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>w(seed+r*257+c*17,scale))); }

export interface CentralBrainInput {
  perception:number[];
  world:number[];
  self:number[];
  memory:number[];
  attention:number[];
  body:number[];
  motivation:number[];
  actionContext?:number[];
  tick:number;
  at:number;
}

export interface CentralBrainState {
  version:1;
  inputDim:number;
  hiddenDim:number;
  broadcastDim:number;
  actionCount:number;
  hidden:number[];
  recurrentWeights:number[][];
  inputWeights:number[][];
  bias:number[];
  outputWeights:number[][];
  outputBias:number[];
  actionWeights:number[][];
  actionBias:number[];
  lastInput:number[];
  lastPrediction:number[];
  previousHidden:number[];
  stepCount:number;
  learningSteps:number;
  predictionError01:number;
  rollingPredictionError01:number;
  actionError01:number;
  actionSamples:number;
  parameterUpdates:number;
  lastTick:number;
  lastAt:number;
  qualityGate:{validated:boolean;minPredictionSamples:number;minActionSamples:number;brainPredictionError01:number;baselinePredictionError01:number;brainAdvantage01:number;reason:string};
}

function defaultState():CentralBrainState{
  const inputDim=48, hiddenDim=64, broadcastDim=16, actionCount=ACTIONS.length;
  return {version:1,inputDim,hiddenDim,broadcastDim,actionCount,
    hidden:new Array(hiddenDim).fill(0),
    recurrentWeights:matrix(hiddenDim,hiddenDim,12001,.028),
    inputWeights:matrix(hiddenDim,inputDim,13001,.032),
    bias:new Array(hiddenDim).fill(0),
    outputWeights:matrix(inputDim,hiddenDim,14001,.028), outputBias:new Array(inputDim).fill(0),
    actionWeights:matrix(actionCount,hiddenDim,15001,.035), actionBias:new Array(actionCount).fill(0),
    lastInput:new Array(inputDim).fill(0), lastPrediction:new Array(inputDim).fill(0), previousHidden:new Array(hiddenDim).fill(0),
    stepCount:0,learningSteps:0,predictionError01:.5,rollingPredictionError01:.5,actionError01:.5,actionSamples:0,parameterUpdates:0,lastTick:0,lastAt:0,
    qualityGate:{validated:false,minPredictionSamples:32,minActionSamples:24,brainPredictionError01:.5,baselinePredictionError01:.5,brainAdvantage01:0,reason:'insufficient-evidence'}
  };
}

/**
 * The central brain is a compact recurrent latent substrate, not a consciousness claim.
 * It is deliberately separated from language generation and all high-level heuristics.
 * It consumes cross-domain signals, maintains a temporal latent state and produces a
 * bounded broadcast vector plus action priors. Influence on behaviour is evidence-gated.
 */
export class CentralBrainSubstrate {
  private state=defaultState();

  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<CentralBrainState>|null){
    const d=defaultState(); const r=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const mat=(v:any,rows:number,cols:number)=>Array.isArray(v)?Array.from({length:rows},(_,i)=>Array.isArray(v[i])?arr(v[i],cols):new Array(cols).fill(0)):matrix(rows,cols,999);
    this.state={...d,...r,
      hidden:arr(r.hidden,d.hiddenDim), bias:arr(r.bias,d.hiddenDim),
      recurrentWeights:mat(r.recurrentWeights,d.hiddenDim,d.hiddenDim), inputWeights:mat(r.inputWeights,d.hiddenDim,d.inputDim),
      outputWeights:mat(r.outputWeights,d.inputDim,d.hiddenDim), outputBias:arr(r.outputBias,d.inputDim),
      actionWeights:mat(r.actionWeights,d.actionCount,d.hiddenDim), actionBias:arr(r.actionBias,d.actionCount),
      lastInput:arr(r.lastInput,d.inputDim), lastPrediction:arr(r.lastPrediction,d.inputDim), previousHidden:arr(r.previousHidden,d.hiddenDim),
      qualityGate:{...d.qualityGate,...(r.qualityGate??{})}
    };
  }

  private pack(input:CentralBrainInput):number[]{
    const groups=[input.perception,input.world,input.self,input.memory,input.attention,input.body,input.motivation,input.actionContext??[]];
    const out=new Array(this.state.inputDim).fill(0); let k=0;
    for(const g of groups) for(const x of g){ if(k>=out.length) break; out[k++]=clamp11(x); }
    return out;
  }
  private stepHidden(x:number[]):number[]{
    const prev=this.state.hidden, next=new Array(this.state.hiddenDim).fill(0);
    for(let j=0;j<next.length;j++){
      let z=this.state.bias[j]??0;
      const iw=this.state.inputWeights[j]??[], rw=this.state.recurrentWeights[j]??[];
      for(let i=0;i<this.state.inputDim;i++) z+=(iw[i]??0)*(x[i]??0);
      for(let i=0;i<this.state.hiddenDim;i++) z+=(rw[i]??0)*(prev[i]??0);
      next[j]=tanh(z);
    }
    return next;
  }
  private predict(hidden:number[]):number[]{
    return this.state.outputWeights.map((row,i)=>tanh((this.state.outputBias[i]??0)+row.reduce((s,v,j)=>s+(v??0)*(hidden[j]??0),0)));
  }

  observe(input:CentralBrainInput){
    const x=this.pack(input), previousHidden=this.state.hidden.slice(), previousInput=this.state.lastInput.slice();
    const next=this.stepHidden(x), pred=this.predict(next);
    let error=.5;
    if(this.state.stepCount>0){
      error=clamp01(previousInput.reduce((s,v,i)=>s+Math.abs(v-(this.state.lastPrediction[i]??0)),0)/(this.state.inputDim*2));
      this.state.predictionError01=clamp01(this.state.predictionError01*.97+error*.03);
      this.state.rollingPredictionError01=clamp01(this.state.rollingPredictionError01*.985+error*.015);
      this.learnPrediction(previousHidden,next,previousInput,x);
    }
    this.state.hidden=next; this.state.previousHidden=previousHidden; this.state.lastInput=x; this.state.lastPrediction=pred;
    this.state.stepCount++; this.state.learningSteps++; this.state.parameterUpdates++; this.state.lastTick=input.tick; this.state.lastAt=input.at;
    return {latent:next.slice(),broadcast:this.broadcast(),prediction:pred,error01:error,quality:this.quality()};
  }

  private learnPrediction(previousHidden:number[],nextHidden:number[],target:number[],input:number[]){
    const pred=this.predict(nextHidden), lr=.012/Math.sqrt(1+this.state.learningSteps/6000), gradH=new Array(this.state.hiddenDim).fill(0);
    for(let i=0;i<this.state.inputDim;i++){
      const e=target[i]-(pred[i]??0), d=e*(1-(pred[i]??0)**2); const row=this.state.outputWeights[i];
      for(let j=0;j<this.state.hiddenDim;j++){ gradH[j]+=(row[j]??0)*d; row[j]=clamp11((row[j]??0)+lr*d*(nextHidden[j]??0)); }
      this.state.outputBias[i]=clamp11((this.state.outputBias[i]??0)+lr*d);
    }
    for(let j=0;j<this.state.hiddenDim;j++){
      const dh=gradH[j]*(1-(nextHidden[j]??0)**2), iw=this.state.inputWeights[j], rw=this.state.recurrentWeights[j];
      for(let i=0;i<this.state.inputDim;i++) iw[i]=clamp11((iw[i]??0)+lr*dh*(input[i]??0));
      for(let i=0;i<this.state.hiddenDim;i++) rw[i]=clamp11((rw[i]??0)+lr*dh*(previousHidden[i]??0));
      this.state.bias[j]=clamp11((this.state.bias[j]??0)+lr*dh);
    }
  }

  broadcast():number[]{
    const out=new Array(this.state.broadcastDim).fill(0);
    for(let i=0;i<out.length;i++){ let sum=0; const stride=Math.max(1,Math.floor(this.state.hiddenDim/out.length)); for(let j=0;j<stride;j++) sum+=(this.state.hidden[i*stride+j]??0); out[i]=tanh(sum/stride); }
    return out;
  }
  globalState(){
    const b=this.broadcast();
    return {latent:this.state.hidden.slice(),broadcast:b,arousal01:clamp01(.5+b[0]*.25),stability01:clamp01(1-this.state.rollingPredictionError01),integration01:clamp01(Math.abs(b.reduce((s,v)=>s+v,0))/Math.max(1,b.length))};
  }
  predictAction(action:ActionKind){
    const idx=Math.max(0,ACTIONS.indexOf(action)), row=this.state.actionWeights[idx]??[];
    const reward01=clamp01(sigmoid((this.state.actionBias[idx]??0)+row.reduce((s,v,j)=>s+(v??0)*(this.state.hidden[j]??0),0)));
    const confidence01=clamp01((this.state.actionSamples/(this.state.actionSamples+64))*.72+(1-this.state.rollingPredictionError01)*.18);
    return {action,reward01,confidence01};
  }
  learnAction(action:ActionKind,reward01:number,baselineError01:number){
    const idx=Math.max(0,ACTIONS.indexOf(action)), row=this.state.actionWeights[idx], p=this.predictAction(action), err=clamp01(reward01)-p.reward01;
    const lr=.028/Math.sqrt(1+this.state.actionSamples/4000), d=err*p.reward01*(1-p.reward01);
    for(let j=0;j<this.state.hiddenDim;j++) row[j]=clamp11((row[j]??0)+lr*d*(this.state.hidden[j]??0));
    this.state.actionBias[idx]=clamp11((this.state.actionBias[idx]??0)+lr*d); this.state.actionSamples++; this.state.parameterUpdates++;
    this.state.actionError01=clamp01(this.state.actionError01*.95+Math.abs(err)*.05);
    const baseline=clamp01(Number.isFinite(baselineError01)?baselineError01:.5), advantage=baseline-this.state.actionError01;
    const validated=this.state.learningSteps>=32 && this.state.actionSamples>=24 && advantage>=.01;
    this.state.qualityGate={validated,minPredictionSamples:32,minActionSamples:24,brainPredictionError01:this.state.rollingPredictionError01,baselinePredictionError01:baseline,brainAdvantage01:Math.max(0,advantage),reason:validated?'evidence-gated-brain-advantage-shadow-safe':'shadow-only-until-advantage'};
    return {prediction01:p.reward01,error01:Math.abs(err),validated,advantage01:Math.max(0,advantage)};
  }
  actionBias(action:ActionKind){
    const p=this.predictAction(action); if(!this.state.qualityGate.validated || p.confidence01<.4) return 0;
    return (p.reward01-.5)*Math.min(.012,this.state.qualityGate.brainAdvantage01*.08);
  }
  quality(){return structuredClone(this.state.qualityGate);}
}
