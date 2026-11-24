/** P2701 — compact trainable temporal neural substrate.
 *  Purpose: provide a small, persistent recurrent/spiking state with eligibility traces
 *  and reward-modulated STDP-like plasticity that can run on a medium phone.
 *  This is an engineering neural substrate, not a claim of biological equivalence.
 */
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const prand=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return (x>>>0)/0xffffffff;};

export interface NeuralTemporalSubstrateState {
  version:1; tick:number; neurons:number; inputDim:number; fanIn:number;
  membrane:number[]; spikes:number[]; thresholds:number[]; adaptation:number[];
  recurrentTargets:number[][]; recurrentWeights:number[][]; inputWeights:number[][];
  eligibility:number[][]; preTrace:number[]; postTrace:number[];
  slowTrace:number[]; predictionReadout:number[];
  plasticity01:number; stability01:number; sparsity01:number; prediction01:number;
  predictionError01:number; learningUpdates:number; spikeCount:number; lastReward01:number;
  meanWeightAbs01:number;
}

const matrix=(rows:number,cols:number,seed:number,scale:number)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>((prand(seed+r*97+c*31)*2)-1)*scale));
export const defaultNeuralTemporalSubstrate=():NeuralTemporalSubstrateState=>{
  const neurons=32,inputDim=64,fanIn=6;
  const recurrentTargets=Array.from({length:neurons},(_,i)=>Array.from({length:fanIn},(_,q)=>(i*13+q*17+5)%neurons));
  return {
    version:1,tick:0,neurons,inputDim,fanIn,
    membrane:new Array(neurons).fill(0),spikes:new Array(neurons).fill(0),
    thresholds:new Array(neurons).fill(.30),adaptation:new Array(neurons).fill(0),
    recurrentTargets,recurrentWeights:matrix(neurons,fanIn,2701,.055),inputWeights:matrix(neurons,inputDim,3701,.045),
    eligibility:Array.from({length:neurons},()=>new Array(fanIn).fill(0)),
    preTrace:new Array(neurons).fill(0),postTrace:new Array(neurons).fill(0),slowTrace:new Array(neurons).fill(0),
    predictionReadout:Array.from({length:neurons},(_,i)=>((prand(4701+i*19)*2)-1)*.08),
    plasticity01:.38,stability01:.72,sparsity01:.9,prediction01:.5,predictionError01:.5,
    learningUpdates:0,spikeCount:0,lastReward01:.5,meanWeightAbs01:.05
  };
};

export class NeuralTemporalSubstrate {
  private state=defaultNeuralTemporalSubstrate();
  restore(raw?:Partial<NeuralTemporalSubstrateState>|null){
    const d=defaultNeuralTemporalSubstrate(),r:any=raw??{};
    const arr=(v:any,n:number,f=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(f)).slice(0,n):new Array(n).fill(f);
    const mat=(v:any,rows:number,cols:number,f=0)=>Array.isArray(v)?Array.from({length:rows},(_,i)=>arr(v[i],cols,f)):Array.from({length:rows},()=>new Array(cols).fill(f));
    this.state={...d,...r,version:1,neurons:d.neurons,inputDim:d.inputDim,fanIn:d.fanIn,
      membrane:arr(r.membrane,d.neurons),spikes:arr(r.spikes,d.neurons),thresholds:arr(r.thresholds,d.neurons,.30),adaptation:arr(r.adaptation,d.neurons),
      recurrentTargets:mat(r.recurrentTargets,d.neurons,d.fanIn),recurrentWeights:mat(r.recurrentWeights,d.neurons,d.fanIn),inputWeights:mat(r.inputWeights,d.neurons,d.inputDim),
      eligibility:mat(r.eligibility,d.neurons,d.fanIn),preTrace:arr(r.preTrace,d.neurons),postTrace:arr(r.postTrace,d.neurons),slowTrace:arr(r.slowTrace,d.neurons),
      predictionReadout:arr(r.predictionReadout,d.neurons,.08),plasticity01:clamp(Number(r.plasticity01??d.plasticity01)),
      stability01:clamp(Number(r.stability01??d.stability01)),sparsity01:clamp(Number(r.sparsity01??d.sparsity01)),
      prediction01:clamp(Number(r.prediction01??d.prediction01)),predictionError01:clamp(Number(r.predictionError01??d.predictionError01))};
  }
  snapshot(){return structuredClone(this.state);}
  step(input:number[],tick:number){
    const s=this.state,n=s.neurons,prev=s.membrane.slice(),sp=new Array(n).fill(0); let active=0;
    for(let i=0;i<n;i++){
      let drive=0; for(let k=0;k<s.inputDim;k++)drive+=(s.inputWeights[i]?.[k]??0)*(input[k]??0);
      let rec=0; for(let q=0;q<s.fanIn;q++){const j=s.recurrentTargets[i]![q]!,pre=prev[j]??0;rec+=(s.recurrentWeights[i]![q]??0)*pre;s.eligibility[i]![q]=s.eligibility[i]![q]!*0.90+(pre*s.spikes[i]!);}
      const v=tanh(prev[i]*.82+drive+rec-s.adaptation[i]!*.12);
      const spike=v>s.thresholds[i]! ? 1:0; sp[i]=spike; active+=spike;
      s.membrane[i]=spike?Math.max(0,v*.18):v;
      s.adaptation[i]=clamp(s.adaptation[i]!*0.92+spike*.12,0,1);
      s.preTrace[i]=s.preTrace[i]!*0.88+clamp(Math.abs(drive),0,1)*.12;
      s.postTrace[i]=s.postTrace[i]!*0.88+spike*.12;
      s.slowTrace[i]=s.slowTrace[i]!*0.985+s.membrane[i]!*.015;
    }
    // Winner-limited sparse firing keeps the substrate cheap and prevents runaway activity.
    const cap=Math.max(2,Math.ceil(n*.18));
    if(active>cap){const ids=sp.map((v,i)=>({v,i})).filter(z=>z.v).sort((a,b)=>Math.abs(s.membrane[b.i]!)-Math.abs(s.membrane[a.i]!)).map(z=>z.i);for(const i of ids.slice(cap))sp[i]=0;}
    s.spikes=sp;s.tick=tick;s.spikeCount+=sp.reduce((a,b)=>a+b,0);
    const rate=sp.reduce((a,b)=>a+b,0)/n;s.sparsity01=clamp(s.sparsity01*.9+(1-rate)*.1);s.stability01=clamp(s.stability01*.985+(1-Math.min(1,Math.abs(rate-.10)*4))*.015);
    let pred=.5; for(let i=0;i<n;i++)pred+=s.predictionReadout[i]!*(s.slowTrace[i]??0)*.7; s.prediction01=clamp(pred);
    s.meanWeightAbs01=clamp(s.recurrentWeights.flat().reduce((a,b)=>a+Math.abs(b),0)/Math.max(1,n*s.fanIn)/.12);
    return {embedding:s.slowTrace.slice(0,16).map(signed),spikes:sp.slice(),prediction01:s.prediction01,activeFraction01:rate,sparsity01:s.sparsity01,stability01:s.stability01};
  }
  learn(input:number[],reward01:number,predictionError01:number,verified01:number){
    const s=this.state,reward=clamp(reward01),err=clamp(predictionError01),verified=clamp(verified01); const mod=(reward-.5)*(0.35+0.65*verified)+(err-.5)*.18; let updates=0;
    for(let i=0;i<s.neurons;i++)for(let q=0;q<s.fanIn;q++){
      const pre=s.preTrace[s.recurrentTargets[i]![q]!]??0,post=s.postTrace[i]??0,elig=s.eligibility[i]![q]??0;
      const stdp=pre*post*.08-pre*(1-post)*.035; const eta=.004*(.25+.75*s.plasticity01)*(verified>.5?1.15:.75);
      if(Math.abs(elig)>1e-4||Math.abs(stdp)>1e-4){s.recurrentWeights[i]![q]=signed((s.recurrentWeights[i]![q]??0)+(stdp+elig*.05)*mod*eta);updates++;}
      s.eligibility[i]![q]=elig*.55;
    }
    for(let i=0;i<s.neurons;i++)for(let k=0;k<s.inputDim;k++){
      const x=input[k]??0,trace=s.postTrace[i]??0;if(Math.abs(x*trace)>.0002)s.inputWeights[i]![k]=signed((s.inputWeights[i]![k]??0)+x*trace*mod*.0007); }
    const target=clamp(.25+err*.65);s.plasticity01=clamp(s.plasticity01*.94+target*.06);s.predictionError01=clamp(s.predictionError01*.84+err*.16);s.lastReward01=reward;s.learningUpdates+=updates;
    return {updates,plasticity01:s.plasticity01,predictionError01:s.predictionError01,meanWeightAbs01:s.meanWeightAbs01};
  }
  diagnostics(){const s=this.state;return {tick:s.tick,neurons:s.neurons,learningUpdates:s.learningUpdates,spikeCount:s.spikeCount,plasticity01:s.plasticity01,stability01:s.stability01,sparsity01:s.sparsity01,prediction01:s.prediction01,predictionError01:s.predictionError01,meanWeightAbs01:s.meanWeightAbs01};}
}
