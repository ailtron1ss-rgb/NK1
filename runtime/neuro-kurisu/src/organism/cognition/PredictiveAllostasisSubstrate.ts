const clamp01 = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x:number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const tanh = (x:number) => Math.tanh(Number.isFinite(x) ? x : 0);
const sigmoid = (x:number) => 1 / (1 + Math.exp(-Math.max(-8, Math.min(8, x))));

export interface PredictiveAllostasisInput {
  tick:number; at:number;
  energy01:number; thermal01:number; capacity01:number; load01:number; awake:boolean;
  uncertainty01:number; predictionError01:number; novelty01:number;
  pressure01:number; recoveryDebt01:number; mode:'recover'|'protect'|'balance'|'engage'|'explore';
}

export interface PredictiveAllostasisState {
  version:1; inputDim:10; hiddenDim:24; hidden:number[];
  inputWeights:number[][]; recurrentWeights:number[][]; outputWeights:number[][]; outputBias:number[];
  lastInput:number[]; lastPrediction:number[]; stepCount:number; learningSteps:number;
  predictionError01:number; fastError01:number; slowError01:number; overload01:number;
  readiness01:number; interventionUrgency01:number; predictedEnergy01:number; predictedCapacity01:number;
  lastTick:number; lastAt:number; stableCycles:number; qualityGate:{validated:boolean; samples:number; baselineError01:number; modelError01:number};
}

function seedWeight(seed:number, scale=.035){
  let x=(seed|0)^0x9e3779b9; x=Math.imul(x^(x>>>16),0x21f0aaad); x=Math.imul(x^(x>>>15),0x735a2d97); x^=x>>>15;
  return (((x>>>0)/4294967295)*2-1)*scale;
}
function matrix(rows:number, cols:number, seed:number, scale=.035){
  return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>seedWeight(seed+r*131+c*17,scale)));
}
function vector(v:unknown,n:number,fill=0){
  const out=new Array(n).fill(fill);
  if(!Array.isArray(v)) return out;
  for(let i=0;i<Math.min(n,v.length);i++) out[i]=clamp11(Number(v[i]));
  return out;
}
function defaultState():PredictiveAllostasisState{
  const inputDim=10, hiddenDim=24, outputDim=5;
  return {version:1,inputDim,hiddenDim,hidden:new Array(hiddenDim).fill(0),
    inputWeights:matrix(hiddenDim,inputDim,31001),recurrentWeights:matrix(hiddenDim,hiddenDim,32001),outputWeights:matrix(outputDim,hiddenDim,33001),outputBias:new Array(outputDim).fill(0),
    lastInput:new Array(inputDim).fill(0),lastPrediction:new Array(outputDim).fill(.5),stepCount:0,learningSteps:0,predictionError01:.5,fastError01:.5,slowError01:.5,overload01:.25,readiness01:.5,interventionUrgency01:.25,predictedEnergy01:.68,predictedCapacity01:.72,lastTick:0,lastAt:0,stableCycles:0,qualityGate:{validated:false,samples:0,baselineError01:.5,modelError01:.5}};
}

export class PredictiveAllostasisSubstrate {
  private state=defaultState();
  snapshot(){ return structuredClone(this.state); }
  restore(raw?:Partial<PredictiveAllostasisState>|null){
    const d=defaultState(),r=raw??{};
    const arr=(v:unknown,n:number,fill=0)=>vector(v,n,fill);
    const mat=(v:unknown,rows:number,cols:number,seed:number)=>Array.isArray(v)
      ? Array.from({length:rows},(_,i)=>arr((v as unknown[])[i],cols))
      : matrix(rows,cols,seed);
    this.state={...d,...r,hidden:arr(r.hidden,d.hiddenDim),inputWeights:mat(r.inputWeights,d.hiddenDim,d.inputDim,31001),recurrentWeights:mat(r.recurrentWeights,d.hiddenDim,d.hiddenDim,32001),outputWeights:mat(r.outputWeights,5,d.hiddenDim,33001),outputBias:arr(r.outputBias,5),lastInput:arr(r.lastInput,d.inputDim),lastPrediction:arr(r.lastPrediction,5,.5),qualityGate:{...d.qualityGate,...(r.qualityGate??{})}};
  }
  private pack(i:PredictiveAllostasisInput){
    return [i.energy01,i.thermal01,i.capacity01,i.load01,i.awake?1:0,i.uncertainty01,i.predictionError01,i.novelty01,i.pressure01,i.recoveryDebt01].map(clamp11);
  }
  private hiddenStep(x:number[]){
    const prev=this.state.hidden,next=new Array(this.state.hiddenDim).fill(0);
    for(let j=0;j<next.length;j++){
      let z=0;
      const wi=this.state.inputWeights[j]??[];
      const wr=this.state.recurrentWeights[j]??[];
      for(let k=0;k<this.state.inputDim;k++) z+=(wi[k]??0)*(x[k]??0);
      for(let k=0;k<this.state.hiddenDim;k++) z+=(wr[k]??0)*(prev[k]??0);
      next[j]=tanh(z);
    }
    return next;
  }
  private outputs(h:number[],base:number[]){
    return this.state.outputWeights.map((row,i)=>{
      const z=(this.state.outputBias[i]??0)+row.reduce((s,v,j)=>s+v*(h[j]??0),0);
      return clamp01((base[i]??.5)+.35*tanh(z));
    });
  }
  private targetFromInput(i:PredictiveAllostasisInput){
    return [clamp01(i.energy01),clamp01(i.capacity01),clamp01(1-i.thermal01),clamp01(1-i.load01),clamp01(i.awake?1:0)];
  }
  private learn(prevH:number[],base:number[],desired:number[]){
    const pred=this.outputs(prevH,base), lr=.012/Math.sqrt(1+this.state.learningSteps/4000), gradH=new Array(this.state.hiddenDim).fill(0);
    for(let i=0;i<desired.length;i++){
      const p=pred[i]??.5,e=desired[i]-p,z=(this.state.outputBias[i]??0)+(this.state.outputWeights[i]??[]).reduce((s,v,j)=>s+v*(prevH[j]??0),0),d=e*.35*(1-tanh(z)**2),row=this.state.outputWeights[i]??[];
      for(let j=0;j<this.state.hiddenDim;j++){ gradH[j]+=(row[j]??0)*d; row[j]=clamp11((row[j]??0)+lr*d*(prevH[j]??0)); }
      this.state.outputBias[i]=clamp11((this.state.outputBias[i]??0)+lr*d);
    }
    for(let j=0;j<this.state.hiddenDim;j++){
      const dh=gradH[j]*(1-(prevH[j]??0)**2), wi=this.state.inputWeights[j]??[], wr=this.state.recurrentWeights[j]??[];
      for(let k=0;k<this.state.inputDim;k++) wi[k]=clamp11((wi[k]??0)+lr*dh*(this.state.lastInput[k]??0));
      for(let k=0;k<this.state.hiddenDim;k++) wr[k]=clamp11((wr[k]??0)+lr*dh*(prevH[k]??0));
    }
  }
  observe(i:PredictiveAllostasisInput){
    const x=this.pack(i), prevH=this.state.hidden.slice(), h=this.hiddenStep(x);
    const desired=this.targetFromInput(i);
    const previousPrediction=this.state.lastPrediction.slice();
    const currentErr=this.state.stepCount>0
      ? previousPrediction.reduce((s,v,k)=>s+Math.abs(v-desired[k]),0)/previousPrediction.length
      : .5;
    const persistenceBaseline=this.state.stepCount>0 ? [
      this.state.lastInput[0]??0, this.state.lastInput[2]??0,
      1-(this.state.lastInput[1]??0), 1-(this.state.lastInput[3]??0), this.state.lastInput[4]??0
    ] : [.68,.72,.75,.72,1];
    const baselineErr=persistenceBaseline.reduce((s,v,k)=>s+Math.abs(v-desired[k]),0)/desired.length;
    if(this.state.stepCount>0) this.learn(prevH,persistenceBaseline,desired);
    const pred=this.outputs(h,desired);
    this.state.hidden=h; this.state.lastInput=x; this.state.lastPrediction=pred;
    this.state.stepCount++; this.state.learningSteps++;
    this.state.predictionError01=clamp01(this.state.predictionError01*.94+currentErr*.06);
    this.state.fastError01=clamp01(this.state.fastError01*.82+currentErr*.18);
    this.state.slowError01=clamp01(this.state.slowError01*.985+currentErr*.015);
    this.state.overload01=clamp01(i.pressure01*.55+i.recoveryDebt01*.25+(1-i.capacity01)*.2);
    this.state.predictedEnergy01=pred[0]??.5;
    this.state.predictedCapacity01=pred[1]??.5;
    this.state.readiness01=clamp01((pred[2]??.5)*.45+(pred[4]??.5)*.2+(1-i.pressure01)*.2+i.capacity01*.15);
    this.state.interventionUrgency01=clamp01(this.state.overload01*.65+this.state.fastError01*.2+i.novelty01*.05+(i.awake?0:.1));
    this.state.stableCycles=this.state.overload01<.28 ? this.state.stableCycles+1 : 0;
    const modelError=this.state.predictionError01, baseline=clamp01(this.state.qualityGate.samples>0 ? this.state.qualityGate.baselineError01*.97+baselineErr*.03 : baselineErr), advantage=baseline-modelError;
    this.state.qualityGate={validated:this.state.learningSteps>=64&&advantage>.02,samples:this.state.learningSteps,baselineError01:baseline,modelError01:modelError};
    this.state.lastTick=i.tick; this.state.lastAt=i.at;
    return this.globalState();
  }
  globalState(){
    return {predictedEnergy01:this.state.predictedEnergy01,predictedCapacity01:this.state.predictedCapacity01,fastPredictionError01:this.state.fastError01,slowPredictionError01:this.state.slowError01,overload01:this.state.overload01,readiness01:this.state.readiness01,interventionUrgency01:this.state.interventionUrgency01,stableCycles:this.state.stableCycles,samples:this.state.learningSteps,quality:structuredClone(this.state.qualityGate)};
  }
  quality(){return structuredClone(this.state.qualityGate);}
}
