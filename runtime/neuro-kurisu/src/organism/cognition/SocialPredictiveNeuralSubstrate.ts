/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
const clamp=(n:number)=>Math.max(-1,Math.min(1,Number.isFinite(n)?n:0));
const unit=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

export interface SocialPredictiveInput {
  personFeatures:number[];
  socialContext:number[];
  selfFeatures:number[];
  worldFeatures:number[];
  actionContext:number[];
  tick:number;
  at:number;
}

export interface SocialPredictiveOutcome {
  actualIntent01:number;
  actualValence01:number;
  actualResponse01:number;
  success01:number;
  socialMismatch01:number;
}

export interface SocialPredictiveFrame {
  latent:number[];
  predictedIntent01:number;
  predictedValence01:number;
  predictedResponse01:number;
  higherOrderBelief01:number;
  uncertainty01:number;
  confidence01:number;
  predictionError01:number;
  sampleCount:number;
}

export interface SocialPredictiveState {
  version:1;
  inputDim:number;
  hiddenDim:number;
  outputDim:number;
  inputWeights:number[][];
  recurrentWeights:number[][];
  outputWeights:number[][];
  bias:number[];
  hidden:number[];
  lastPrediction:number[];
  previousInput:number[];
  sampleCount:number;
  learningSteps:number;
  learningRate:number;
  meanPredictionError01:number;
  meanUncertainty01:number;
  higherOrderBelief01:number;
  lastAt:number;
  validated:boolean;
}

const dims={input:24,hidden:20,output:4};
function zeros(n:number){return Array.from({length:n},()=>0);}
function seeded(i:number,j:number,scale=.08){
  const x=Math.sin((i+1)*12.9898+(j+1)*78.233)*43758.5453;
  return (x-Math.floor(x))*2*scale-scale;
}
function matrix(rows:number,cols:number,scale=.08){
  return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>seeded(r,c,scale)));
}
function defaults():SocialPredictiveState{
  return {
    version:1,inputDim:dims.input,hiddenDim:dims.hidden,outputDim:dims.output,
    inputWeights:matrix(dims.hidden,dims.input),recurrentWeights:matrix(dims.hidden,dims.hidden),outputWeights:matrix(dims.output,dims.hidden),
    bias:zeros(dims.hidden),hidden:zeros(dims.hidden),lastPrediction:zeros(dims.output),previousInput:zeros(dims.input),sampleCount:0,learningSteps:0,
    learningRate:.018,meanPredictionError01:.5,meanUncertainty01:.65,higherOrderBelief01:.5,lastAt:0,validated:false,
  };
}
function finiteVector(values:number[]|undefined,n:number){
  const out=zeros(n); for(let i=0;i<Math.min(n,values?.length??0);i++) out[i]=clamp(Number(values?.[i]??0)); return out;
}
function activation(x:number){return Math.tanh(x);}
function derivative(x:number){return 1-x*x;}

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const matN=(v:unknown,rows:number,cols:number,scale:number):number[][]|null=>Array.isArray(v)?Array.from({length:rows},(_,i)=>{const row=Array.isArray((v as unknown[])[i])?(v as unknown[])[i] as unknown[]:[];return Array.from({length:cols},(_,j)=>finN(row[j],seeded(i,j,scale)));}):null;
export class SocialPredictiveNeuralSubstrate{
  private state=defaults();

  restore(raw?:Partial<SocialPredictiveState>|null){
    const d=defaults();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const iw=matN(read('inputWeights'),d.hiddenDim,d.inputDim,.08),rw=matN(read('recurrentWeights'),d.hiddenDim,d.hiddenDim,.08),ow=matN(read('outputWeights'),d.outputDim,d.hiddenDim,.08);
    this.state={version:1,inputDim:d.inputDim,hiddenDim:d.hiddenDim,outputDim:d.outputDim,
      inputWeights:iw??d.inputWeights,recurrentWeights:rw??d.recurrentWeights,outputWeights:ow??d.outputWeights,
      bias:finiteVector(read('bias') as number[]|undefined,d.hiddenDim),hidden:finiteVector(read('hidden') as number[]|undefined,d.hiddenDim),lastPrediction:finiteVector(read('lastPrediction') as number[]|undefined,d.outputDim),previousInput:finiteVector(read('previousInput') as number[]|undefined,d.inputDim),
      sampleCount:cnt(read('sampleCount'),d.sampleCount),learningSteps:cnt(read('learningSteps'),d.learningSteps),learningRate:Math.max(.001,Math.min(.05,finN(read('learningRate'),d.learningRate))),
      meanPredictionError01:unit(finN(read('meanPredictionError01'),d.meanPredictionError01)),meanUncertainty01:unit(finN(read('meanUncertainty01'),d.meanUncertainty01)),higherOrderBelief01:unit(finN(read('higherOrderBelief01'),d.higherOrderBelief01)),lastAt:finN(read('lastAt'),d.lastAt),validated:read('validated')===true};
  }
  snapshot(){return structuredClone(this.state);}

  private pack(input:SocialPredictiveInput){
    const p=finiteVector(input.personFeatures,6);
    const s=finiteVector(input.socialContext,6);
    const self=finiteVector(input.selfFeatures,4);
    const w=finiteVector(input.worldFeatures,4);
    const a=finiteVector(input.actionContext,4);
    return [...p,...s,...self,...w,...a];
  }

  private forward(input:SocialPredictiveInput){
    const x=this.pack(input);
    const h=zeros(dims.hidden);
    for(let i=0;i<dims.hidden;i++){
      let z=this.state.bias[i];
      for(let j=0;j<dims.input;j++) z+=(this.state.inputWeights[i]?.[j]??0)*x[j];
      for(let j=0;j<dims.hidden;j++) z+=(this.state.recurrentWeights[i]?.[j]??0)*this.state.hidden[j];
      h[i]=activation(z);
    }
    const y=zeros(dims.output);
    for(let i=0;i<dims.output;i++){
      let z=0; for(let j=0;j<dims.hidden;j++)z+=(this.state.outputWeights[i]?.[j]??0)*h[j];
      y[i]=unit((z+1)/2);
    }
    return {x,h,y};
  }

  observe(input:SocialPredictiveInput):SocialPredictiveFrame{
    const {x,h,y}=this.forward(input);
    this.state.hidden=h; this.state.lastPrediction=y; this.state.previousInput=x; this.state.lastAt=input.at;
    this.state.sampleCount+=1;
    const uncertainty=unit(.2+.7*Math.abs(y[0]-.5));
    this.state.meanUncertainty01=unit(this.state.meanUncertainty01*.95+uncertainty*.05);
    return this.frame(0,uncertainty);
  }

  learnOutcome(outcome:SocialPredictiveOutcome){
    const target=[unit(outcome.actualIntent01),unit(outcome.actualValence01),unit(outcome.actualResponse01),unit((outcome.success01+.5)/1.5)];
    const before=this.state.lastPrediction.slice();
    const errorVec=target.map((t,i)=>t-(before[i]??.5));
    const mae=errorVec.reduce((s,v)=>s+Math.abs(v),0)/errorVec.length;
    const gain=this.state.learningRate*(.55+unit(outcome.socialMismatch01)*.45);
    for(let i=0;i<dims.output;i++)for(let j=0;j<dims.hidden;j++)this.state.outputWeights[i][j]=clamp(this.state.outputWeights[i][j]+gain*errorVec[i]*this.state.hidden[j]);
    for(let j=0;j<dims.hidden;j++){
      const local=errorVec.reduce((s,e,i)=>s+e*(this.state.outputWeights[i]?.[j]??0),0)*derivative(this.state.hidden[j]);
      for(let k=0;k<dims.input;k++)this.state.inputWeights[j][k]=clamp(this.state.inputWeights[j][k]+gain*.45*local*this.state.previousInput[k]);
      for(let k=0;k<dims.hidden;k++)this.state.recurrentWeights[j][k]=clamp(this.state.recurrentWeights[j][k]+gain*.25*local*this.state.hidden[k]);
      this.state.bias[j]=clamp(this.state.bias[j]+gain*.02*local);
    }
    this.state.learningSteps+=1;
    this.state.meanPredictionError01=unit(this.state.meanPredictionError01*.96+mae*.04);
    this.state.meanUncertainty01=unit(this.state.meanUncertainty01*.94+(mae*.9)*.06);
    this.state.higherOrderBelief01=unit(this.state.higherOrderBelief01*.9+target[2]*.1);
    this.state.validated=this.state.learningSteps>=32 && this.state.meanPredictionError01<.26;
    return this.state.meanPredictionError01;
  }

  frame(error01=0,uncertainty01=this.state.meanUncertainty01):SocialPredictiveFrame{
    const y=this.state.lastPrediction;
    const confidence=unit(1-uncertainty01*.55-error01*.45);
    return {latent:this.state.hidden.slice(),predictedIntent01:y[0]??.5,predictedValence01:y[1]??.5,predictedResponse01:y[2]??.5,higherOrderBelief01:this.state.higherOrderBelief01,uncertainty01,confidence01:confidence,predictionError01:unit(error01||this.state.meanPredictionError01),sampleCount:this.state.sampleCount};
  }

  diagnostics(){return {sampleCount:this.state.sampleCount,learningSteps:this.state.learningSteps,meanPredictionError01:this.state.meanPredictionError01,meanUncertainty01:this.state.meanUncertainty01,validated:this.state.validated,higherOrderBelief01:this.state.higherOrderBelief01};}
}
