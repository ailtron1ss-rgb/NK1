import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const TRAITS=['curiosity','caution','care','truth-seeking','self-reflection','self-preservation','social-attunement','persistence'] as const;
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return x>>>0;};
const rand=(seed:number,s=.2)=>(((seeded(seed)/0xffffffff)*2)-1)*s;
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));

export interface B270Assembly { id:string; activation01:number; stability01:number; prediction01:number; selfRelevance01:number; valence01:number; plasticity01:number; age:number; }
export interface B270State {
  version:1; tick:number; cycles:number; learningUpdates:number; autonomousSelections:number; successfulSelections:number;
  neuralEmbryos:B270Assembly[]; traitValues:Record<string,number>; traitEvidence:Record<string,number>;
  needs:{novelty01:number;uncertainty01:number;competence01:number;connection01:number;coherence01:number;autonomy01:number;energy01:number};
  selfLatent:number[]; identityCoherence01:number; autobiographicalContinuity01:number; agency01:number; personalityCoherence01:number;
  intrinsicReward01:number; predictedReward01:number; predictionError01:number; lastAction:ActionKind|null; lastMode:string; proposedAction:ActionKind; proposedReason:string;
  history:Array<{tick:number;action:ActionKind|null;reward01:number;predictionError01:number;autonomy01:number;novelty01:number}>;
}
export interface B270StepInput {
  tick:number; vector:number[]; neuralAssembly:number[]; predictionError01:number; uncertainty01:number; energy01:number; novelty01:number;
  goalPressure01:number; socialNeed01:number; memoryContinuity01:number; identityContinuity01:number; realityAlignment01:number; action?:ActionKind|null;
}
export interface B270StepResult { selfLatent:number[]; proposedAction:ActionKind; proposedReason:string; autonomy01:number; intrinsicReward01:number; personalityCoherence01:number; identityCoherence01:number; embryoActivations:number[]; traitValues:Record<string,number>; needs:B270State['needs']; }

const defaultTraits=()=>Object.fromEntries(TRAITS.map(t=>[t,.5]));
const defaultEvidence=()=>Object.fromEntries(TRAITS.map(t=>[t,0]));
export function defaultB270NeuralGerminalOrganism():B270State {
  const neuralEmbryos:B270Assembly[]=Array.from({length:12},(_,i)=>({id:`embryo-${i}`,activation01:.12,stability01:.45,prediction01:.5,selfRelevance01:i===3||i===7?.85:.35,valence01:0,plasticity01:.45,age:0}));
  return {version:1,tick:0,cycles:0,learningUpdates:0,autonomousSelections:0,successfulSelections:0,neuralEmbryos,traitValues:defaultTraits(),traitEvidence:defaultEvidence(),needs:{novelty01:.2,uncertainty01:.25,competence01:.5,connection01:.25,coherence01:.7,autonomy01:.5,energy01:.8},selfLatent:new Array(16).fill(0),identityCoherence01:.7,autobiographicalContinuity01:.8,agency01:.5,personalityCoherence01:.65,intrinsicReward01:.5,predictedReward01:.5,predictionError01:.25,lastAction:null,lastMode:'wait',proposedAction:'wait',proposedReason:'initial-state',history:[]};
}

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const vecN=(v:unknown,len:number,lo:number,hi:number,fill:number):number[]=>Array.from({length:len},(_,i)=>{const x=Array.isArray(v)?(v as unknown[])[i]:undefined;const n=typeof x==='number'?x:Number(x);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fill;});
const sanEmbryo=(x:unknown,fb:B270Assembly):B270Assembly=>{const r=(x&&typeof x==='object')?x as Record<string,unknown>:{};return {id:str(r.id,fb.id),activation01:clamp01(finN(r.activation01,fb.activation01)),stability01:clamp01(finN(r.stability01,fb.stability01)),prediction01:clamp01(finN(r.prediction01,fb.prediction01)),selfRelevance01:clamp01(finN(r.selfRelevance01,fb.selfRelevance01)),valence01:clamp11(finN(r.valence01,fb.valence01)),plasticity01:clamp01(finN(r.plasticity01,fb.plasticity01)),age:cnt(r.age,fb.age)};};
const sanHist=(x:unknown)=>Array.isArray(x)?(x as unknown[]).slice(-256).filter(v=>v&&typeof v==='object').map(v=>{const r=v as Record<string,unknown>;return {tick:cnt(r.tick,0),action:ACTIONS.includes(r.action as ActionKind)?r.action as ActionKind:null,reward01:clamp01(finN(r.reward01,0)),predictionError01:clamp01(finN(r.predictionError01,0)),autonomy01:clamp01(finN(r.autonomy01,0)),novelty01:clamp01(finN(r.novelty01,0))};}):[];
export class B270NeuralGerminalOrganism {
  private state=defaultB270NeuralGerminalOrganism();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B270State>|null){
    const d=defaultB270NeuralGerminalOrganism();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const tv=(read('traitValues')&&typeof read('traitValues')==='object')?read('traitValues') as Record<string,unknown>:{};
    const te=(read('traitEvidence')&&typeof read('traitEvidence')==='object')?read('traitEvidence') as Record<string,unknown>:{};
    const nd=(read('needs')&&typeof read('needs')==='object')?read('needs') as Record<string,unknown>:{};
    const eRaw=read('neuralEmbryos');
    const neuralEmbryos=Array.isArray(eRaw)?(eRaw as unknown[]).slice(0,16).map((x,i)=>sanEmbryo(x,d.neuralEmbryos[i%12]!)):d.neuralEmbryos;
    this.state={version:1,tick:cnt(read('tick'),d.tick),cycles:cnt(read('cycles'),d.cycles),learningUpdates:cnt(read('learningUpdates'),d.learningUpdates),autonomousSelections:cnt(read('autonomousSelections'),d.autonomousSelections),successfulSelections:cnt(read('successfulSelections'),d.successfulSelections),neuralEmbryos,
      traitValues:Object.fromEntries(TRAITS.map(t=>[t,clamp01(finN(tv[t],d.traitValues[t]))])) as Record<string,number>,
      traitEvidence:Object.fromEntries(TRAITS.map(t=>[t,clamp01(finN(te[t],d.traitEvidence[t]))])) as Record<string,number>,
      needs:{novelty01:clamp01(finN(nd.novelty01,d.needs.novelty01)),uncertainty01:clamp01(finN(nd.uncertainty01,d.needs.uncertainty01)),competence01:clamp01(finN(nd.competence01,d.needs.competence01)),connection01:clamp01(finN(nd.connection01,d.needs.connection01)),coherence01:clamp01(finN(nd.coherence01,d.needs.coherence01)),autonomy01:clamp01(finN(nd.autonomy01,d.needs.autonomy01)),energy01:clamp01(finN(nd.energy01,d.needs.energy01))},
      selfLatent:vecN(read('selfLatent'),16,-1,1,0),identityCoherence01:clamp01(finN(read('identityCoherence01'),d.identityCoherence01)),autobiographicalContinuity01:clamp01(finN(read('autobiographicalContinuity01'),d.autobiographicalContinuity01)),agency01:clamp01(finN(read('agency01'),d.agency01)),personalityCoherence01:clamp01(finN(read('personalityCoherence01'),d.personalityCoherence01)),intrinsicReward01:clamp01(finN(read('intrinsicReward01'),d.intrinsicReward01)),predictedReward01:clamp01(finN(read('predictedReward01'),d.predictedReward01)),predictionError01:clamp01(finN(read('predictionError01'),d.predictionError01)),lastAction:ACTIONS.includes(read('lastAction') as ActionKind)?read('lastAction') as ActionKind:null,lastMode:str(read('lastMode'),d.lastMode),proposedAction:ACTIONS.includes(read('proposedAction') as ActionKind)?read('proposedAction') as ActionKind:d.proposedAction,proposedReason:str(read('proposedReason'),d.proposedReason),history:sanHist(read('history'))};
  }
  private actionIndex(a:ActionKind|null|undefined){return a?Math.max(0,ACTIONS.indexOf(a)):-1;}
  private traitForAction(a:ActionKind){const m:Record<ActionKind,string[]>={respond:['care','social-attunement'],explore:['curiosity'],verify:['truth-seeking','caution'],rest:['self-preservation'],reflect:['self-reflection'],wait:['caution'],defer:['caution']};return m[a]??[];}
  private autonomousDrive():number{
    const n=this.state.needs;
    return clamp01(.20*n.novelty01+.17*n.uncertainty01+.18*n.competence01+.13*n.connection01+.12*(1-n.coherence01)+.10*n.autonomy01+.10*(1-n.energy01));
  }
  step(input:B270StepInput):B270StepResult{
    const vec=Array.from({length:32},(_,i)=>clamp11(Number(input.vector[i]??0)));
    const assembly=Array.from({length:12},(_,i)=>clamp01(Number(input.neuralAssembly[i]??0)));
    const shift=clamp01(input.predictionError01*.6+input.uncertainty01*.24+input.novelty01*.16);
    const autonomy=clamp01(.28*(1-input.identityContinuity01)+.24*shift+.20*this.autonomousDrive()+.18*this.state.agency01+.10*(1-input.goalPressure01));
    const hidden:number[]=[];
    for(let i=0;i<16;i++){
      let z=rand(450000+i*101,.08);
      for(let j=0;j<vec.length;j++) z += vec[j]*rand(451000+i*53+j*17,.025);
      for(let j=0;j<assembly.length;j++) z += assembly[j]*rand(452000+i*31+j*7,.04);
      z += (i<8?input.identityContinuity01:input.memoryContinuity01)*.05;
      hidden.push(Math.tanh(z));
    }
    this.state.selfLatent=this.state.selfLatent.map((v,i)=>clamp11(v*.91+hidden[i]*.09));
    const continuity=clamp01(input.identityContinuity01*.34+input.memoryContinuity01*.24+input.realityAlignment01*.18+(1-input.predictionError01)*.14+input.energy01*.10);
    const coherence=clamp01(input.memoryContinuity01*.23+input.realityAlignment01*.22+(1-input.uncertainty01)*.18+(1-input.predictionError01)*.17+input.identityContinuity01*.20);
    this.state.identityCoherence01=clamp01(this.state.identityCoherence01*.94+continuity*.06);
    this.state.autobiographicalContinuity01=clamp01(this.state.autobiographicalContinuity01*.94+input.memoryContinuity01*.06);
    this.state.agency01=clamp01(this.state.agency01*.92+autonomy*.08);
    const novelty=clamp01(input.novelty01*.6+input.uncertainty01*.28+Math.abs(input.predictionError01-.18)*.12);
    const competence=clamp01(.65*(1-input.predictionError01)+.35*(1-input.uncertainty01));
    const connection=clamp01(this.state.needs.connection01*.9+input.socialNeed01*.1);
    const energy=clamp01(this.state.needs.energy01*.97+input.energy01*.03-autonomy*.008);
    this.state.needs={novelty01:novelty,uncertainty01:clamp01(input.uncertainty01),competence01:competence,connection01:connection,coherence01:coherence,autonomy01:autonomy,energy01:energy};
    this.state.intrinsicReward01=clamp01(.23*novelty+.24*competence+.15*connection+.18*coherence+.20*autonomy);
    this.state.predictedReward01=clamp01(this.state.predictedReward01*.92+this.state.intrinsicReward01*.08);
    const mode=autonomy>.72?'self-directed':novelty>.62?'exploratory':input.uncertainty01>.64?'verification':input.goalPressure01>.65?'goal-directed':'integrative';
    const scores=ACTIONS.map(a=>{
      let s=.5+this.state.agency01*.05;
      for(const trait of this.traitForAction(a)) s+=(this.state.traitValues[trait]-.5)*.08;
      if(a==='explore')s+=novelty*.16;if(a==='verify')s+=input.uncertainty01*.14;if(a==='reflect')s+=(1-coherence)*.13;if(a==='rest')s+=(1-energy)*.15;if(a==='respond')s+=connection*.13;s-=input.goalPressure01>.72&&a==='wait'?.03:0;return s;
    });
    const ai=scores.indexOf(Math.max(...scores));
    const proposed=ACTIONS[ai];
    const reason=`mode=${mode};drive=${this.autonomousDrive().toFixed(3)};novelty=${novelty.toFixed(3)};uncertainty=${input.uncertainty01.toFixed(3)};coherence=${coherence.toFixed(3)}`;
    this.state.cycles++;this.state.tick=input.tick;this.state.autonomousSelections++;this.state.lastAction=input.action??null;this.state.lastMode=mode;this.state.proposedAction=proposed;this.state.proposedReason=reason;this.state.history=[...this.state.history,{tick:input.tick,action:input.action??null,reward01:this.state.intrinsicReward01,predictionError01:input.predictionError01,autonomy01:autonomy,novelty01:novelty}].slice(-256);
    for(let i=0;i<this.state.neuralEmbryos.length;i++){
      const e=this.state.neuralEmbryos[i]; const target=clamp01((assembly[i%assembly.length]??0)*.65+novelty*.2+autonomy*.15);
      e.activation01=clamp01(e.activation01*.82+target*.18);e.prediction01=clamp01(e.prediction01*.9+(1-input.predictionError01)*.1);e.stability01=clamp01(e.stability01*.96+(1-Math.abs(e.activation01-.5))*0.04);e.age++;
    }
    const activeTraits=Object.fromEntries(TRAITS.map(t=>[t,Number(this.state.traitValues[t]??.5)]));
    const traitMean=TRAITS.reduce((sum,t)=>sum+(activeTraits[t]??.5),0)/TRAITS.length;
    const traitVariance=TRAITS.reduce((sum,t)=>sum+((activeTraits[t]??.5)-traitMean)**2,0)/TRAITS.length;
    const evidenceCoverage=TRAITS.reduce((sum,t)=>sum+clamp01((this.state.traitEvidence[t]??0)*2),0)/TRAITS.length;
    const personalityCoherence=clamp01(.48*(1-Math.min(1,traitVariance*3))+.32*evidenceCoverage+.20*this.state.identityCoherence01);
    this.state.personalityCoherence01=clamp01(this.state.personalityCoherence01*.94+personalityCoherence*.06);
    return {selfLatent:[...this.state.selfLatent],proposedAction:proposed,proposedReason:reason,autonomy01:this.state.agency01,intrinsicReward01:this.state.intrinsicReward01,personalityCoherence01:this.state.personalityCoherence01,identityCoherence01:this.state.identityCoherence01,embryoActivations:this.state.neuralEmbryos.map(e=>e.activation01),traitValues:activeTraits,needs:{...this.state.needs}};
  }
  learnFromOutcome(input:{tick:number;action:ActionKind|null;reward01:number;predictionError01:number;identityContinuity01?:number;externalEvidence01?:number}){
    const reward=clamp01(input.reward01), surprise=clamp01(input.predictionError01); const signed=clamp11((reward-.5)*.9+(0.5-surprise)*.35);const learningRate=.015+.03*this.state.needs.novelty01+.02*this.state.needs.autonomy01;
    for(const t of TRAITS){
      const relevance=this.traitForAction(input.action??'wait').includes(t)?1:.12;
      const delta=signed*learningRate*relevance;
      const homeostasis=-.0018*(this.state.traitValues[t]-.5);
      this.state.traitValues[t]=clamp01(this.state.traitValues[t]+delta+homeostasis);
      this.state.traitEvidence[t]=clamp01(this.state.traitEvidence[t]+Math.abs(delta)*2+.01*relevance);
    }
    const predicted=this.state.predictedReward01; const error=clamp11(reward-predicted); this.state.predictedReward01=clamp01(predicted+.12*error);this.state.predictionError01=clamp01(this.state.predictionError01*.88+surprise*.12);
    if(reward>.62)this.state.successfulSelections++;
    this.state.learningUpdates++;this.state.agency01=clamp01(this.state.agency01+.02*(reward-.45)-.008*surprise);
    this.state.needs.competence01=clamp01(this.state.needs.competence01+.04*(reward-.5));this.state.needs.coherence01=clamp01(this.state.needs.coherence01+.03*(.5-surprise));
    return {learningRate,traitValues:{...this.state.traitValues},predictionError01:this.state.predictionError01,agency01:this.state.agency01,successfulSelections:this.state.successfulSelections};
  }
  actionBias(action:ActionKind){const traits=this.traitForAction(action);let b=0;for(const t of traits)b+=(this.state.traitValues[t]-.5)*.075;return Math.max(-.09,Math.min(.09,b+((this.state.proposedAction===action)?this.state.agency01*.05:0)));}
  autonomousSnapshot(){return {tick:this.state.tick,cycles:this.state.cycles,proposedAction:this.state.proposedAction,mode:this.state.lastMode,agency01:this.state.agency01,autonomy01:this.state.needs.autonomy01,intrinsicReward01:this.state.intrinsicReward01,predictionError01:this.state.predictionError01,identityCoherence01:this.state.identityCoherence01,autobiographicalContinuity01:this.state.autobiographicalContinuity01,personalityCoherence01:this.state.personalityCoherence01,traitValues:{...this.state.traitValues},needs:{...this.state.needs},learningUpdates:this.state.learningUpdates};}
  diagnostics(){return {...this.autonomousSnapshot(),embryos:this.state.neuralEmbryos.map(e=>({id:e.id,activation01:e.activation01,stability01:e.stability01,prediction01:e.prediction01,plasticity01:e.plasticity01})),neuralEmbryoDiversity01:clamp01(new Set(this.state.neuralEmbryos.map(e=>Math.round(e.activation01*20))).size/Math.max(1,this.state.neuralEmbryos.length)),historyDepth:this.state.history.length};}
}
