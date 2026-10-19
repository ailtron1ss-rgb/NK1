import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const N=32;
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-4,Math.min(4,x)));
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return x>>>0;};
const rand=(seed:number,scale=.22)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const norm=(xs:number[])=>Math.sqrt(xs.reduce((a,b)=>a+b*b,0)/Math.max(1,xs.length));
const actionIndex=(a:ActionKind|null|undefined)=>a==null?-1:ACTIONS.indexOf(a);

export interface B296Synapse { pre:number; post:number; weight:number; consolidatedWeight:number; eligibility01:number; tag01:number; usage01:number; active:boolean; age:number; lastDelta01:number; lesioned?:boolean; }
export interface B296State {
  version:1;
  neuronCount:number;
  inputDim:number;
  cycles:number;
  learningUpdates:number;
  spikes:number;
  synapticUpdates:number;
  membrane:number[];
  threshold:number[];
  refractory:number[];
  preTrace:number[];
  postTrace:number[];
  synapses:B296Synapse[];
  actionReadout:number[][];
  latent:number[];
  lastSpikes:number[];
  lastInput:number[];
  lastAction:ActionKind|null;
  firingRate01:number;
  sparsity01:number;
  homeostaticError01:number;
  plasticity01:number;
  neuromodulation01:number;
  selfCoherence01:number;
  personalityCoherence01:number;
  agency01:number;
  developmentalReadiness01:number;
  lastPredictionError01:number;
  lesion01:number;
  learningEligibleCycles:number;
  learningSuppressedCycles:number;
  lastLearningGate01:number;
  lastThirdFactor:number;
  slowPlasticity01:number;
  consolidationCycles:number;
  lastConsolidationCycle:number;
  calcium:number[];
  intrinsicExcitability:number[];
  homeostaticTarget01:number;
  history:Array<{tick:number;action:ActionKind|null;reward01:number;predictionError01:number;spikes:number;readout01:number}>;
}

export interface B296StepInput {
  tick:number;
  currentAction?:ActionKind|null;
  b269Assembly?:number[];
  b270SelfLatent?:number[];
  b289Latent?:number[];
  b291Agency01?:number;
  b291IdentityFit01?:number;
  b291PersonalityFit01?:number;
  b293PredictedSelf01?:number;
  b293PredictedWorld01?:number;
  b293PredictionError01?:number;
  b294CausalConfidence01?:number;
  b295Budget01?:number;
  novelty01?:number;
  uncertainty01?:number;
  energy01?:number;
  goalPressure01?:number;
  learningEnabled?:boolean;
}

export interface B296StepResult {
  latent:number[];
  spikes:number[];
  actionBias:Record<ActionKind,number>;
  firingRate01:number;
  sparsity01:number;
  homeostaticError01:number;
  plasticity01:number;
  selfCoherence01:number;
  personalityCoherence01:number;
  agency01:number;
  developmentalReadiness01:number;
}

function makeSynapses():B296Synapse[]{
  const out:B296Synapse[]=[];
  for(let post=0;post<N;post++){
    for(let k=0;k<5;k++){
      const pre=(post*11+k*7+3)%N;
      if(pre===post) continue;
      out.push({pre,post,weight:rand(900_000+post*19+k*17,.16),consolidatedWeight:0,eligibility01:0,tag01:0,usage01:.04,active:true,age:0,lastDelta01:0,lesioned:false});
    }
  }
  return out;
}

export const defaultB296State=():B296State=>({
  version:1,neuronCount:N,inputDim:32,cycles:0,learningUpdates:0,spikes:0,synapticUpdates:0,
  membrane:new Array(N).fill(0),threshold:new Array(N).fill(.30),refractory:new Array(N).fill(0),
  preTrace:new Array(N).fill(0),postTrace:new Array(N).fill(0),synapses:makeSynapses(),
  actionReadout:ACTIONS.map((_,a)=>Array.from({length:N},(_,i)=>rand(910_000+a*101+i*13,.06))),
  latent:new Array(N).fill(0),lastSpikes:new Array(N).fill(0),lastInput:new Array(32).fill(0),lastAction:null,
  firingRate01:.06,sparsity01:.88,homeostaticError01:.08,plasticity01:.45,neuromodulation01:.5,
  slowPlasticity01:.18,consolidationCycles:0,lastConsolidationCycle:0,calcium:new Array(N).fill(0),intrinsicExcitability:new Array(N).fill(.30),homeostaticTarget01:.08,
  selfCoherence01:.70,personalityCoherence01:.60,agency01:.50,developmentalReadiness01:.28,lastPredictionError01:.35,lesion01:0,learningEligibleCycles:0,learningSuppressedCycles:0,lastLearningGate01:0,lastThirdFactor:0,history:[]
});

export class B296NeuralPersonalityAgencyNucleus {
  private state=B296NeuralPersonalityAgencyNucleus.normalize(defaultB296State());

  private static normalize(raw?:Partial<B296State>|null):B296State{
    const d=defaultB296State();
    const r=raw??{};
    const n=Math.max(24,Math.min(40,Math.floor(Number(r.neuronCount??N))));
    const arr=(v:unknown,len:number,fill=0)=>Array.isArray(v)?(v as unknown[]).slice(0,len).map(x=>Number(x) || 0).concat(new Array(Math.max(0,len-(v as unknown[]).length)).fill(fill)).slice(0,len):new Array(len).fill(fill);
    const syn=Array.isArray(r.synapses)?(r.synapses as any[]).slice(0,256).map(s=>({pre:Math.max(0,Math.min(n-1,Math.floor(Number(s?.pre??0)))),post:Math.max(0,Math.min(n-1,Math.floor(Number(s?.post??0)))),weight:clamp11(Number(s?.weight??0)),eligibility01:clamp01(Number(s?.eligibility01??0)),usage01:clamp01(Number(s?.usage01??0)),active:s?.active!==false,age:Math.max(0,Math.floor(Number(s?.age??0)))})):makeSynapses();
    const readout=ACTIONS.map((_,a)=>arr((r.actionReadout as any)?.[a],n,0));
    return {...d,...r,version:1,neuronCount:n,inputDim:32,
      membrane:arr(r.membrane,n),threshold:arr(r.threshold,n,.30).map(v=>Math.max(.16,Math.min(.9,v))),refractory:arr(r.refractory,n),preTrace:arr(r.preTrace,n),postTrace:arr(r.postTrace,n),
      synapses:syn.map((s:any)=>({...s,consolidatedWeight:clamp11(Number(s?.consolidatedWeight??s?.weight??0)),tag01:clamp01(Number(s?.tag01??0)),lastDelta01:clamp11(Number(s?.lastDelta01??0)),lesioned:Boolean(s?.lesioned??false)})),actionReadout:readout,latent:arr(r.latent,n),lastSpikes:arr(r.lastSpikes,n),lastInput:arr(r.lastInput,32),
      firingRate01:clamp01(Number(r.firingRate01??d.firingRate01)),
      sparsity01:clamp01(Number(r.sparsity01??d.sparsity01)),
      homeostaticError01:clamp01(Number(r.homeostaticError01??d.homeostaticError01)),
      plasticity01:clamp01(Number(r.plasticity01??d.plasticity01)),
      neuromodulation01:clamp01(Number(r.neuromodulation01??d.neuromodulation01)),
      selfCoherence01:clamp01(Number(r.selfCoherence01??d.selfCoherence01)),
      personalityCoherence01:clamp01(Number(r.personalityCoherence01??d.personalityCoherence01)),
      agency01:clamp01(Number(r.agency01??d.agency01)),
      developmentalReadiness01:clamp01(Number(r.developmentalReadiness01??d.developmentalReadiness01)),
      lastPredictionError01:clamp01(Number(r.lastPredictionError01??d.lastPredictionError01)),
      lesion01:clamp01(Number(r.lesion01??0)),
      learningEligibleCycles:Math.max(0,Math.floor(Number(r.learningEligibleCycles??0))),
      learningSuppressedCycles:Math.max(0,Math.floor(Number(r.learningSuppressedCycles??0))),
      lastLearningGate01:clamp01(Number(r.lastLearningGate01??0)),
      lastThirdFactor:Number.isFinite(Number(r.lastThirdFactor))?Number(r.lastThirdFactor):0,
      slowPlasticity01:clamp01(Number(r.slowPlasticity01??d.slowPlasticity01)),
      consolidationCycles:Math.max(0,Math.floor(Number(r.consolidationCycles??0))),
      lastConsolidationCycle:Math.max(0,Math.floor(Number(r.lastConsolidationCycle??0))),
      calcium:arr(r.calcium,n),
      intrinsicExcitability:arr(r.intrinsicExcitability,n,.30).map(v=>Math.max(.12,Math.min(.9,v))),
      homeostaticTarget01:clamp01(Number(r.homeostaticTarget01??d.homeostaticTarget01)),
      history:Array.isArray(r.history)?r.history.slice(-128):[]
    };
  }

  restore(raw?:Partial<B296State>|null){ this.state=B296NeuralPersonalityAgencyNucleus.normalize(raw); }
  snapshot(){ return structuredClone(this.state); }

  private encode(input:B296StepInput):number[]{
    const x=new Array(32).fill(0);
    const push=(src:number[]|undefined,offset:number,count:number,scale:number)=>{for(let i=0;i<count;i++)x[offset+i]=clamp11(Number(src?.[i%Math.max(1,src?.length??1)]??0)*scale);};
    push(input.b269Assembly,0,8,.9); push(input.b270SelfLatent,8,8,.9); push(input.b289Latent,16,6,.9);
    x[22]=clamp11((input.b291Agency01??.5)*2-1); x[23]=clamp11((input.b291IdentityFit01??.5)*2-1); x[24]=clamp11((input.b291PersonalityFit01??.5)*2-1);
    x[25]=clamp11((input.b293PredictedSelf01??.5)*2-1); x[26]=clamp11((input.b293PredictedWorld01??.5)*2-1); x[27]=clamp11((input.b293PredictionError01??.3)*2-1);
    x[28]=clamp11((input.b294CausalConfidence01??.3)*2-1); x[29]=clamp11((input.b295Budget01??.5)*2-1); x[30]=clamp11((input.novelty01??.3)*2-1); x[31]=clamp11((input.goalPressure01??.3)*2-1);
    return x;
  }

  private neuromodulation(input:B296StepInput){
    const novelty=clamp01(input.novelty01??.3),uncertainty=clamp01(input.uncertainty01??.3),error=clamp01(input.b293PredictionError01??.3),goal=clamp01(input.goalPressure01??.3),energy=clamp01(input.energy01??.8),causal=clamp01(input.b294CausalConfidence01??.3);
    return clamp01(.24*novelty+.23*error+.20*goal+.13*uncertainty+.10*causal+.10*(1-energy));
  }

  step(input:B296StepInput):B296StepResult{
    const x=this.encode(input),n=this.state.neuronCount,mod=this.neuromodulation(input),ai=actionIndex(input.currentAction);
    const next=new Array(n).fill(0),spikes=new Array(n).fill(0);
    for(let i=0;i<n;i++){
      let current=0;
      for(let k=0;k<32;k++) current+=(rand(920_000+i*37+k*7,.045))*x[k];
      if(ai>=0) current+=(this.state.actionReadout[ai]?.[i]??0)*.35;
      for(const s of this.state.synapses) if(s.active&&s.post===i) { const w=s.weight*.72+s.consolidatedWeight*.28; current+=w*(this.state.lastSpikes[s.pre]??0); }
      next[i]=this.state.membrane[i]*.82+current;
      if(this.state.refractory[i]>0){this.state.refractory[i]=Math.max(0,this.state.refractory[i]-1);continue;}
      if(next[i]>=this.state.threshold[i]){spikes[i]=1;next[i]=0;this.state.refractory[i]=1;}
    }
    const fired=spikes.map((v,i)=>v?i:-1).filter(i=>i>=0);
    const maxEvents=Math.max(2,Math.ceil(n*.16));
    if(fired.length>maxEvents){
      fired.sort((a,b)=>Math.abs(next[b])-Math.abs(next[a]));
      const keep=new Set(fired.slice(0,maxEvents)); for(const i of fired) if(!keep.has(i)) spikes[i]=0;
    }
    const rate=spikes.reduce((a,b)=>a+b,0)/n, homeo=Math.abs(rate-this.state.homeostaticTarget01);
    for(let i=0;i<n;i++){ this.state.calcium[i]=clamp01((this.state.calcium[i]??0)*.86+spikes[i]*.42); const pressure=(this.state.homeostaticTarget01-rate)*.018; this.state.intrinsicExcitability[i]=Math.max(.12,Math.min(.9,(this.state.intrinsicExcitability[i]??.3)+pressure-(this.state.calcium[i]??0)*.002)); this.state.threshold[i]=Math.max(.16,Math.min(.9,this.state.threshold[i]-(this.state.intrinsicExcitability[i]-.3)*.002)); }
    for(let i=0;i<n;i++){
      this.state.preTrace[i]=this.state.preTrace[i]*.92+spikes[i]*.20;
      this.state.postTrace[i]=this.state.postTrace[i]*.88+spikes[i]*.28;
      this.state.membrane[i]=next[i];
      const drift=(.08-rate)*.012; this.state.threshold[i]=Math.max(.24,Math.min(.9,this.state.threshold[i]-drift));
    }
    for(const s of this.state.synapses){
      const eligibility=clamp01((this.state.preTrace[s.pre]??0)*(this.state.postTrace[s.post]??0)*3);
      s.eligibility01=clamp01(s.eligibility01*.965+eligibility*.035); s.tag01=clamp01(s.tag01*.94+eligibility*.06);
    }
    const latent=next.map((v,i)=>clamp11(v*.75+spikes[i]*.45));
    const meanAbs=mean(latent.map(Math.abs));
    const selfSignal=clamp01((meanAbs*.55)+(input.b291IdentityFit01??.5)*.25+(input.b293PredictedSelf01??.5)*.20);
    const personalitySpread=norm(ACTIONS.map(a=>this.rawActionReadout(a,latent)));
    const personality=clamp01(.48*(1-Math.min(1,personalitySpread))+.27*(input.b291PersonalityFit01??.5)+.25*(1-(input.b293PredictionError01??.3)));
    const agency=clamp01(.32*(input.b291Agency01??.5)+.22*selfSignal+.18*(input.goalPressure01??.3)+.14*(1-(input.b293PredictionError01??.3))+.14*meanAbs);
    const readiness=clamp01(this.state.developmentalReadiness01*.94 + (mod*.04) + ((input.b295Budget01??.5)-.5)*.03 + (1-homeo)*.01);
    this.state.latent=latent;this.state.lastSpikes=spikes;this.state.lastInput=x;this.state.lastAction=input.currentAction??null;this.state.cycles++;this.state.spikes+=spikes.reduce((a,b)=>a+b,0);
    this.state.firingRate01=this.state.firingRate01*.92+rate*.08;this.state.sparsity01=clamp01(1-this.state.firingRate01*1.9);this.state.homeostaticError01=this.state.homeostaticError01*.90+homeo*.10;this.state.neuromodulation01=this.state.neuromodulation01*.88+mod*.12;this.state.selfCoherence01=selfSignal;this.state.personalityCoherence01=personality;this.state.agency01=agency;this.state.developmentalReadiness01=readiness;this.state.lastPredictionError01=clamp01(input.b293PredictionError01??.3);
    const actionBias=Object.fromEntries(ACTIONS.map(a=>[a,this.actionBias(a,latent)])) as Record<ActionKind,number>;
    this.state.history=[...this.state.history,{tick:input.tick,action:input.currentAction??null,reward01:.5,predictionError01:this.state.lastPredictionError01,spikes:spikes.reduce((a,b)=>a+b,0),readout01:clamp01(mean(ACTIONS.map(a=>Math.abs(this.rawActionReadout(a,latent))))*2)}].slice(-128);
    return {latent:[...latent],spikes:[...spikes],actionBias,firingRate01:this.state.firingRate01,sparsity01:this.state.sparsity01,homeostaticError01:this.state.homeostaticError01,plasticity01:this.state.plasticity01,selfCoherence01:selfSignal,personalityCoherence01:personality,agency01:agency,developmentalReadiness01:readiness};
  }

  private rawActionReadout(action:ActionKind,latent=this.state.latent){const idx=Math.max(0,actionIndex(action));const row=this.state.actionReadout[idx]??[];return mean(row.map((w,i)=>w*(latent[i]??0)));}
  actionBias(action:ActionKind,latent=this.state.latent){ return clamp11(this.rawActionReadout(action,latent)*.032 + (this.state.agency01-.5)*.018 + (this.state.personalityCoherence01-.5)*.010 - this.state.lesion01*.018); }

  learnFromOutcome(input:{tick:number;action:ActionKind|null;reward01:number;predictionError01:number;identityContinuity01:number;causalConfidence01:number;externalEvidence01:number;learningRate01?:number}){
    const learningGate=clamp01(input.learningRate01??1);
    this.state.lastLearningGate01=learningGate;
    if(learningGate<=.001){ this.state.learningSuppressedCycles++; return {learningUpdates:this.state.learningUpdates,synapticUpdates:this.state.synapticUpdates,thirdFactor:0,plasticity01:this.state.plasticity01,developmentalReadiness01:this.state.developmentalReadiness01,learningGate01:0,skipped:true}; }
    this.state.learningEligibleCycles++;
    const reward=clamp11(input.reward01-.5),error=clamp01(input.predictionError01),third=(reward*.70+(1-error-.5)*.35+(clamp01(input.causalConfidence01)-.5)*.25)*this.state.neuromodulation01*learningGate;
    this.state.lastThirdFactor=third;
    let updates=0;
    for(const s of this.state.synapses){
      if(!s.active) continue;
      const stdp=(this.state.preTrace[s.pre]*this.state.lastSpikes[s.post] - this.state.postTrace[s.post]*this.state.lastSpikes[s.pre]);
      const tagGate=clamp01(.55*s.eligibility01+.30*s.tag01+.15*Math.abs(stdp));
      const intrinsicBrake=clamp01(1-Math.abs((this.state.firingRate01??.08)-this.state.homeostaticTarget01)*2.5);
      const delta=.010*this.state.plasticity01*third*tagGate*intrinsicBrake-.0011*s.weight*learningGate;
      if(Math.abs(delta)>1e-7){s.weight=clamp11(s.weight+delta);s.lastDelta01=clamp11(delta*8);s.usage01=clamp01(s.usage01*.965+Math.abs(delta)*7);s.tag01=clamp01(s.tag01*.96+Math.abs(delta)*3);updates++;} s.age++;
    }
    const ai=actionIndex(input.action); if(ai>=0){for(let i=0;i<this.state.neuronCount;i++){const eligible=this.state.lastSpikes[i]>.5?1:0;this.state.actionReadout[ai][i]=clamp11(this.state.actionReadout[ai][i]+.010*third*(eligible-.08));}}
    if(this.state.cycles%8===0 && this.state.cycles>this.state.lastConsolidationCycle){ this.state.consolidationCycles++; this.state.lastConsolidationCycle=this.state.cycles; const quota=clamp01(.08+Math.abs(third)*.35+this.state.slowPlasticity01*.25); for(const s of this.state.synapses){ if(!s.active) continue; const capture=clamp01(s.tag01*quota); s.consolidatedWeight=clamp11(s.consolidatedWeight*(1-capture*.06)+s.weight*(capture*.06)); s.tag01*=.90; } this.state.slowPlasticity01=clamp01(this.state.slowPlasticity01*.985+Math.abs(third)*.015); }
    for(let i=0;i<this.state.neuronCount;i++) this.state.preTrace[i]*=.96,this.state.postTrace[i]*=.96;
    this.state.learningUpdates++;this.state.synapticUpdates+=updates;this.state.plasticity01=clamp01(this.state.plasticity01*.98+Math.abs(third)*.03);
    this.state.selfCoherence01=clamp01(this.state.selfCoherence01*.985+clamp01(input.identityContinuity01)*.015);
    this.state.developmentalReadiness01=clamp01(this.state.developmentalReadiness01 + Math.max(0,third)*.006 - error*.001);
    if(this.state.cycles%96===0) this.structuralMaintenance();
    const r={learningUpdates:this.state.learningUpdates,synapticUpdates:this.state.synapticUpdates,thirdFactor:third,plasticity01:this.state.plasticity01,developmentalReadiness01:this.state.developmentalReadiness01,learningGate01:learningGate,skipped:false};
    this.state.history=this.state.history.slice(-128); return r;
  }

  private structuralMaintenance(){
    const active=this.state.synapses.filter(s=>s.active);
    let strongest=active.slice().sort((a,b)=>(b.usage01*.55+b.tag01*.20+Math.abs(b.consolidatedWeight)*.25)-(a.usage01*.55+a.tag01*.20+Math.abs(a.consolidatedWeight)*.25)).slice(0,Math.max(96,Math.floor(active.length*.78)));
    const keep=new Set(strongest.map(s=>s.pre+':'+s.post));
    for(const s of active) if(this.state.lesion01<.01 && s.usage01<.035 && !keep.has(s.pre+':'+s.post)) s.active=false;
    let grown=0;
    const byPost=new Map<number,number>(); for(const s of this.state.synapses) if(s.active) byPost.set(s.post,(byPost.get(s.post)??0)+1);
    for(let post=0;post<this.state.neuronCount && grown<4;post++) if((byPost.get(post)??0)<4){const pre=(post*13+this.state.cycles)%this.state.neuronCount;if(pre!==post&&!this.state.synapses.some(s=>s.active&&s.pre===pre&&s.post===post)){this.state.synapses.push({pre,post,weight:rand(this.state.cycles*101+post,.05),consolidatedWeight:0,eligibility01:0,tag01:0,usage01:.04,active:true,age:0,lastDelta01:0,lesioned:false});grown++;}}
  }

  lesion(fraction01=.5){const f=clamp01(fraction01);this.state.lesion01=f;const active=this.state.synapses.filter(s=>s.active);const n=Math.max(1,Math.floor(active.length*f));for(const s of active.slice(0,n)){s.active=false;s.lesioned=true;}return {lesion01:this.state.lesion01,disabledSynapses:n,activeSynapses:this.state.synapses.filter(s=>s.active).length};}
  clearLesion(repair01=1){const r=clamp01(repair01);this.state.lesion01=0;for(const s of this.state.synapses) if(s.lesioned && r>0){if((seeded(s.pre*1009+s.post*917+this.state.cycles) / 0xffffffff)<=r)s.active=true;s.lesioned=false;}return this.diagnostics();}
  diagnostics(){
    return {
      version:1,
      cycles:this.state.cycles,
      learningUpdates:this.state.learningUpdates,
      learningEligibleCycles:this.state.learningEligibleCycles,
      learningSuppressedCycles:this.state.learningSuppressedCycles,
      lastLearningGate01:this.state.lastLearningGate01,
      lastThirdFactor:this.state.lastThirdFactor,
      spikes:this.state.spikes,
      synapticUpdates:this.state.synapticUpdates,
      activeSynapses:this.state.synapses.filter(s=>s.active).length,
      firingRate01:this.state.firingRate01,
      sparsity01:this.state.sparsity01,
      homeostaticError01:this.state.homeostaticError01,
      plasticity01:this.state.plasticity01,
      slowPlasticity01:this.state.slowPlasticity01,
      consolidationCycles:this.state.consolidationCycles,
      lastConsolidationCycle:this.state.lastConsolidationCycle,
      calciumMean01:mean(this.state.calcium),
      intrinsicExcitabilityMean01:mean(this.state.intrinsicExcitability),
      neuromodulation01:this.state.neuromodulation01,
      selfCoherence01:this.state.selfCoherence01,
      personalityCoherence01:this.state.personalityCoherence01,
      agency01:this.state.agency01,
      developmentalReadiness01:this.state.developmentalReadiness01,
      lastPredictionError01:this.state.lastPredictionError01,
      lesion01:this.state.lesion01,
      historyDepth:this.state.history.length
    };
  }
}
