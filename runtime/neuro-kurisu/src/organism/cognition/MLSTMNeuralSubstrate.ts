/**
 * Lightweight CPU/Termux mLSTM substrate adapted from the published mLSTM recurrence.
 *
 * This is an original TypeScript implementation of the recurrence used by NX-AI's
 * mlstm_kernels project. It intentionally does not vendor Triton/PyTorch kernels.
 * The purpose here is a portable stateful neural substrate for research/ablation;
 * accelerated kernels remain an external backend concern.
 */

const clamp = (x:number,a=-8,b=8) => Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
const clamp01 = (x:number) => Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const sigmoid = (x:number) => 1/(1+Math.exp(-clamp(x)));
const tanh = (x:number) => Math.tanh(clamp(x));
const mean = (v:number[]) => v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0;
const norm = (v:number[]) => Math.sqrt(v.reduce((s,x)=>s+x*x,0)) || 1;
const dot = (a:number[],b:number[]) => a.reduce((s,x,i)=>s+x*(b[i]??0),0);
const stableHash = (s:string) => { let h=2166136261; for(const c of s){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; };
const seeded = (label:string) => ((stableHash(label)%2001)/1000-1)*0.14;

export interface MLSTMNeuralSubstrateState {
  version:1;
  dimension:number;
  cycles:number;
  lastTick:number;
  cell:number[][];
  normalizer:number[];
  maxState:number;
  hidden:number[];
  qWeights:number[][];
  kWeights:number[][];
  vWeights:number[][];
  inputGateWeights:number[];
  forgetGateWeights:number[];
  inputGateBias:number;
  forgetGateBias:number;
  lastPrediction01:number;
  lastNovelty01:number;
  meanAbsState01:number;
}

export interface MLSTMStepInput {
  vector:number[];
  tick:number;
  learningEnabled?:boolean;
}

export interface MLSTMStepResult {
  hidden:number[];
  prediction01:number;
  novelty01:number;
  stateEnergy01:number;
  inputGate01:number;
  forgetGate01:number;
}

function matrix(d:number,label:string,scale:number){
  return Array.from({length:d},(_,r)=>Array.from({length:d},(_,c)=>seeded(`${label}:${r}:${c}`)*scale));
}

export function defaultMLSTMNeuralSubstrate(dimension=16):MLSTMNeuralSubstrateState{
  const d=Math.max(4,Math.min(32,Math.floor(dimension)));
  return {
    version:1,dimension:d,cycles:0,lastTick:0,
    cell:Array.from({length:d},()=>new Array(d).fill(0)),
    normalizer:new Array(d).fill(0),maxState:0,
    hidden:new Array(d).fill(0),
    qWeights:matrix(d,'q',0.8),kWeights:matrix(d,'k',0.8),vWeights:matrix(d,'v',0.8),
    inputGateWeights:Array.from({length:d},(_,i)=>seeded(`ig:${i}`)*0.42),
    forgetGateWeights:Array.from({length:d},(_,i)=>seeded(`fg:${i}`)*0.38),
    inputGateBias:-0.4,forgetGateBias:1.35,
    lastPrediction01:0.5,lastNovelty01:0,meanAbsState01:0,
  };
}

export class MLSTMNeuralSubstrate {
  private state:MLSTMNeuralSubstrateState;
  private previousInput:number[];

  constructor(dimension=16){
    this.state=defaultMLSTMNeuralSubstrate(dimension);
    this.previousInput=new Array(this.state.dimension).fill(0);
  }

  restore(raw?:Partial<MLSTMNeuralSubstrateState>|null){
    const base=defaultMLSTMNeuralSubstrate(Number(raw?.dimension??this.state.dimension));
    const r=raw??{};
    const d=base.dimension;
    const resizeMatrix=(m:any[][]|undefined,label:string,scale:number)=>Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>clamp(Number(m?.[i]?.[j]??base[label as 'qWeights'][i]?.[j]??seeded(`${label}:${i}:${j}`)*scale),-1,1)));
    this.state={
      ...base,
      ...r,
      dimension:d,
      cycles:Math.max(0,Math.floor(Number(r.cycles??0))),
      lastTick:Math.max(0,Math.floor(Number(r.lastTick??0))),
      cell:Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>clamp(Number(r.cell?.[i]?.[j]??0),-4,4))),
      normalizer:Array.from({length:d},(_,i)=>clamp(Number(r.normalizer?.[i]??0),-4,4)),
      maxState:clamp(Number(r.maxState??0),-32,32),
      hidden:Array.from({length:d},(_,i)=>clamp(Number(r.hidden?.[i]??0),-4,4)),
      qWeights:resizeMatrix(r.qWeights,'qWeights',0.8),
      kWeights:resizeMatrix(r.kWeights,'kWeights',0.8),
      vWeights:resizeMatrix(r.vWeights,'vWeights',0.8),
      inputGateWeights:Array.from({length:d},(_,i)=>clamp(Number(r.inputGateWeights?.[i]??base.inputGateWeights[i]),-1,1)),
      forgetGateWeights:Array.from({length:d},(_,i)=>clamp(Number(r.forgetGateWeights?.[i]??base.forgetGateWeights[i]),-1,1)),
      inputGateBias:clamp(Number(r.inputGateBias??base.inputGateBias),-4,4),
      forgetGateBias:clamp(Number(r.forgetGateBias??base.forgetGateBias),-4,4),
      lastPrediction01:clamp01(Number(r.lastPrediction01??.5)),
      lastNovelty01:clamp01(Number(r.lastNovelty01??0)),
      meanAbsState01:clamp01(Number(r.meanAbsState01??0)),
    };
    this.previousInput=Array.from({length:d},(_,i)=>clamp(Number((raw as any)?.previousInput?.[i]??0),-1,1));
  }

  snapshot(){ return {...structuredClone(this.state),previousInput:[...this.previousInput]}; }

  reset(){
    const d=this.state.dimension;
    this.state.cell=Array.from({length:d},()=>new Array(d).fill(0));
    this.state.normalizer=new Array(d).fill(0);
    this.state.maxState=0;
    this.state.hidden.fill(0);
    this.previousInput.fill(0);
  }

  private project(weights:number[][],x:number[]){
    return weights.map(row=>tanh(dot(row,x)));
  }

  /**
   * One recurrent mLSTM step following the NX-AI state equations:
   * log-sigmoid forget gate -> stabilized max state -> matrix cell update -> normalized readout.
   */
  step(input:MLSTMStepInput):MLSTMStepResult{
    const d=this.state.dimension;
    const x=Array.from({length:d},(_,i)=>clamp(Number(input.vector[i]??0),-1,1));
    const xNorm=norm(x);
    const xn=x.map(v=>v/xNorm);
    const q=this.project(this.state.qWeights,xn);
    const k=this.project(this.state.kWeights,xn);
    const v=this.project(this.state.vWeights,xn);
    const qScale=Math.pow(d,-0.5);
    const qScaled=q.map(z=>z*qScale);

    const iPre=this.state.inputGateBias+dot(this.state.inputGateWeights,xn);
    const fPre=this.state.forgetGateBias+dot(this.state.forgetGateWeights,xn);
    const fLog=-Math.log1p(Math.exp(-clamp(fPre)));
    const mNew=Math.max(fLog+this.state.maxState,iPre);
    const fAct=Math.exp(fLog+this.state.maxState-mNew);
    const iAct=Math.exp(iPre-mNew);

    const nextCell=Array.from({length:d},(_,r)=>Array.from({length:d},(_,c)=>
      fAct*(this.state.cell[r]?.[c]??0)+iAct*(k[r]??0)*(v[c]??0)
    ));
    const nextN=Array.from({length:d},(_,r)=>fAct*(this.state.normalizer[r]??0)+iAct*(k[r]??0));
    const numerator=nextCell.map(row=>dot(qScaled,row));
    const qn=Math.abs(dot(qScaled,nextN));
    const denom=Math.max(qn,Math.exp(-mNew))+1e-6;
    const hidden=numerator.map(h=>clamp(h/denom,-4,4));
    const prediction01=sigmoid(mean(hidden)*2.2);
    const novelty=clamp01(Math.sqrt(xn.reduce((s,val,i)=>s+(val-(this.previousInput[i]??0))**2,0)/d));
    const stateEnergy=clamp01(Math.sqrt(nextCell.flat().reduce((s,z)=>s+z*z,0)/(d*d))/2);

    this.state.cell=nextCell;
    this.state.normalizer=nextN;
    this.state.maxState=clamp(mNew,-32,32);
    this.state.hidden=hidden;
    this.state.lastPrediction01=prediction01;
    this.state.lastNovelty01=novelty;
    this.state.meanAbsState01=clamp01(this.state.meanAbsState01*.98+stateEnergy*.02);
    this.state.cycles++;
    this.state.lastTick=Math.max(0,Math.floor(input.tick));
    this.previousInput=xn;

    return {hidden:[...hidden],prediction01,novelty01:novelty,stateEnergy01:stateEnergy,inputGate01:clamp01(sigmoid(iPre)),forgetGate01:clamp01(sigmoid(fPre))};
  }

  activity(){ return [...this.state.hidden]; }

  diagnostics(){
    return {
      version:1,
      dimension:this.state.dimension,
      cycles:this.state.cycles,
      lastTick:this.state.lastTick,
      prediction01:this.state.lastPrediction01,
      novelty01:this.state.lastNovelty01,
      meanAbsState01:this.state.meanAbsState01,
      stateMatrixElements:this.state.dimension*this.state.dimension,
      portable:true,
      accelerator:'external',
    };
  }
}
