import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);

export interface BrainSubstrateState {
  version:1;
  inputDim:number;
  hiddenDim:number;
  actionCount:number;
  hidden:number[];
  inputWeights:number[][];
  recurrentWeights:number[][];
  hiddenBias:number[];
  predictionWeights:number[][];
  predictionBias:number[];
  actionRewardWeights:number[][];
  actionRewardBias:number[];
  stepCount:number;
  passiveSamples:number;
  actionSamples:number;
  parameterUpdates:number;
  predictionError01:number;
  actionError01:number;
  rollingPredictionError01:number;
  rollingActionError01:number;
  previousPrediction:number[]|null;
  previousAction:ActionKind|null;
  previousHidden:number[]|null;
  lastTick:number;
  lastAt:number;
  qualityGate:{minSamples:number;validated:boolean;brainError01:number;baselineError01:number;advantage01:number;reason:string};
}

function deterministicWeight(seed:number, scale=.08):number{
  let x=(seed|0)^0x9e3779b9;
  x=Math.imul(x^(x>>>16),0x21f0aaad);
  x=Math.imul(x^(x>>>15),0x735a2d97);
  x^=x>>>15;
  return (((x>>>0)/4294967295)*2-1)*scale;
}

function matrix(rows:number,cols:number,seed:number,scale=.08){
  return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>deterministicWeight(seed+r*131+c*17,scale)));
}

export function defaultBrainSubstrate():BrainSubstrateState{
  const inputDim=16;
  const hiddenDim=24;
  const actionCount=ACTIONS.length;
  return {
    version:1,inputDim,hiddenDim,actionCount,
    hidden:new Array(hiddenDim).fill(0),
    inputWeights:matrix(hiddenDim,inputDim,1101,.065),
    recurrentWeights:matrix(hiddenDim,hiddenDim,2201,.045),
    hiddenBias:new Array(hiddenDim).fill(0),
    predictionWeights:matrix(inputDim,hiddenDim,3301,.055),
    predictionBias:new Array(inputDim).fill(0),
    actionRewardWeights:matrix(actionCount,hiddenDim,4401,.065),
    actionRewardBias:new Array(actionCount).fill(0),
    stepCount:0,passiveSamples:0,actionSamples:0,parameterUpdates:0,
    predictionError01:.5,actionError01:.5,rollingPredictionError01:.5,rollingActionError01:.5,
    previousPrediction:null,previousAction:null,previousHidden:null,lastTick:0,lastAt:0,
    qualityGate:{minSamples:16,validated:false,brainError01:.5,baselineError01:.5,advantage01:0,reason:'insufficient-evidence'},
  };
}

export class BrainSubstrate {
  private state=defaultBrainSubstrate();

  snapshot(){return structuredClone(this.state);}

  restore(raw?:Partial<BrainSubstrateState>|null){
    const d=defaultBrainSubstrate();
    const r=raw??{};
    this.state={
      ...d,...r,
      hidden:Array.isArray(r.hidden)?r.hidden.slice(0,d.hiddenDim):d.hidden,
      inputWeights:Array.isArray(r.inputWeights)?r.inputWeights.slice(0,d.hiddenDim).map((row:any)=>Array.isArray(row)?row.slice(0,d.inputDim):new Array(d.inputDim).fill(0)):d.inputWeights,
      recurrentWeights:Array.isArray(r.recurrentWeights)?r.recurrentWeights.slice(0,d.hiddenDim).map((row:any)=>Array.isArray(row)?row.slice(0,d.hiddenDim):new Array(d.hiddenDim).fill(0)):d.recurrentWeights,
      hiddenBias:Array.isArray(r.hiddenBias)?r.hiddenBias.slice(0,d.hiddenDim):d.hiddenBias,
      predictionWeights:Array.isArray(r.predictionWeights)?r.predictionWeights.slice(0,d.inputDim).map((row:any)=>Array.isArray(row)?row.slice(0,d.hiddenDim):new Array(d.hiddenDim).fill(0)):d.predictionWeights,
      predictionBias:Array.isArray(r.predictionBias)?r.predictionBias.slice(0,d.inputDim):d.predictionBias,
      actionRewardWeights:Array.isArray(r.actionRewardWeights)?r.actionRewardWeights.slice(0,d.actionCount).map((row:any)=>Array.isArray(row)?row.slice(0,d.hiddenDim):new Array(d.hiddenDim).fill(0)):d.actionRewardWeights,
      actionRewardBias:Array.isArray(r.actionRewardBias)?r.actionRewardBias.slice(0,d.actionCount):d.actionRewardBias,
      previousPrediction:Array.isArray(r.previousPrediction)?r.previousPrediction.slice(0,d.inputDim):null,
      previousHidden:Array.isArray(r.previousHidden)?r.previousHidden.slice(0,d.hiddenDim):null,
      qualityGate:{...d.qualityGate,...(r.qualityGate??{})},
    };
  }

  private normalize(vector:number[]):number[]{
    const out=new Array(this.state.inputDim).fill(0);
    for(let i=0;i<out.length;i++) out[i]=clamp11(vector[i]??0);
    return out;
  }

  private hiddenStep(input:number[]):number[]{
    const prev=this.state.hidden;
    const next=new Array(this.state.hiddenDim).fill(0);
    for(let j=0;j<next.length;j++){
      let z=this.state.hiddenBias[j]??0;
      const iw=this.state.inputWeights[j]??[];
      const rw=this.state.recurrentWeights[j]??[];
      for(let i=0;i<this.state.inputDim;i++) z+=(iw[i]??0)*(input[i]??0);
      for(let i=0;i<this.state.hiddenDim;i++) z+=(rw[i]??0)*(prev[i]??0);
      next[j]=tanh(z);
    }
    return next;
  }

  private predictFromHidden(hidden:number[]):number[]{
    return this.state.predictionWeights.map((row,i)=>tanh((this.state.predictionBias[i]??0)+row.reduce((s,w,j)=>s+(w??0)*(hidden[j]??0),0)));
  }

  /** Advance the recurrent state from an observation. This is the actual temporal substrate; no text generation is involved. */
  observe(vector:number[], tick=0, at=0){
    const x=this.normalize(vector);
    const oldHidden=this.state.hidden.slice();
    const nextHidden=this.hiddenStep(x);
    const prediction=this.predictFromHidden(nextHidden);

    let error=.5;
    if(this.state.previousPrediction && this.state.stepCount>0){
      const prev=this.state.previousPrediction;
      error=clamp01(prev.reduce((s,v,i)=>s+Math.abs(v-(oldHidden[i]??0)),0)/(this.state.inputDim*2));
      this.state.predictionError01=clamp01(this.state.predictionError01*.97+error*.03);
      this.state.rollingPredictionError01=clamp01(this.state.rollingPredictionError01*.96+error*.04);
      this.learnTemporal(oldHidden,nextHidden,x,x);
    }

    this.state.previousPrediction=prediction;
    this.state.previousHidden=oldHidden;
    this.state.hidden=nextHidden;
    this.state.stepCount++;
    this.state.passiveSamples++;
    this.state.parameterUpdates++;
    this.state.lastTick=tick;
    this.state.lastAt=at;
    return {latent:nextHidden,prediction,error01:error,confidence01:clamp01((this.state.passiveSamples/(this.state.passiveSamples+64))*.72+this.state.rollingPredictionError01*.08)};
  }

  private learnTemporal(oldHidden:number[],nextHidden:number[],input:number[],target:number[]){
    const lr=.025/Math.sqrt(1+this.state.parameterUpdates/4000);
    const pred=this.predictFromHidden(nextHidden);
    const gradH=new Array(this.state.hiddenDim).fill(0);
    for(let i=0;i<this.state.inputDim;i++){
      const e=target[i]-pred[i];
      const d=e*(1-pred[i]*pred[i]);
      const row=this.state.predictionWeights[i];
      for(let j=0;j<this.state.hiddenDim;j++){
        gradH[j]+=(row[j]??0)*d;
        row[j]=clamp11((row[j]??0)+lr*d*(nextHidden[j]??0));
      }
      this.state.predictionBias[i]=clamp11((this.state.predictionBias[i]??0)+lr*d);
    }
    for(let j=0;j<this.state.hiddenDim;j++){
      const dh=gradH[j]*(1-(nextHidden[j]??0)**2);
      const iw=this.state.inputWeights[j];
      const rw=this.state.recurrentWeights[j];
      for(let i=0;i<this.state.inputDim;i++) iw[i]=clamp11((iw[i]??0)+lr*dh*(input[i]??0));
      for(let i=0;i<this.state.hiddenDim;i++) rw[i]=clamp11((rw[i]??0)+lr*dh*(oldHidden[i]??0));
      this.state.hiddenBias[j]=clamp11((this.state.hiddenBias[j]??0)+lr*dh);
    }
  }

  predictAction(action:ActionKind){
    const idx=Math.max(0,ACTIONS.indexOf(action));
    const row=this.state.actionRewardWeights[idx]??[];
    const z=(this.state.actionRewardBias[idx]??0)+row.reduce((s,w,j)=>s+(w??0)*(this.state.hidden[j]??0),0);
    const reward01=clamp01(sigmoid(z));
    const confidence01=clamp01((this.state.actionSamples/(this.state.actionSamples+48))*.82);
    return {reward01,confidence01,hidden:this.state.hidden.slice(),action};
  }

  learnAction(action:ActionKind,reward01:number,baselineError01:number){
    const idx=Math.max(0,ACTIONS.indexOf(action));
    const row=this.state.actionRewardWeights[idx];
    const pred=this.predictAction(action);
    const err=clamp01(reward01)-pred.reward01;
    const lr=.045/Math.sqrt(1+this.state.actionSamples/3000);
    const d=err*pred.reward01*(1-pred.reward01);
    for(let j=0;j<this.state.hiddenDim;j++) row[j]=clamp11((row[j]??0)+lr*d*(this.state.hidden[j]??0));
    this.state.actionRewardBias[idx]=clamp11((this.state.actionRewardBias[idx]??0)+lr*d);
    this.state.actionSamples++;
    this.state.parameterUpdates++;
    this.state.actionError01=clamp01(this.state.actionError01*.94+Math.abs(err)*.06);
    this.state.rollingActionError01=clamp01(this.state.rollingActionError01*.92+Math.abs(err)*.08);
    const comparable=Number.isFinite(baselineError01)?clamp01(baselineError01):.5;
    const advantage=comparable-this.state.rollingActionError01;
    const validated=this.state.actionSamples>=16 && advantage>=.01;
    this.state.qualityGate={
      minSamples:16,validated,
      brainError01:this.state.rollingActionError01,
      baselineError01:comparable,
      advantage01:Math.max(0,advantage),
      reason:validated?'brain-outperforms-baseline':'insufficient-or-not-better-than-baseline',
    };
    return {prediction01:pred.reward01,error01:Math.abs(err),validated,advantage01:Math.max(0,advantage)};
  }

  actionBias(action:ActionKind){
    const p=this.predictAction(action);
    if(!this.state.qualityGate.validated || p.confidence01<.35) return 0;
    return (p.reward01-.5)*Math.min(.018,this.state.qualityGate.advantage01*.12);
  }

  quality(){return structuredClone(this.state.qualityGate);}
}
