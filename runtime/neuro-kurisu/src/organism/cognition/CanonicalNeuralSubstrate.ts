import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DEFAULT_DIM=24;
const MAX_HISTORY=256;
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const norm=(v:number[])=>{
  const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;
  return v.map(x=>clampSigned(x/n));
};
const dot=(a:number[],b:number[])=>a.reduce((s,x,i)=>s+x*(b[i]??0),0);
const seed=(label:string)=>{let h=2166136261;for(let i=0;i<label.length;i++){h^=label.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const rand=(key:string)=>{const h=seed(key);return (((h%2001)/1000)-1)*0.045;};

export interface CanonicalNeuralSubstrateState {
  version:1;
  dimension:number;
  cycles:number;
  learningUpdates:number;
  observations:number;
  outcomeUpdates:number;
  lastTick:number;
  hidden:number[];
  previousInput:number[];
  recurrentWeights:number[][];
  inputWeights:number[][];
  actionWeights:number[][];
  readoutWeights:number[][];
  valueWeights:number[];
  recurrentGain:number;
  learningRate:number;
  eligibilityDecay:number;
  lastAction:ActionKind|null;
  lastPrediction01:number;
  predictionErrorMean01:number;
  heldoutPredictionError01:number;
  trainPredictionError01:number;
  generalization01:number;
  lesionDrop01:number;
  plasticity01:number;
  lastInputNovelty01:number;
  history:Array<{tick:number;action:ActionKind|null;prediction01:number;target01:number;error01:number;reward01:number}>;
}

export interface CanonicalNeuralInput {
  vector:number[];
  tick:number;
  action?:ActionKind|null;
  reward01?:number;
  learningEnabled?:boolean;
}

export interface CanonicalNeuralStep {
  hidden:number[];
  prediction01:number;
  uncertainty01:number;
  novelty01:number;
  learningDelta01:number;
  action:ActionKind|null;
}

function defaultMatrix(rows:number,cols:number,factor:number,label:string){
  return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>rand(`${label}:${r}:${c}`)*factor));
}

export function defaultCanonicalNeuralSubstrate():CanonicalNeuralSubstrateState{
  const d=DEFAULT_DIM;
  return {
    version:1,dimension:d,cycles:0,learningUpdates:0,observations:0,outcomeUpdates:0,lastTick:0,
    hidden:new Array(d).fill(0),previousInput:new Array(d).fill(0),
    recurrentWeights:defaultMatrix(d,d,.8,'recurrent'),
    inputWeights:defaultMatrix(d,d,.7,'input'),
    actionWeights:defaultMatrix(ACTIONS.length,d,.18,'action'),
    readoutWeights:defaultMatrix(ACTIONS.length,d,.22,'readout'),
    valueWeights:Array.from({length:d},(_,i)=>rand(`value:${i}`)*.22),
    recurrentGain:.72,learningRate:.028,eligibilityDecay:.84,lastAction:null,
    lastPrediction01:.5,predictionErrorMean01:.5,heldoutPredictionError01:.5,trainPredictionError01:.5,
    generalization01:0,lesionDrop01:0,plasticity01:0,lastInputNovelty01:0,history:[],
  };
}

export class CanonicalNeuralSubstrate {
  private state=defaultCanonicalNeuralSubstrate();
  private lastEligibility:number[] = new Array(DEFAULT_DIM).fill(0);

  restore(raw?:Partial<CanonicalNeuralSubstrateState>|null){
    const d=defaultCanonicalNeuralSubstrate(); const r=raw??{}; const dim=Math.max(8,Math.min(48,Math.floor(Number(r.dimension??d.dimension))));
    const resize=(m:any[][]|undefined,rows:number,cols:number,label:string)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>clampSigned(Number(m?.[i]?.[j]??rand(`${label}:${i}:${j}`)))));
    this.state={...d,...r,dimension:dim,
      hidden:Array.from({length:dim},(_,i)=>clampSigned(Number(r.hidden?.[i]??0))),
      previousInput:Array.from({length:dim},(_,i)=>clampSigned(Number(r.previousInput?.[i]??0))),
      recurrentWeights:resize(r.recurrentWeights,dim,dim,'recurrent'),
      inputWeights:resize(r.inputWeights,dim,dim,'input'),
      actionWeights:resize(r.actionWeights,ACTIONS.length,dim,'action'),
      readoutWeights:resize(r.readoutWeights,ACTIONS.length,dim,'readout'),
      valueWeights:Array.from({length:dim},(_,i)=>clampSigned(Number(r.valueWeights?.[i]??rand(`value:${i}`)*.22))),
      history:Array.isArray(r.history)?r.history.slice(-MAX_HISTORY):[]
    };
    this.lastEligibility=Array.from({length:dim},(_,i)=>clampSigned(Number((r as any).lastEligibility?.[i]??0)));
  }

  snapshot(){return {...structuredClone(this.state),lastEligibility:[...this.lastEligibility]};}

  private encode(input:number[]){
    const d=this.state.dimension; const src=Array.from({length:d},(_,i)=>clampSigned(Number(input[i]??0)));
    return norm(src);
  }

  private actionIndex(action:ActionKind|null|undefined){
    if(!action)return -1; return Math.max(0,ACTIONS.indexOf(action));
  }

  step(input:CanonicalNeuralInput):CanonicalNeuralStep{
    const x=this.encode(input.vector); const d=this.state.dimension; const action=input.action??null; const ai=this.actionIndex(action);
    const next=new Array(d).fill(0);
    for(let i=0;i<d;i++){
      const recurrent=dot(this.state.recurrentWeights[i],this.state.hidden)*this.state.recurrentGain;
      const sensory=dot(this.state.inputWeights[i],x);
      const actionDrive=ai>=0?this.state.actionWeights[ai][i]:0;
      next[i]=tanh(recurrent+sensory+actionDrive);
    }
    const w=ai>=0?this.state.readoutWeights[ai]:this.state.valueWeights;
    const prediction01=sigmoid(dot(w,next));
    const novelty=clamp01(Math.sqrt(x.reduce((s,v,i)=>s+(v-(this.state.previousInput[i]??0))**2,0)/d));
    const uncertainty=clamp01(.08+Math.abs(prediction01-.5)*.62+(1-this.state.plasticity01)*.18);
    let learningDelta=0;
    this.state.hidden=next; this.state.previousInput=x; this.state.lastAction=action; this.state.lastPrediction01=prediction01;
    this.state.lastInputNovelty01=novelty; this.state.cycles++; this.state.observations++; this.state.lastTick=input.tick;
    for(let i=0;i<d;i++) this.lastEligibility[i]=this.lastEligibility[i]*this.state.eligibilityDecay+Math.abs(next[i])*(.18+.42*novelty);
    if(input.reward01!=null && input.learningEnabled!==false){learningDelta=this.learnFromOutcome({reward01:input.reward01,action,tick:input.tick});}
    return {hidden:[...next],prediction01,uncertainty01:uncertainty,novelty01:novelty,learningDelta01:learningDelta,action};
  }

  bindAction(action:ActionKind,tick:number){this.state.lastAction=action;this.state.lastTick=tick;return this.actionIndex(action)>=0;}
  activity(){ return [...this.state.hidden]; }

  applyReplayCredit(input:{activity:number[];action:ActionKind|null;tdError01:number;weight01:number;delay:number}){
    const ai=this.actionIndex(input.action); const d=this.state.dimension; const act=Array.from({length:d},(_,i)=>clampSigned(Number(input.activity[i]??0)));
    const td=(input.tdError01>=0?1:-1)*clamp01(input.tdError01);
    const weight=clamp01(input.weight01)*(.35+.65/(1+Math.sqrt(Math.max(0,input.delay)/64)));
    const lr=this.state.learningRate*.55*weight;
    if(ai>=0){ const ro=this.state.readoutWeights[ai]; for(let i=0;i<d;i++) ro[i]=clampSigned(ro[i]+lr*td*act[i]); }
    for(let i=0;i<d;i++){ this.state.valueWeights[i]=clampSigned(this.state.valueWeights[i]+lr*.18*td*act[i]); this.lastEligibility[i]=clampSigned(this.lastEligibility[i]*.92+Math.abs(act[i])*weight*.08); }
    this.state.learningUpdates++; this.state.outcomeUpdates++;
    this.state.predictionErrorMean01=this.state.predictionErrorMean01*.96+Math.abs(td)*.04;
    this.state.plasticity01=clamp01(this.state.plasticity01*.96+Math.min(1,Math.abs(td)*2)*.04);
    return clamp01(weight*Math.abs(td));
  }

  learnFromOutcome(input:{reward01:number;action:ActionKind|null;tick:number;holdout?:boolean}){
    const target=clamp01(input.reward01); const ai=this.actionIndex(input.action); const current=this.state.lastPrediction01; const error=target-current;
    const absErr=Math.abs(error); const lr=this.state.learningRate/(1+Math.sqrt(this.state.learningUpdates/400)); const scale=lr*(.35+.65*Math.min(1,Math.abs(error)*1.8)); const d=this.state.dimension;
    const sign=error>=0?1:-1;
    if(ai>=0){
      const ro=this.state.readoutWeights[ai]; for(let i=0;i<d;i++)ro[i]=clampSigned(ro[i]+scale*error*this.state.hidden[i]);
      const aw=this.state.actionWeights[ai]; for(let i=0;i<d;i++)aw[i]=clampSigned(aw[i]+scale*.22*error*this.lastEligibility[i]);
    } else {
      for(let i=0;i<d;i++)this.state.valueWeights[i]=clampSigned(this.state.valueWeights[i]+scale*.28*error*this.state.hidden[i]);
    }
    for(let i=0;i<d;i++){
      const eligibility=this.lastEligibility[i];
      for(let j=0;j<d;j++){
        const e=error*this.state.hidden[i]*this.state.previousInput[j]*.018*eligibility;
        this.state.recurrentWeights[i][j]=clampSigned(this.state.recurrentWeights[i][j]+e*sign);
      }
    }
    this.state.learningUpdates++; this.state.outcomeUpdates++;
    this.state.trainPredictionError01=this.state.trainPredictionError01*.97+absErr*.03;
    this.state.predictionErrorMean01=this.state.predictionErrorMean01*.97+absErr*.03;
    this.state.plasticity01=clamp01(this.state.plasticity01*.97+Math.min(1,Math.abs(error)*2)*.03);
    if(input.holdout){this.state.heldoutPredictionError01=this.state.heldoutPredictionError01*.92+absErr*.08;} else {
      this.state.history=[...this.state.history.slice(-(MAX_HISTORY-1)),{tick:input.tick,action:input.action,prediction01:current,target01:target,error01:absErr,reward01:target}];
    }
    return clamp01(Math.abs(error)*(.55+.45*Math.min(1,this.learningUpdatesToScale())));
  }

  private learningUpdatesToScale(){return Math.min(1,this.state.learningUpdates/100);}

  holdout(samples:Array<{vector:number[];action:ActionKind;reward01:number;tick?:number}>){
    if(!samples.length)return {before01:this.state.heldoutPredictionError01,after01:this.state.heldoutPredictionError01,delta01:0,samples:0};
    const snapshot=this.snapshot(); let sum=0;
    for(const s of samples){const p=this.step({vector:s.vector,tick:s.tick??this.state.lastTick,action:s.action,learningEnabled:false}).prediction01;sum+=Math.abs(s.reward01-p);}
    const after=sum/samples.length; const before=this.state.heldoutPredictionError01; this.state.heldoutPredictionError01=clamp01(after); this.state.generalization01=clamp01(1-after); this.restore(snapshot); this.state.heldoutPredictionError01=clamp01(after);this.state.generalization01=clamp01(1-after);
    return {before01:before,after01:after,delta01:before-after,samples:samples.length};
  }

  lesion(){
    const d=this.state.dimension; const ai=this.actionIndex(this.state.lastAction);
    const saved=this.state.recurrentWeights.map(r=>r.slice());
    const forward=(recurrent:number[][])=>{
      const next=new Array(d).fill(0);
      for(let i=0;i<d;i++){
        const recurrentDrive=dot(recurrent[i],this.state.hidden)*this.state.recurrentGain;
        const sensoryDrive=dot(this.state.inputWeights[i],this.state.previousInput);
        const actionDrive=ai>=0?this.state.actionWeights[ai][i]:0;
        next[i]=tanh(recurrentDrive+sensoryDrive+actionDrive);
      }
      const w=ai>=0?this.state.readoutWeights[ai]:this.state.valueWeights;
      return sigmoid(dot(w,next));
    };
    const baselinePrediction=forward(saved);
    const zero=saved.map(r=>r.map(()=>0));
    const lesionedPrediction=forward(zero);
    const baselineEnergy=saved.flat().reduce((sum,x)=>sum+x*x,0)/Math.max(1,d*d);
    const drop=Math.abs(baselinePrediction-lesionedPrediction);
    this.state.lesionDrop01=clamp01(drop*2.4);
    return {baselineWeightMagnitude01:clamp01(Math.sqrt(baselineEnergy)*4),baselinePrediction01:baselinePrediction,lesionedPrediction01:lesionedPrediction,lesionedError01:Math.abs(.5-lesionedPrediction),baselineError01:Math.abs(.5-baselinePrediction),drop01:this.state.lesionDrop01};
  }

  diagnostics(){
    const weightEnergy=this.state.recurrentWeights.flat().reduce((s,x)=>s+x*x,0)/(this.state.dimension**2);
    return {version:1,dimension:this.state.dimension,cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,observations:this.state.observations,outcomeUpdates:this.state.outcomeUpdates,lastPrediction01:this.state.lastPrediction01,predictionErrorMean01:this.state.predictionErrorMean01,trainPredictionError01:this.state.trainPredictionError01,heldoutPredictionError01:this.state.heldoutPredictionError01,generalization01:this.state.generalization01,lesionDrop01:this.state.lesionDrop01,plasticity01:this.state.plasticity01,recurrentWeightEnergy01:clamp01(weightEnergy*5),lastInputNovelty01:this.state.lastInputNovelty01,historyLength:this.state.history.length};
  }
}
