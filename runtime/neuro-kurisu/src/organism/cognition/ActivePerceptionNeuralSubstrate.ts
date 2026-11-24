const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Number.isFinite(x)?x:0);

type Modality='text'|'vision'|'audio'|'sensor'|'world';
const MODALITIES:Modality[]=['text','vision','audio','sensor','world'];
const seeded=(seed:number,scale=.04)=>{
  let x=(seed|0)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>15;
  return (((x>>>0)/4294967295)*2-1)*scale;
};
const matrix=(rows:number,cols:number,seed:number,scale=.04)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>seeded(seed+r*131+c*17,scale)));
const vec=(v:unknown,n:number,fill=0)=>{const o=new Array(n).fill(fill);if(Array.isArray(v))for(let i=0;i<Math.min(n,v.length);i++)o[i]=clamp11(Number(v[i]));return o;};

export interface ActivePerceptionNeuralInput {
  modalityFeatures:number[];
  uncertainty01:number;
  novelty01:number;
  actionability01:number;
  budget01:number;
  modalityReliability01:number;
  modalityFreshness01:number;
  modalityConflict01:number;
  tick:number;
  at:number;
}

export interface ActivePerceptionNeuralState {
  version:1;
  inputDim:number;
  hiddenDim:number;
  hidden:number[];
  inputWeights:number[][];
  recurrentWeights:number[][];
  outputWeights:number[];
  outputBias:number;
  prediction01:number;
  baseline01:number;
  predictionError01:number;
  learningSteps:number;
  selectedModality:Modality|null;
  selectedPrediction01:number;
  lastAt:number;
  quality:{validated:boolean;samples:number;modelMae01:number;baselineMae01:number;advantage01:number};
  pendingHidden:number[];
}

const defaults=():ActivePerceptionNeuralState=>({
  version:1,inputDim:8,hiddenDim:20,hidden:new Array(20).fill(0),
  inputWeights:matrix(20,8,61001,.03),recurrentWeights:matrix(20,20,62001,.025),
  outputWeights:Array.from({length:20},(_,i)=>seeded(63001+i,.03)),outputBias:0,
  prediction01:.5,baseline01:.5,predictionError01:.5,learningSteps:0,selectedModality:null,selectedPrediction01:.5,lastAt:0,
  quality:{validated:false,samples:0,modelMae01:1,baselineMae01:1,advantage01:0},
  pendingHidden:new Array(20).fill(0)
});

export class ActivePerceptionNeuralSubstrate {
  private state=defaults();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<ActivePerceptionNeuralState>|null){
    const d=defaults(),r=raw??{};
    const m=(v:unknown,rows:number,cols:number,seed:number)=>Array.isArray(v)?Array.from({length:rows},(_,i)=>vec((v as unknown[])[i],cols)):matrix(rows,cols,seed);
    const ow=Array.isArray(r.outputWeights)?vec(r.outputWeights,d.hiddenDim):d.outputWeights.slice();
    this.state={...d,...r,hidden:vec(r.hidden,d.hiddenDim),inputWeights:m(r.inputWeights,d.hiddenDim,d.inputDim,61001),recurrentWeights:m(r.recurrentWeights,d.hiddenDim,d.hiddenDim,62001),outputWeights:ow,quality:{...d.quality,...(r.quality??{})},pendingHidden:vec(r.pendingHidden,d.hiddenDim)};
  }
  private hiddenStep(x:number[]){
    const next=new Array(this.state.hiddenDim).fill(0),prev=this.state.hidden;
    for(let j=0;j<next.length;j++){
      let z=0;const iw=this.state.inputWeights[j]??[],rw=this.state.recurrentWeights[j]??[];
      for(let k=0;k<this.state.inputDim;k++)z+=(iw[k]??0)*(x[k]??0);
      for(let k=0;k<this.state.hiddenDim;k++)z+=(rw[k]??0)*(prev[k]??0);
      next[j]=tanh(z);
    }
    return next;
  }
  private score(h:number[]){return clamp01(.5+.35*tanh(this.state.outputBias+h.reduce((s,v,i)=>s+(this.state.outputWeights[i]??0)*v,0)));}
  private learn(h:number[],target:number[],baseline:number){
    const pred=target.map(()=>this.score(h));
    const actual=target[0]??.5,p=pred[0]??.5,error=actual-p,lr=.018/Math.sqrt(1+this.state.learningSteps/5000);
    for(let i=0;i<this.state.outputWeights.length;i++)this.state.outputWeights[i]=clamp11(this.state.outputWeights[i]+lr*error*(h[i]??0));
    this.state.outputBias=clamp11(this.state.outputBias+lr*error);
    this.state.predictionError01=clamp01(this.state.predictionError01*.94+Math.abs(error)*.06);
    this.state.learningSteps++;
    const previousModel=this.state.quality.modelMae01<1?this.state.quality.modelMae01:Math.abs(error);
    const previousBase=this.state.quality.baselineMae01<1?this.state.quality.baselineMae01:Math.abs(actual-baseline);
    const modelMae=previousModel*.97+Math.abs(error)*.03;
    const baseMae=previousBase*.97+Math.abs(actual-baseline)*.03;
    this.state.quality={validated:this.state.learningSteps>=64 && baseMae-modelMae>.015,samples:this.state.learningSteps,modelMae01:modelMae,baselineMae01:baseMae,advantage01:baseMae-modelMae};
  }
  rank(input:ActivePerceptionNeuralInput){
    const features=[...(input.modalityFeatures.slice(0,3)),input.uncertainty01,input.novelty01,input.actionability01,input.budget01,input.modalityReliability01,input.modalityFreshness01,input.modalityConflict01];
    const x=features.slice(0,this.state.inputDim).map(clamp11),h=this.hiddenStep(x),score=this.score(h);
    // Preserve the actually evaluated hidden state so observeGain() performs
    // credit assignment to the same neural representation that produced the
    // prediction. The previous implementation restored the old recurrent
    // state here, silently disconnecting online learning from rank().
    this.state.hidden=h.slice();
    this.state.prediction01=score;
    this.state.baseline01=clamp01(input.modalityReliability01*.4+input.modalityFreshness01*.35+(1-input.modalityConflict01)*.25);
    this.state.lastAt=input.at;
    return {predictedGain01:score,baselineGain01:this.state.baseline01,hidden:h.slice()};
  }
  observeGain(observedGain01:number,baseline01:number){
    const h=this.state.hidden.slice();
    this.learn(h,[clamp01(observedGain01)],clamp01(baseline01));
    this.state.prediction01=clamp01(this.state.prediction01*.85+clamp01(observedGain01)*.15);
    return this.quality();
  }
  choose(candidates:Array<{modality:Modality;predictedGain01:number;cost01:number;priority01:number;hidden?:number[]}>){
    const ranked=candidates.map(c=>({...c,utility01:clamp01(c.predictedGain01*.6+c.priority01*.25+(1-c.cost01)*.15)})).sort((a,b)=>b.utility01-a.utility01);
    const best=ranked[0]??null;this.state.selectedModality=best?.modality??null;this.state.selectedPrediction01=best?.predictedGain01??.5;this.state.pendingHidden=Array.isArray(best?.hidden)?vec(best?.hidden,this.state.hiddenDim):this.state.hidden.slice();this.state.hidden=this.state.pendingHidden.slice();
    return {selected:best?.modality??null,ranked};
  }
  quality(){return structuredClone(this.state.quality);}
  globalState(){return {selectedModality:this.state.selectedModality,selectedPrediction01:this.state.selectedPrediction01,predictionError01:this.state.predictionError01,learningSteps:this.state.learningSteps,quality:this.quality()};}
}
