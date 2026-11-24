const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
function w(seed:number,scale=.03){let x=(seed|0)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>15;return (((x>>>0)/4294967295)*2-1)*scale;}
function matrix(rows:number,cols:number,seed:number,scale=.03){return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>w(seed+r*131+c*17,scale)));}

export interface MetacognitiveNeuralInput{
  centralLatent:number[]; workspace:number[]; selfLatent:number[];
  predictionError01:number; confidence01:number; worldUncertainty01:number;
  identityDrift01:number; actionOutcome01:number; tick:number; at:number;
}
export interface MetacognitiveNeuralState{
  version:1; inputDim:number; hiddenDim:number; hidden:number[];
  inputWeights:number[][]; recurrentWeights:number[][]; outputWeights:number[][]; outputBias:number[];
  lastInput:number[]; lastOutput:number[]; stepCount:number; learningSteps:number;
  calibrationError01:number; selfUncertainty01:number; introspectivePredictionError01:number;
  revisionReadiness01:number; lastTick:number; lastAt:number;
}
function defaults():MetacognitiveNeuralState{
  const inputDim=24,hiddenDim=32,outputDim=6;
  return {
    version:1,inputDim,hiddenDim,hidden:new Array(hiddenDim).fill(0),
    inputWeights:matrix(hiddenDim,inputDim,21001),recurrentWeights:matrix(hiddenDim,hiddenDim,22001),
    outputWeights:matrix(outputDim,hiddenDim,23001),outputBias:new Array(outputDim).fill(0),
    lastInput:new Array(inputDim).fill(0),lastOutput:new Array(outputDim).fill(.5),
    stepCount:0,learningSteps:0,calibrationError01:.5,selfUncertainty01:.5,
    introspectivePredictionError01:.5,revisionReadiness01:.5,lastTick:0,lastAt:0,
  };
}
export class MetacognitiveNeuralSubstrate{
  private state=defaults();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<MetacognitiveNeuralState>|null){
    const d=defaults(),r=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const mat=(v:any,rows:number,cols:number)=>Array.isArray(v)
      ? Array.from({length:rows},(_,i)=>arr(v[i],cols)) : matrix(rows,cols,991);
    this.state={...d,...r,
      hidden:arr(r.hidden,d.hiddenDim),inputWeights:mat(r.inputWeights,d.hiddenDim,d.inputDim),
      recurrentWeights:mat(r.recurrentWeights,d.hiddenDim,d.hiddenDim),outputWeights:mat(r.outputWeights,6,d.hiddenDim),
      outputBias:arr(r.outputBias,6,.5),lastInput:arr(r.lastInput,d.inputDim),lastOutput:arr(r.lastOutput,6,.5)};
  }
  private pack(i:MetacognitiveNeuralInput){
    const groups=[i.centralLatent,i.workspace,i.selfLatent,[i.predictionError01,i.confidence01,i.worldUncertainty01,i.identityDrift01,i.actionOutcome01]];
    const x=new Array(this.state.inputDim).fill(0);let k=0;
    for(const g of groups)for(const v of g){if(k>=x.length)break;x[k++]=Math.max(-1,Math.min(1,Number.isFinite(v)?v:0));}
    return x;
  }
  private hiddenStep(x:number[]){
    const prev=this.state.hidden,next=new Array(this.state.hiddenDim).fill(0);
    for(let j=0;j<next.length;j++){
      const inputSum=this.state.inputWeights[j].reduce((s,v,i)=>s+v*(x[i]??0),0);
      const recurrentSum=this.state.recurrentWeights[j].reduce((s,v,i)=>s+v*(prev[i]??0),0);
      next[j]=tanh(inputSum+recurrentSum);
    }
    return next;
  }
  private outputs(h:number[]){
    return this.state.outputWeights.map((row,i)=>sigmoid((this.state.outputBias[i]??0)+row.reduce((s,v,j)=>s+v*(h[j]??0),0)));
  }
  observe(input:MetacognitiveNeuralInput){
    const x=this.pack(input),prevH=this.state.hidden.slice(),h=this.hiddenStep(x),pred=this.outputs(h);
    let introspectiveError=.5,calError=.5;
    if(this.state.stepCount>0){
      introspectiveError=clamp01(this.state.lastOutput.reduce((s,v,i)=>s+Math.abs(v-(this.state.lastInput[i%this.state.lastInput.length]??0)),0)/(this.state.lastOutput.length*1.5));
      calError=Math.abs((this.state.lastOutput[0]??.5)-clamp01(input.actionOutcome01));
      this.learn(prevH,h,this.state.lastOutput,[
        clamp01(input.confidence01),clamp01(1-input.predictionError01),clamp01(1-input.worldUncertainty01),
        clamp01(1-input.identityDrift01),clamp01(input.actionOutcome01),clamp01(1-input.actionOutcome01)]);
    }
    this.state.hidden=h;this.state.lastInput=x;this.state.lastOutput=pred;
    this.state.stepCount++;this.state.learningSteps++;
    this.state.calibrationError01=clamp01(this.state.calibrationError01*.96+calError*.04);
    this.state.introspectivePredictionError01=clamp01(this.state.introspectivePredictionError01*.96+introspectiveError*.04);
    this.state.selfUncertainty01=clamp01(pred[2]*.4+input.worldUncertainty01*.35+input.predictionError01*.25);
    this.state.revisionReadiness01=clamp01(pred[3]*.55+input.predictionError01*.2+input.identityDrift01*.15+input.worldUncertainty01*.1);
    this.state.lastTick=input.tick;this.state.lastAt=input.at;
    return this.globalState();
  }
  private learn(prevH:number[],h:number[],target:number[],desired:number[]){
    const pred=this.outputs(h),lr=.01/Math.sqrt(1+this.state.learningSteps/5000),gradH=new Array(this.state.hiddenDim).fill(0);
    for(let i=0;i<6;i++){
      const e=desired[i]-(pred[i]??0),d=e*(pred[i]??.5)*(1-(pred[i]??.5));
      for(let j=0;j<this.state.hiddenDim;j++){
        const row=this.state.outputWeights[i];gradH[j]+=(row[j]??0)*d;
        row[j]=Math.max(-1,Math.min(1,(row[j]??0)+lr*d*(h[j]??0)));
      }
      this.state.outputBias[i]=Math.max(-1,Math.min(1,(this.state.outputBias[i]??0)+lr*d));
    }
    for(let j=0;j<this.state.hiddenDim;j++){
      const dh=gradH[j]*(1-(h[j]??0)**2);
      for(let i=0;i<this.state.inputDim;i++)this.state.inputWeights[j][i]=Math.max(-1,Math.min(1,this.state.inputWeights[j][i]+lr*dh*(this.state.lastInput[i]??0)));
      for(let i=0;i<this.state.hiddenDim;i++)this.state.recurrentWeights[j][i]=Math.max(-1,Math.min(1,this.state.recurrentWeights[j][i]+lr*dh*(prevH[i]??0)));
    }
  }
  globalState(){
    return {
      confidenceOfConfidence01:this.state.lastOutput[0]??.5,
      uncertaintyAboutDecision01:this.state.lastOutput[1]??.5,
      selfUncertainty01:this.state.selfUncertainty01,
      predictionCalibration01:1-this.state.calibrationError01,
      knownUnknowns01:this.state.lastOutput[2]??.5,
      revisionReadiness01:this.state.revisionReadiness01,
      introspectivePredictionError01:this.state.introspectivePredictionError01,
      samples:this.state.learningSteps,
    };
  }
}
